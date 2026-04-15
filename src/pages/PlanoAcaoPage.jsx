// src/pages/PlanoAcaoPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { visitasService, sessoesService, responsesService } from '../services/visitasService'
import { planosService } from '../services/planosService'
import { getIndicadorByCode, DESCRIPTOR_LABELS } from '../services/indicadoresEI'
import NovoPlanModal from '../components/visitas/NovoPlanModal'
import PlanCard from '../components/visitas/PlanCard'
import './PlanoAcaoPage.css'

const STATUS_ORDER = { pending: 0, in_progress: 1, done: 2 }

export default function PlanoAcaoPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [visita,    setVisita]    = useState(null)
  const [planos,    setPlanos]    = useState([])
  const [sugestoes, setSugestoes] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPlan,  setEditPlan]  = useState(null)

  useEffect(() => { carregar() }, [visitId])

  async function carregar() {
    const [v, sessoes, planosExist] = await Promise.all([
      visitasService.buscar(visitId),
      sessoesService.listar(visitId),
      planosService.listarPorVisita(visitId),
    ])
    setVisita(v)
    setPlanos(planosExist)

    const submitted = sessoes.filter(s => s.status === 'submitted')
    const respostasMap = {}
    await Promise.all(
      submitted.map(async s => {
        const r = await responsesService.listar(visitId, s.id)
        Object.entries(r).forEach(([code, data]) => {
          if (!respostasMap[code] || data.descriptorLevel < respostasMap[code].descriptorLevel) {
            respostasMap[code] = { ...data, sessionId: s.id }
          }
        })
      })
    )

    const codigosComPlano = new Set(planosExist.map(p => p.indicatorCode))
    const sugs = Object.entries(respostasMap)
      .filter(([code, r]) => r.descriptorLevel <= 2 && !codigosComPlano.has(code))
      .map(([code, r]) => ({ code, ...r, indicador: getIndicadorByCode(code) }))
      .filter(s => s.indicador)
    setSugestoes(sugs)
    setLoading(false)
  }

  async function handleSalvar(dados) {
    if (editPlan) {
      await planosService.atualizar(visitId, editPlan.id, dados)
    } else {
      await planosService.criar({
        visitId,
        ciId: user.uid,         // ← corrigido: user.uid (Auth) em vez de profile.uid
        ciName: profile?.name ?? user.displayName,
        ...dados,
      })
    }
    setShowModal(false)
    setEditPlan(null)
    await carregar()
  }

  async function handleStatus(planId, status) {
    await planosService.atualizarStatus(visitId, planId, status)
    setPlanos(prev => prev.map(p => p.id === planId ? { ...p, status } : p))
  }

  function abrirNovo(prefill = null) {
    setEditPlan(prefill ? { ...prefill, _prefill: true } : null)
    setShowModal(true)
  }

  if (loading) return <div className="pap-loading"><div className="spinner" /></div>

  const sorted = [...planos].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  const porStatus = {
    pending:     sorted.filter(p => p.status === 'pending'),
    in_progress: sorted.filter(p => p.status === 'in_progress'),
    done:        sorted.filter(p => p.status === 'done'),
  }

  return (
    <div className="pap-root">
      <header className="pap-header">
        <button className="pap-back" onClick={() => navigate(`/visitas/${visitId}`)}>←</button>
        <div className="pap-header__info">
          <h1>{visita?.schoolName}</h1>
          <span>Planos de ação</span>
        </div>
        <button className="btn-primary pap-header__add" onClick={() => abrirNovo()}>
          + Novo
        </button>
      </header>

      {sugestoes.length > 0 && (
        <section className="pap-sugestoes">
          <p className="pap-section-label">Indicadores com nível crítico — criar plano</p>
          <div className="pap-sugestoes__list">
            {sugestoes.map(s => (
              <button key={s.code} className="pap-sug-pill" onClick={() => abrirNovo({
                indicatorCode:  s.code,
                indicatorLabel: s.indicador.label,
                metaCode:       s.indicador.meta.code,
                descriptorLevel: s.descriptorLevel,
                observation:    s.observation ?? '',
              })}>
                <span className="pap-sug-pill__code">{s.code}</span>
                <span className="pap-sug-pill__label">{s.indicador.label}</span>
                <span className="pap-sug-pill__level">
                  Nível {s.descriptorLevel} — {DESCRIPTOR_LABELS[s.descriptorLevel]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <main className="pap-main">
        {planos.length === 0 ? (
          <p className="pap-empty">Nenhum plano criado ainda.</p>
        ) : (
          <>
            {['pending', 'in_progress', 'done'].map(st => {
              const grupo = porStatus[st]
              if (grupo.length === 0) return null
              const labels = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído' }
              return (
                <section key={st} className="pap-group">
                  <p className={`pap-section-label status-${st}`}>{labels[st]} ({grupo.length})</p>
                  {grupo.map(p => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      onStatusChange={s => handleStatus(p.id, s)}
                      onEdit={() => { setEditPlan(p); setShowModal(true) }}
                    />
                  ))}
                </section>
              )
            })}
          </>
        )}
      </main>

      {showModal && (
        <NovoPlanModal
          visitId={visitId}
          schoolId={visita?.schoolId}
          schoolName={visita?.schoolName}
          cre={visita?.cre}
          prefill={editPlan?._prefill ? editPlan : null}
          initialData={!editPlan?._prefill ? editPlan : null}
          onSalvar={handleSalvar}
          onClose={() => { setShowModal(false); setEditPlan(null) }}
        />
      )}
    </div>
  )
}
