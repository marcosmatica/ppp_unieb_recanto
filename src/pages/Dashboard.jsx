// src/pages/Dashboard.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analysesService } from '../services/firebase'
import { visitasService } from '../services/visitasService'
import './Dashboard.css'

export default function Dashboard() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()

  const [pppStats,    setPppStats]    = useState(null)
  const [visitasStats, setVisitasStats] = useState(null)

// correto
    useEffect(() => {
        if (!profile?.uid) return
        carregarPPP()
        carregarVisitas()
    }, [profile])

  async function carregarPPP() {
    try {
      const lista = profile.role === 'admin'
        ? await analysesService.getByCRE(profile.cre)
        : await analysesService.getByAnalyst(profile.uid)
      const pending  = lista.filter(a => a.status === 'pending' || a.status === 'analyzing').length
      const review   = lista.filter(a => a.status === 'review').length
      const done     = lista.filter(a => a.status === 'done').length
      setPppStats({ total: lista.length, pending, review, done })
    } catch { setPppStats({ total: 0, pending: 0, review: 0, done: 0 }) }
  }

  async function carregarVisitas() {
    try {
      const lista = await visitasService.listarPorCI(profile.uid)
      const abertas   = lista.filter(v => v.status === 'open').length
      const encerradas = lista.filter(v => v.status === 'closed').length
      setVisitasStats({ total: lista.length, abertas, encerradas })
    } catch { setVisitasStats({ total: 0, abertas: 0, encerradas: 0 }) }
  }

  return (
    <div className="dash-root">
      <div className="dash-greeting">
        <h1>Olá{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.</h1>
        <p>{profile?.cre} · Ano letivo 2026</p>
      </div>

      <div className="dash-modules">
        <ModuleCard
          title="Analisador de PPP"
          description="Análise e validação de Projetos Político-Pedagógicos"
          onClick={() => navigate('/analyses')}
          stats={pppStats ? [
            { label: 'Total',        value: pppStats.total,   },
            { label: 'Em revisão',   value: pppStats.review,  accent: 'warning' },
            { label: 'Concluídas',   value: pppStats.done,    accent: 'success' },
          ] : null}
          cta="Abrir PPP"
          color="blue"
          icon={<PppIcon />}
        />

        <ModuleCard
          title="Visitas — Educação Infantil"
          description="Monitoramento de indicadores de qualidade nas unidades"
          onClick={() => navigate('/visitas')}
          stats={visitasStats ? [
            { label: 'Total',        value: visitasStats.total   },
            { label: 'Em andamento', value: visitasStats.abertas, accent: 'warning' },
            { label: 'Encerradas',   value: visitasStats.encerradas, accent: 'success' },
          ] : null}
          cta="Abrir Visitas"
          color="teal"
          icon={<VisitasIcon />}
          secondaryAction={{ label: 'Dashboard', onClick: () => navigate('/visitas/dashboard') }}
        />
      </div>
    </div>
  )
}

function ModuleCard({ title, description, onClick, stats, cta, color, icon, secondaryAction }) {
  return (
    <div className={`mc-root mc-${color}`}>
      <div className="mc-top">
        <div className={`mc-icon mc-icon--${color}`}>{icon}</div>
        <div className="mc-info">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {stats ? (
        <div className="mc-stats">
          {stats.map(s => (
            <div key={s.label} className={`mc-stat ${s.accent ? `mc-stat--${s.accent}` : ''}`}>
              <span className="mc-stat__value">{s.value}</span>
              <span className="mc-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mc-stats mc-stats--loading">
          <div className="mc-skeleton" /><div className="mc-skeleton" /><div className="mc-skeleton" />
        </div>
      )}

      <div className="mc-actions">
        <button className={`mc-btn-primary mc-btn-primary--${color}`} onClick={onClick}>
          {cta}
        </button>
        {secondaryAction && (
          <button className="mc-btn-secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

function PppIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  )
}

function VisitasIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  )
}
