// src/pages/EscolaDetailPage.jsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchHistoricoEscola } from '../services/dashboardService'
import { visitasService } from '../services/visitasService'
import { planosService } from '../services/planosService'
import { METAS_EI, DESCRIPTOR_LABELS } from '../services/indicadoresEI'
import './EscolaDetailPage.css'

export default function EscolaDetailPage() {
  const { schoolId } = useParams()
  const navigate     = useNavigate()

  const [historico, setHistorico] = useState([])
  const [visitas,   setVisitas]   = useState([])
  const [planos,    setPlanos]    = useState([])
  const [schoolName, setSchoolName] = useState('')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetchHistoricoEscola(schoolId),
      visitasService.listarPorEscola(schoolId),
    ]).then(async ([hist, vs]) => {
      setHistorico(hist)
      setVisitas(vs)
      if (vs[0]) setSchoolName(vs[0].schoolName)
      const allPlans = await Promise.all(
        vs.map(v => planosService.listarPorVisita(v.id).then(ps => ps.map(p => ({ ...p, visitId: v.id }))))
      )
      setPlanos(allPlans.flat())
      setLoading(false)
    })
  }, [schoolId])

  if (loading) return <div className="edp-loading"><div className="spinner" /></div>

  // ── Agrupa histórico por indicador
  const porIndicador = {}
  historico.forEach(p => {
    if (!porIndicador[p.indicatorCode]) porIndicador[p.indicatorCode] = []
    porIndicador[p.indicatorCode].push(p)
  })

  // ── Diff: compara primeiro vs último ponto de cada indicador
  const diffRows = Object.entries(porIndicador).map(([code, pontos]) => {
    const sorted = [...pontos].sort((a, b) => a.date - b.date)
    const first  = sorted[0]
    const last   = sorted[sorted.length - 1]
    const delta  = last.level - first.level
    return { code, first, last, delta, total: sorted.length }
  }).sort((a, b) => a.delta - b.delta)

  const totalPlanos    = planos.length
  const planosConcluidos = planos.filter(p => p.status === 'done').length

  return (
    <div className="edp-root">
      <header className="edp-header">
        <button className="edp-back" onClick={() => navigate('/visitas/dashboard')}>←</button>
        <div className="edp-header__info">
          <h1>{schoolName}</h1>
          <span>{visitas.length} visita{visitas.length !== 1 ? 's' : ''} registrada{visitas.length !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {/* ── Progresso de planos ── */}
      <div className="edp-plans-bar">
        <div className="edp-plans-bar__label">
          <span>Planos concluídos</span>
          <span>{planosConcluidos}/{totalPlanos}</span>
        </div>
        <div className="edp-progress">
          <div
            className="edp-progress__fill"
            style={{ width: totalPlanos ? `${(planosConcluidos / totalPlanos) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* ── Evolução por indicador (diff) ── */}
      <section className="edp-section">
        <p className="edp-section-label">Evolução dos indicadores</p>
        {diffRows.length === 0 ? (
          <p className="edp-empty">Nenhuma sessão submetida ainda.</p>
        ) : (
          diffRows.map(({ code, first, last, delta, total }) => (
            <DiffRow key={code} code={code} first={first} last={last} delta={delta} total={total} />
          ))
        )}
      </section>

      {/* ── Histórico de visitas ── */}
      <section className="edp-section">
        <p className="edp-section-label">Visitas</p>
        {visitas.map(v => {
          const data = v.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') ?? '—'
          return (
            <button
              key={v.id}
              className="edp-visit-row"
              onClick={() => navigate(`/visitas/${v.id}`)}
            >
              <span className="edp-visit-row__date">{data}</span>
              <span className={`edp-visit-row__badge status-${v.status}`}>
                {v.status === 'open' ? 'Aberta' : 'Encerrada'}
              </span>
            </button>
          )
        })}
      </section>
    </div>
  )
}

function DiffRow({ code, first, last, delta, total }) {
  const indicator = METAS_EI.flatMap(m => m.indicadores).find(i => i.code === code)
  const label     = indicator?.label ?? code
  const dateFirst = first.date?.toLocaleDateString?.('pt-BR') ?? '—'
  const dateLast  = last.date?.toLocaleDateString?.('pt-BR') ?? '—'
  const isFirst   = total === 1

  return (
    <div className={`edp-diff-row delta-${delta > 0 ? 'up' : delta < 0 ? 'down' : 'eq'}`}>
      <div className="edp-diff-row__header">
        <span className="edp-diff-row__code">{code}</span>
        <span className="edp-diff-row__label">{label}</span>
        {!isFirst && (
          <span className={`edp-diff-row__delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'eq'}`}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <div className="edp-diff-row__levels">
        <LevelPill level={first.level} date={dateFirst} label="Inicial" />
        {!isFirst && (
          <>
            <span className="edp-diff-row__arrow">→</span>
            <LevelPill level={last.level} date={dateLast} label="Atual" />
          </>
        )}
      </div>
    </div>
  )
}

function LevelPill({ level, date, label }) {
  return (
    <div className="edp-level-pill">
      <span className={`edp-level-pip level-${level}`}>{level}</span>
      <div className="edp-level-pill__info">
        <span className="edp-level-pill__desc">{DESCRIPTOR_LABELS[level]}</span>
        <span className="edp-level-pill__date">{label} · {date}</span>
      </div>
    </div>
  )
}
