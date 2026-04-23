// src/pages/SessaoPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sessoesService, responsesService } from '../services/visitasService'
import { getIndicadoresDasMetas } from '../services/indicadoresEI'
import OfflineBanner from '../components/visitas/OfflineBanner'
import IndicadorCard from '../components/visitas/IndicadorCard'
import './SessaoPage.css'

function ConfirmModal({ faltando, onConfirm, onCancel }) {
  return (
    <div className="sp-modal-overlay">
      <div className="sp-modal">
        <p className="sp-modal__text">
          {faltando} indicador{faltando !== 1 ? 'es' : ''} sem nível marcado.
          Deseja finalizar assim mesmo?
        </p>
        <div className="sp-modal__actions">
          <button className="btn-secondary" onClick={onCancel}>Voltar</button>
          <button className="btn-primary" onClick={onConfirm}>Finalizar</button>
        </div>
      </div>
    </div>
  )
}

function computeIndicatorProgress(indicador, resposta) {
  const total = indicador.parametros.length
  const paramLevels = resposta?.paramLevels ?? {}
  const paramsDone = Object.values(paramLevels).filter(v => typeof v === 'number').length
  const hasIndLevel = !!resposta?.descriptorLevel
  const pctParams = total > 0 ? paramsDone / total : 0
  const progresso = (pctParams * 0.7) + (hasIndLevel ? 0.3 : 0)
  const completo = paramsDone === total && hasIndLevel
  return { paramsDone, total, progresso, completo, hasIndLevel }
}

function computeIndicatorXP(indicador, resposta) {
  if (!resposta) return 0
  const paramLevels = resposta.paramLevels ?? {}
  const paramsDone = Object.values(paramLevels).filter(v => typeof v === 'number').length
  let xp = paramsDone * 10
  if (resposta.descriptorLevel) xp += 20
  if ((resposta.observation ?? '').trim().length >= 20) xp += 15
  if ((resposta.evidenceUrls ?? []).length > 0) xp += 25
  return xp
}

export default function SessaoPage() {
  const { visitId, sessionId } = useParams()
  const navigate = useNavigate()

  const [sessao, setSessao] = useState(null)
  const [respostas, setRespostas] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [activeIdx, setActiveIdx] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    Promise.all([
      sessoesService.listar(visitId).then(list => list.find(s => s.id === sessionId)),
      responsesService.listar(visitId, sessionId),
    ]).then(([s, r]) => {
      setSessao(s)
      setRespostas(r)
      setLoading(false)
    })
  }, [visitId, sessionId])

  useEffect(() => {
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const indicadores = sessao ? getIndicadoresDasMetas(sessao.metasCodes ?? []) : []
  const total       = indicadores.length
  const preenchidos = indicadores.filter(ind => respostas[ind.code]?.descriptorLevel).length

  const { totalXP, progressoGeral } = useMemo(() => {
    let xpSum = 0
    let progSum = 0
    indicadores.forEach(ind => {
      xpSum  += computeIndicatorXP(ind, respostas[ind.code])
      progSum += computeIndicatorProgress(ind, respostas[ind.code] ?? {}).progresso
    })
    return {
      totalXP: xpSum,
      progressoGeral: total > 0 ? progSum / total : 0,
    }
  }, [indicadores, respostas, total])

  function handleChange(indicatorCode, field, value) {
    setRespostas(prev => ({
      ...prev,
      [indicatorCode]: { ...(prev[indicatorCode] ?? {}), [field]: value },
    }))
  }

  async function salvarRespostas() {
    await Promise.all(
      Object.entries(respostas).map(([code, data]) =>
        responsesService.salvar(visitId, sessionId, code, data)
      )
    )
  }

  async function handleSalvar() {
    if (!isOnline) return
    setSaving(true)
    try { await salvarRespostas() }
    finally { setSaving(false) }
  }

  function handleSubmeterClick() {
    if (!isOnline) return
    if (preenchidos < total) {
      setShowConfirm(true)
    } else {
      executarSubmissao()
    }
  }

  async function executarSubmissao() {
    setShowConfirm(false)
    setSaving(true)
    try {
      await salvarRespostas()
      await sessoesService.submeter(visitId, sessionId)
      navigate(`/visitas/${visitId}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="sp-loading"><div className="spinner" /></div>

  const ind = indicadores[activeIdx]

  return (
    <div className="sp-root">
      <OfflineBanner isOnline={isOnline} />

      {showConfirm && (
        <ConfirmModal
          faltando={total - preenchidos}
          onConfirm={executarSubmissao}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <header className="sp-header">
        <button className="sp-back" onClick={() => navigate(`/visitas/${visitId}`)}>←</button>
        <div className="sp-header__info">
          <span className="sp-header__date">
            {sessao?.date?.toDate?.()?.toLocaleDateString('pt-BR')}
          </span>
          <span className="sp-header__metas">
            Metas: {(sessao?.metasCodes ?? []).join(', ')}
          </span>
        </div>
        <div className="sp-header__stats">
          <span className="sp-header__xp">⚡ {totalXP}</span>
          <span className="sp-header__count">{preenchidos}/{total}</span>
        </div>
      </header>

      <div className="sp-progressbar">
        <div
          className="sp-progressbar__fill"
          style={{ width: `${progressoGeral * 100}%` }}
        />
      </div>

      <nav className="sp-nav">
        {indicadores.map((ind, i) => {
          const prog = computeIndicatorProgress(ind, respostas[ind.code] ?? {})
          return (
            <button
              key={ind.code}
              className={`sp-nav__pill ${i === activeIdx ? 'active' : ''} ${prog.completo ? 'done' : ''} ${prog.progresso > 0 && !prog.completo ? 'partial' : ''}`}
              onClick={() => setActiveIdx(i)}
              title={`${ind.code} — ${prog.paramsDone}/${prog.total} parâmetros`}
            >
              <span className="sp-nav__pill-code">{ind.code}</span>
              {prog.progresso > 0 && !prog.completo && (
                <span className="sp-nav__pill-ring" style={{ '--p': `${prog.progresso * 100}%` }} />
              )}
              {prog.completo && <span className="sp-nav__pill-check">✓</span>}
            </button>
          )
        })}
      </nav>

      <main className="sp-main">
        {ind && (
          <IndicadorCard
            key={ind.code}
            indicador={ind}
            resposta={respostas[ind.code] ?? {}}
            onChange={(field, value) => handleChange(ind.code, field, value)}
            visitId={visitId}
            sessionId={sessionId}
          />
        )}
      </main>

      <div className="sp-nav-btns">
        <button className="sp-nav-btn" disabled={activeIdx === 0} onClick={() => setActiveIdx(i => i - 1)}>
          ← Anterior
        </button>
        <button className="sp-nav-btn" disabled={activeIdx === total - 1} onClick={() => setActiveIdx(i => i + 1)}>
          Próximo →
        </button>
      </div>

      <footer className="sp-footer">
        <button
          className="btn-secondary sp-footer__save"
          onClick={handleSalvar}
          disabled={saving || !isOnline}
        >
          {saving ? <span className="spinner-sm" /> : 'Salvar rascunho'}
        </button>
        <button
          className="btn-primary sp-footer__submit"
          onClick={handleSubmeterClick}
          disabled={saving || !isOnline}
        >
          {saving ? <span className="spinner-sm" /> : 'Finalizar sessão'}
        </button>
      </footer>
    </div>
  )
}
