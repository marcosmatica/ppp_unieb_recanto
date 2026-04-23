// src/pages/AnalysisList.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analysesService } from '../services/firebase'
import { Plus, ArrowRight, FolderOpen } from 'lucide-react'
import './AnalysisList.css'

export default function AnalysisList() {
  const { profile } = useAuth()
  const [analyses, setAnalyses] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!profile) return
    analysesService.getByCRE(profile.cre).then(d => { setAnalyses(d); setLoading(false) })
  }, [profile])

  if (loading) return <div className="page-loader"><div className="spinner"/></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Análises</h1>
          <p className="page-sub">
            {analyses.length} análise{analyses.length !== 1 ? 's' : ''} · {profile?.cre}
          </p>
        </div>
        <Link to="/analyses/new" className="btn-primary">
          <Plus size={16}/> Nova análise
        </Link>
      </div>

      {analyses.length === 0 ? (
        <div className="analyses-empty">
          <div className="analyses-empty__icon">
            <FolderOpen size={26} />
          </div>
          <p className="analyses-empty__title">Nenhuma análise cadastrada</p>
          <p className="analyses-empty__text">
            Comece uma nova análise enviando o PPP da escola para verificação automática.
          </p>
          <Link to="/analyses/new" className="btn-primary">
            <Plus size={16}/> Iniciar primeira análise
          </Link>
        </div>
      ) : (
        <div className="analyses-list">
          {analyses.map(a => {
            const total = a.stats?.total || 0
            const confirmed = a.stats?.confirmed || 0
            const pct = total > 0 ? (confirmed / total) * 100 : 0
            return (
              <Link
                key={a.id}
                to={`/analyses/${a.id}`}
                className="analysis-row animate-fade-in"
              >
                <div className="row-school">
                  <p className="school-name">{a.schoolName}</p>
                  <p className="school-cre">{a.cre}</p>
                </div>
                <div className="row-stats">
                  {a.stats?.critical > 0 && (
                    <span className="stat-badge critical">
                      {a.stats.critical} crítico{a.stats.critical !== 1 ? 's' : ''}
                    </span>
                  )}
                  {a.stats?.attention > 0 && (
                    <span className="stat-badge attention">
                      {a.stats.attention} atenção
                    </span>
                  )}
                  <span className="stat-badge adequate">
                    {a.stats?.adequate || 0} ok
                  </span>
                </div>
                <div className="row-progress">
                  <div className="mini-bar">
                    <div className="mini-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="progress-label">{confirmed}/{total}</span>
                </div>
                <ArrowRight size={16} className="row-arrow"/>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
