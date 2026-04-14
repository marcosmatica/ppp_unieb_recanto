// src/pages/DashboardEIPage.jsx

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchVisitasCRE, fetchVisitasCI,
  fetchRespostasAgregadas, calcHeatmap, ALL_INDICATORS,
  fetchPlanosCRE,
} from '../services/dashboardService'
import { METAS_EI, DESCRIPTOR_LABELS } from '../services/indicadoresEI'
import './DashboardEIPage.css'

export default function DashboardEIPage() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'supervisor'

  const [visitas,   setVisitas]   = useState([])
  const [agregadas, setAgregadas] = useState({})
  const [planos,    setPlanos]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filtroMeta, setFiltroMeta] = useState('all')
  const [filtroUE,   setFiltroUE]   = useState('all')

  useEffect(() => {
    if (!profile?.uid) return
    carregar()
  }, [profile])

  async function carregar() {
    const vs = isAdmin
      ? await fetchVisitasCRE(profile.cre)
      : await fetchVisitasCI(profile.uid)
    setVisitas(vs)
    const [agr, pls] = await Promise.all([
      fetchRespostasAgregadas(vs),
      fetchPlanosCRE(vs),
    ])
    setAgregadas(agr)
    setPlanos(pls)
    setLoading(false)
  }

  const heatmap = useMemo(() => calcHeatmap(agregadas), [agregadas])

  const indicadoresFiltrados = filtroMeta === 'all'
    ? ALL_INDICATORS
    : ALL_INDICATORS.filter(i => i.metaCode === filtroMeta)

  const escolasFiltradas = useMemo(() => {
    const ids = filtroUE === 'all'
      ? Object.keys(agregadas)
      : [filtroUE]
    return ids.map(id => ({ id, ...agregadas[id] }))
  }, [agregadas, filtroUE])

  // ── Resumos
  const totalVisitas   = visitas.length
  const visitasAbertas = visitas.filter(v => v.status === 'open').length
  const planosAtrasados = planos.filter(p => {
    if (p.status === 'done' || !p.deadline) return false
    return new Date(p.deadline + 'T00:00') < new Date()
  }).length
  const totalEscolas = Object.keys(agregadas).length

  if (loading) return <div className="dei-loading"><div className="spinner" /></div>

  return (
    <div className="dei-root">
      <header className="dei-header">
        <div>
          <h1>Dashboard — EI</h1>
          <span className="dei-header__sub">{profile?.cre}</span>
        </div>
        <button
          className="btn-secondary dei-header__relatorio"
          onClick={() => navigate('/visitas/relatorio')}
        >
          Relatório
        </button>
      </header>

      {/* ── Resumo cards ── */}
      <div className="dei-cards">
        <SummaryCard label="Visitas abertas" value={visitasAbertas} total={totalVisitas} variant="info" />
        <SummaryCard label="Unidades monitoradas" value={totalEscolas} variant="neutral" />
        <SummaryCard label="Planos atrasados" value={planosAtrasados} variant={planosAtrasados > 0 ? 'danger' : 'success'} />
      </div>

      {/* ── Heatmap ── */}
      <section className="dei-heatmap-section">
        <div className="dei-filters">
          <select value={filtroMeta} onChange={e => setFiltroMeta(e.target.value)}>
            <option value="all">Todas as metas</option>
            {METAS_EI.map(m => (
              <option key={m.code} value={m.code}>{m.code} — {m.label}</option>
            ))}
          </select>
          <select value={filtroUE} onChange={e => setFiltroUE(e.target.value)}>
            <option value="all">Todas as UEs</option>
            {Object.entries(agregadas).map(([id, { schoolName }]) => (
              <option key={id} value={id}>{schoolName}</option>
            ))}
          </select>
        </div>

        {escolasFiltradas.length === 0 ? (
          <p className="dei-empty">Nenhuma sessão submetida ainda.</p>
        ) : (
          <div className="dei-heatmap-wrap">
            <table className="dei-heatmap">
              <thead>
                <tr>
                  <th className="dei-heatmap__school-col">Unidade</th>
                  {indicadoresFiltrados.map(ind => (
                    <th key={ind.code} title={ind.label}>
                      <span className="dei-heatmap__ind-code">{ind.code}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {escolasFiltradas.map(escola => (
                  <tr key={escola.id}>
                    <td
                      className="dei-heatmap__school-name"
                      onClick={() => navigate(`/visitas/escola/${escola.id}`)}
                    >
                      {escola.schoolName}
                    </td>
                    {indicadoresFiltrados.map(ind => {
                      const avg = heatmap[escola.id]?.[ind.code]
                      return (
                        <td key={ind.code}>
                          <HeatCell avg={avg} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="dei-legend">
          {[null, 1, 2, 3, 4, 5].map(n => (
            <span key={n ?? 'nd'} className={`dei-legend__item level-${n ?? 'nd'}`}>
              {n ? `${n} – ${DESCRIPTOR_LABELS[n]}` : 'Não avaliado'}
            </span>
          ))}
        </div>
      </section>

      {/* ── Planos atrasados ── */}
      {planosAtrasados > 0 && (
        <section className="dei-late">
          <p className="dei-section-label danger">
            Planos com prazo vencido ({planosAtrasados})
          </p>
          {planos
            .filter(p => p.status !== 'done' && p.deadline && new Date(p.deadline + 'T00:00') < new Date())
            .map(p => (
              <div key={p.id} className="dei-late__item" onClick={() => navigate(`/visitas/${p.visitId}/planos`)}>
                <span className="dei-late__school">{p.schoolName}</span>
                <span className="dei-late__ind">{p.indicatorCode} — {p.indicatorLabel}</span>
                <span className="dei-late__deadline">Prazo: {p.deadline}</span>
              </div>
            ))
          }
        </section>
      )}
    </div>
  )
}

function SummaryCard({ label, value, total, variant }) {
  return (
    <div className={`dei-card variant-${variant}`}>
      <span className="dei-card__value">{value}{total !== undefined ? `/${total}` : ''}</span>
      <span className="dei-card__label">{label}</span>
    </div>
  )
}

function HeatCell({ avg }) {
  if (avg == null) return <div className="dei-cell level-nd" title="Não avaliado" />
  const level = Math.round(avg)
  return (
    <div
      className={`dei-cell level-${level}`}
      title={`Média: ${avg.toFixed(1)} — ${DESCRIPTOR_LABELS[level]}`}
    />
  )
}
