// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analysesService } from '../services/firebase'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertCircle, Clock, CheckCircle2,
  TrendingUp, School, Plus, ArrowRight
} from 'lucide-react'
import './Dashboard.css'

const STATUS_LABEL = {
  pending:     { label: 'Aguardando IA',  color: 'gray' },
  in_progress: { label: 'Em revisão',     color: 'blue' },
  review:      { label: 'Para supervisão',color: 'amber' },
  approved:    { label: 'Aprovado',        color: 'green' },
  rejected:    { label: 'Reprovado',       color: 'red' },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [analyses, setAnalyses] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!profile) return
    const fetch = async () => {
      const data = await analysesService.getByCRE(profile.cre)
      setAnalyses(data)
      setLoading(false)
    }
    fetch()
  }, [profile])

  // Agregados
  const total    = analyses.length
  const critical = analyses.reduce((s, a) => s + (a.stats?.critical || 0), 0)
  const pending  = analyses.filter(a => a.status === 'in_progress').length
  const done     = analyses.filter(a => ['approved','rejected'].includes(a.status)).length

  if (loading) return <PageLoader />

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="page-sub">
            {profile?.cre} · Ano letivo 2026
          </p>
        </div>
        <Link to="/analyses/new" className="btn-primary">
          <Plus size={16} /> Nova análise
        </Link>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard icon={School}        color="blue"  label="Escolas"          value={total}    />
        <KPICard icon={Clock}         color="amber" label="Em revisão"       value={pending}  />
        <KPICard icon={AlertCircle}   color="red"   label="Itens críticos"   value={critical} />
        <KPICard icon={CheckCircle2}  color="green" label="Concluídas"       value={done}     />
      </div>

      {/* Lista de análises recentes */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Análises recentes</h2>
          <Link to="/analyses" className="see-all">Ver todas <ArrowRight size={13}/></Link>
        </div>

        <div className="analyses-list">
          {analyses.slice(0, 8).map(a => (
            <AnalysisRow key={a.id} analysis={a} />
          ))}
          {analyses.length === 0 && (
            <div className="empty-state">
              <School size={32} className="empty-icon"/>
              <p>Nenhuma análise ainda.</p>
              <Link to="/analyses/new" className="btn-primary small">
                <Plus size={14}/> Criar primeira análise
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon: Icon, color, label, value }) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-icon"><Icon size={20} /></div>
      <div>
        <p className="kpi-value">{value}</p>
        <p className="kpi-label">{label}</p>
      </div>
    </div>
  )
}

function AnalysisRow({ analysis: a }) {
  const st = STATUS_LABEL[a.status] || STATUS_LABEL.pending
  const ts = a.updatedAt?.toDate?.()

  return (
    <Link to={`/analyses/${a.id}`} className="analysis-row animate-fade-in">
      <div className="row-school">
        <p className="school-name">{a.schoolName}</p>
        <p className="school-cre">{a.cre}</p>
      </div>

      <div className="row-stats">
        {a.stats?.critical > 0 && (
          <span className="stat-badge critical">{a.stats.critical} crítico{a.stats.critical !== 1 ? 's' : ''}</span>
        )}
        {a.stats?.attention > 0 && (
          <span className="stat-badge attention">{a.stats.attention} atenção</span>
        )}
        <span className="stat-badge adequate">{a.stats?.adequate || 0} ok</span>
      </div>

      <div className="row-progress">
        <div className="mini-bar">
          <div
            className="mini-fill"
            style={{ width: `${a.stats?.total ? (a.stats.confirmed / a.stats.total) * 100 : 0}%` }}
          />
        </div>
        <span className="progress-label">
          {a.stats?.confirmed || 0}/{a.stats?.total || 0}
        </span>
      </div>

      <span className={`status-chip status-${st.color}`}>{st.label}</span>

      {ts && (
        <span className="row-time">
          {formatDistanceToNow(ts, { locale: ptBR, addSuffix: true })}
        </span>
      )}
      <ArrowRight size={15} className="row-arrow" />
    </Link>
  )
}

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  )
}
