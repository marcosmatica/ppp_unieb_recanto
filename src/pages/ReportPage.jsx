// src/pages/ReportPage.jsx
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './Dashboard.css'

export default function ReportPage() {
  const { analysisId } = useParams()
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to={`/analyses/${analysisId}`} className="back-link" style={{display:'flex',alignItems:'center',gap:5,fontSize:12.5,color:'var(--gray-400)',marginBottom:8}}>
            <ArrowLeft size={14}/> Voltar para revisão
          </Link>
          <h1 className="page-title">Gerar Parecer</h1>
          <p className="page-sub">Compilado de pendências e documento final</p>
        </div>
      </div>
      <div style={{background:'var(--white)',border:'1px dashed var(--gray-300)',borderRadius:'var(--radius-lg)',padding:48,textAlign:'center',color:'var(--gray-400)'}}>
        <p>Módulo de geração de parecer — próxima iteração.</p>
        <p style={{fontSize:12,marginTop:8}}>Será gerado um .docx com todas as pendências consolidadas.</p>
      </div>
    </div>
  )
}
