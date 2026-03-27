// src/pages/ReportPage.jsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analysesService, elementResultsService, functions } from '../services/firebase'  // ← importe functions
import { httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import {
  ArrowLeft, FileDown, CheckCircle2, AlertCircle,
  AlertTriangle, Loader2, ThumbsUp, ClipboardList
} from 'lucide-react'
import './ReportPage.css'

const STATUS_CFG = {
  critical:   { label: 'Crítico',           icon: AlertCircle,   color: 'critical'  },
  attention:  { label: 'Atenção',            icon: AlertTriangle, color: 'attention' },
  adequate:   { label: 'Adequado',           icon: CheckCircle2,  color: 'adequate'  },
  overridden: { label: 'Rev. pelo analista', icon: ThumbsUp,      color: 'overridden'},
}

const BLOCK_LABELS = {
  B1:'Pré-textuais', B2:'Identidade',    B3:'Planejamento',
  B4:'Ensino Médio', B5:'Projetos',      B6:'Avaliação',
  B7:'Profissionais',B8:'Gestão',        B9:'Pós-textuais',
}

export default function ReportPage() {
  const { analysisId } = useParams()
  const [analysis,   setAnalysis]   = useState(null)
  const [elements,   setElements]   = useState([])
  const [notes,      setNotes]      = useState('')
  const [decision,   setDecision]   = useState(null)
  const [generating, setGenerating] = useState(false)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!analysisId) return
    const unsubA = analysesService.subscribe(analysisId, a => {
      setAnalysis(a)
      setNotes(a.finalReport?.analystNotes || '')
      setDecision(a.finalReport?.decision  || null)
    })
    const unsubE = elementResultsService.subscribe(analysisId, els => {
      setElements([...els].sort((a,b) =>
          (a.blockCode||'').localeCompare(b.blockCode||'') ||
          (a.elementId||'').localeCompare(b.elementId||'')))
      setLoading(false)
    })
    return () => { unsubA(); unsubE() }
  }, [analysisId])

  const grouped = elements.reduce((acc, el) => {
    const s = el.effectiveStatus
    if (!acc[s]) acc[s] = []
    acc[s].push(el)
    return acc
  }, {})

  const criticalList  = grouped.critical   || []
  const attentionList = grouped.attention  || []
  const adequateList  = grouped.adequate   || []
  const overrideList  = grouped.overridden || []
  const pending       = elements.filter(e => e.humanReview?.status === 'pending').length
  const hasCritical   = criticalList.length > 0

  // ✅ FUNÇÃO CORRIGIDA
  async function handleGenerate() {
    if (pending > 0) {
      toast.error(`${pending} elemento(s) ainda não revisados`)
      return
    }
    if (!decision) {
      toast.error('Selecione a decisão final')
      return
    }

    setGenerating(true)
    try {
      // ✅ Usando a instância exportada do firebase.js
      const generateReportFn = httpsCallable(functions, 'generateReport')
      const result = await generateReportFn({ analysisId, notes, decision })

      // ✅ O resultado vem dentro de result.data
      const { downloadUrl, fileName } = result.data

      // Download do arquivo
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName || `parecer_${analysis.schoolName.replace(/\s+/g, '_')}_${analysis.year}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      toast.success('Parecer gerado com sucesso!')
    } catch (err) {
      console.error('Erro detalhado:', err)
      toast.error('Erro ao gerar parecer: ' + (err.message || 'internal'))
    } finally {
      setGenerating(false)
    }
  }

  if (loading || !analysis) return <div className="page-loader"><div className="spinner"/></div>

  return (
      <div className="page">
        <div className="page-header">
          <div>
            <Link to={`/analyses/${analysisId}`} className="back-link-inline">
              <ArrowLeft size={14}/> Voltar para revisão
            </Link>
            <h1 className="page-title" style={{marginTop:6}}>Gerar Parecer</h1>
            <p className="page-sub">{analysis.schoolName} · PPP {analysis.year}</p>
          </div>
        </div>

        {pending > 0 && (
            <div className="report-warning">
              <AlertTriangle size={15}/>
              {pending} elemento{pending!==1?'s':''} ainda não revisado{pending!==1?'s':''}.
              Conclua a revisão antes de gerar o parecer.
            </div>
        )}

        <div className="report-grid">
          {/* Coluna esquerda: sumário */}
          <div className="report-summary-col">
            <div className="report-kpis">
              <div className="rk rk-critical">
                <span className="rk-n">{criticalList.length}</span>
                <span className="rk-l">Críticos</span>
              </div>
              <div className="rk rk-attention">
                <span className="rk-n">{attentionList.length}</span>
                <span className="rk-l">Atenção</span>
              </div>
              <div className="rk rk-adequate">
                <span className="rk-n">{adequateList.length}</span>
                <span className="rk-l">Adequados</span>
              </div>
              {overrideList.length > 0 && (
                  <div className="rk rk-overridden">
                    <span className="rk-n">{overrideList.length}</span>
                    <span className="rk-l">Revisados</span>
                  </div>
              )}
            </div>

            {/* Listas de elementos por status */}
            {['critical','attention'].map(status => {
              const list = grouped[status] || []
              if (!list.length) return null
              const cfg  = STATUS_CFG[status]
              const Icon = cfg.icon
              return (
                  <div key={status} className={`report-group group-${cfg.color}`}>
                    <div className="rgroup-header"><Icon size={14}/><span>{cfg.label} ({list.length})</span></div>
                    {list.map(el => (
                        <div key={el.elementId} className="rgroup-item">
                          <div className="rgi-label">{el.label}</div>
                          <div className="rgi-block">{BLOCK_LABELS[el.blockCode]||el.blockCode}</div>
                          {el.humanReview?.comment && (
                              <div className="rgi-comment">"{el.humanReview.comment}"</div>
                          )}
                          {el.aiResult?.missingItems?.length > 0 && (
                              <ul className="rgi-missing">
                                {el.aiResult.missingItems.map((m,i)=><li key={i}>{m}</li>)}
                              </ul>
                          )}
                        </div>
                    ))}
                  </div>
              )
            })}
          </div>

          {/* Coluna direita: decisão */}
          <div className="report-action-col">
            <div className="report-card">
              <div className="report-card-title"><ClipboardList size={16}/> Decisão final</div>

              <div className="decision-options">
                <button
                    className={`decision-btn ${decision==='approved_with_remarks' ? 'active-green' : ''}`}
                    onClick={() => setDecision('approved_with_remarks')}
                    disabled={generating}
                >
                  <CheckCircle2 size={16}/> Aprovado com ressalvas
                </button>
                <button
                    className={`decision-btn ${decision==='rejected' ? 'active-red' : ''}`}
                    onClick={() => setDecision('rejected')}
                    disabled={generating}
                >
                  <AlertCircle size={16}/> Reprovado
                </button>
              </div>

              {hasCritical && decision==='approved_with_remarks' && (
                  <p className="decision-warn">
                    Há {criticalList.length} elemento(s) crítico(s). A escola deverá
                    corrigi-los antes da publicação.
                  </p>
              )}

              <label className="notes-label">Observações do analista</label>
              <textarea
                  className="notes-input"
                  rows={6}
                  placeholder="Orientações gerais, prazos para reenvio ou comentários sobre o processo…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={generating}
              />

              <button
                  className={`btn-generate ${generating ? 'loading' : ''}`}
                  onClick={handleGenerate}
                  disabled={generating || pending > 0 || !decision}
              >
                {generating
                    ? <><Loader2 size={16} className="spin-icon"/> Gerando…</>
                    : <><FileDown size={16}/> Gerar e baixar parecer (.docx)</>
                }
              </button>

              <p className="generate-hint">
                O documento incluirá identificação da escola, sumário por criticidade,
                considerações por elemento e decisão final.
              </p>
            </div>
          </div>
        </div>
      </div>
  )}