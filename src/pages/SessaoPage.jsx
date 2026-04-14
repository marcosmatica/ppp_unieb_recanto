// src/pages/SessaoPage.jsx

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sessoesService, responsesService } from '../services/visitasService'
import { getIndicadoresDasMetas, DESCRIPTOR_LABELS } from '../services/indicadoresEI'
import OfflineBanner from '../components/visitas/OfflineBanner'
import IndicadorCard from '../components/visitas/IndicadorCard'
import './SessaoPage.css'

export default function SessaoPage() {
  const { visitId, sessionId } = useParams()
  const navigate = useNavigate()

  const [sessao, setSessao]       = useState(null)
  const [respostas, setRespostas] = useState({})
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [isOnline, setIsOnline]   = useState(navigator.onLine)
  const [activeIdx, setActiveIdx] = useState(0)

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
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const indicadores = sessao ? getIndicadoresDasMetas(sessao.metasCodes ?? []) : []
  const total       = indicadores.length
  const preenchidos = indicadores.filter(ind => respostas[ind.code]?.descriptorLevel).length

  function handleChange(indicatorCode, field, value) {
    setRespostas(prev => ({
      ...prev,
      [indicatorCode]: { ...(prev[indicatorCode] ?? {}), [field]: value },
    }))
  }

  async function handleSalvar() {
    if (!isOnline) return
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(respostas).map(([code, data]) =>
          responsesService.salvar(visitId, sessionId, code, data)
        )
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmeter() {
    if (!isOnline) return
    if (preenchidos < total) {
      if (!confirm(`${total - preenchidos} indicador(es) sem nível marcado. Submeter assim mesmo?`)) return
    }
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(respostas).map(([code, data]) =>
          responsesService.salvar(visitId, sessionId, code, data)
        )
      )
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
        <span className="sp-header__count">{preenchidos}/{total}</span>
      </header>

      <nav className="sp-nav">
        {indicadores.map((ind, i) => {
          const respondido = !!respostas[ind.code]?.descriptorLevel
          return (
            <button
              key={ind.code}
              className={`sp-nav__pill ${i === activeIdx ? 'active' : ''} ${respondido ? 'done' : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              {ind.code}
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
          />
        )}
      </main>

      <div className="sp-nav-btns">
        <button
          className="sp-nav-btn"
          disabled={activeIdx === 0}
          onClick={() => setActiveIdx(i => i - 1)}
        >
          ← Anterior
        </button>
        <button
          className="sp-nav-btn"
          disabled={activeIdx === total - 1}
          onClick={() => setActiveIdx(i => i + 1)}
        >
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
          onClick={handleSubmeter}
          disabled={saving || !isOnline}
        >
          {saving ? <span className="spinner-sm" /> : 'Finalizar sessão'}
        </button>
      </footer>
    </div>
  )
}
