// src/pages/AnalysisList.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analysesService } from '../services/firebase'
import { Plus, ArrowRight } from 'lucide-react'
import './Dashboard.css'

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
          <p className="page-sub">{analyses.length} análise{analyses.length !== 1 ? 's' : ''} · {profile?.cre}</p>
        </div>
        <Link to="/analyses/new" className="btn-primary">
          <Plus size={16}/> Nova análise
        </Link>
      </div>
      <div className="analyses-list">
        {analyses.map(a => (
          <Link key={a.id} to={`/analyses/${a.id}`} className="analysis-row animate-fade-in">
            <div className="row-school">
              <p className="school-name">{a.schoolName}</p>
              <p className="school-cre">{a.cre}</p>
            </div>
            <div className="row-stats">
              {a.stats?.critical  > 0 && <span className="stat-badge critical">{a.stats.critical} crítico{a.stats.critical!==1?'s':''}</span>}
              {a.stats?.attention > 0 && <span className="stat-badge attention">{a.stats.attention} atenção</span>}
              <span className="stat-badge adequate">{a.stats?.adequate||0} ok</span>
            </div>
            <div className="row-progress">
              <div className="mini-bar">
                <div className="mini-fill" style={{width:`${a.stats?.total?(a.stats.confirmed/a.stats.total)*100:0}%`}}/>
              </div>
              <span className="progress-label">{a.stats?.confirmed||0}/{a.stats?.total||0}</span>
            </div>
            <ArrowRight size={15} className="row-arrow"/>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// src/pages/ReportPage.jsx  — geração do parecer final
// (stub — será expandido na próxima iteração)
// ────────────────────────────────────────────────────────────────────────────
// export default function ReportPage() { ... }
// Exportado separadamente abaixo para o App.jsx conseguir importar

export function ReportPage() {
  const { analysisId } = require('react-router-dom').useParams ? require('react-router-dom').useParams() : {}
  return (
    <div className="page">
      <h1 className="page-title">Gerar Parecer</h1>
      <p className="page-sub">Em construção — análise ID: {analysisId}</p>
    </div>
  )
}
