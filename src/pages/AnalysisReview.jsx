// src/pages/AnalysisReview.jsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analysesService, elementResultsService } from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  AlertCircle, AlertTriangle, CheckCircle2, MinusCircle,
  ChevronLeft, ChevronRight, SkipForward, MessageSquare,
  ThumbsUp, ThumbsDown, FileText, RefreshCw, ArrowLeft
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import './AnalysisReview.css'

// ─── Constantes ──────────────────────────────────────────────────────────────

const BLOCKS = [
  { code: 'B1', label: 'Pré-textuais' },
  { code: 'B2', label: 'Identidade' },
  { code: 'B3', label: 'Planejamento' },
  { code: 'B4', label: 'Ensino Médio' },
  { code: 'B5', label: 'Projetos' },
  { code: 'B6', label: 'Avaliação' },
  { code: 'B7', label: 'Profissionais' },
  { code: 'B8', label: 'Gestão' },
  { code: 'B9', label: 'Pós-textuais' },
]

const STATUS_CONFIG = {
  critical:       { icon: AlertCircle,   color: 'critical',  label: 'Crítico',        borderColor: 'var(--red-500)' },
  attention:      { icon: AlertTriangle, color: 'attention', label: 'Atenção',         borderColor: 'var(--amber-500)' },
  adequate:       { icon: CheckCircle2,  color: 'adequate',  label: 'Adequado',        borderColor: 'var(--green-500)' },
  overridden:     { icon: ThumbsUp,      color: 'overridden',label: 'Rev. analista',   borderColor: 'var(--blue-500)' },
  not_applicable: { icon: MinusCircle,   color: 'gray',      label: 'N/A',             borderColor: 'var(--gray-300)' },
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AnalysisReview() {
  const { analysisId } = useParams()
  const { user } = useAuth()

  const [analysis,  setAnalysis]  = useState(null)
  const [elements,  setElements]  = useState([])
  const [activeBlock, setActiveBlock] = useState('B1')
  const [activeIdx,   setActiveIdx]   = useState(0)
  const [submitting,  setSubmitting]  = useState(false)
  const [comment,     setComment]     = useState('')
  const [showComment, setShowComment] = useState(false)
  const [loading, setLoading] = useState(true)

  // Escuta tempo real
  useEffect(() => {
    if (!analysisId) return
    const unsubA = analysesService.subscribe(analysisId, setAnalysis)
    const unsubE = elementResultsService.subscribe(analysisId, elems => {
      const sorted = [...elems].sort((a, b) => {
        const ba = a.blockCode || ''; const bb = b.blockCode || ''
        if (ba !== bb) return ba.localeCompare(bb)
        return (a.elementId || '').localeCompare(b.elementId || '')
      })
      setElements(sorted)
      setLoading(false)
    })
    return () => { unsubA(); unsubE() }
  }, [analysisId])

  // Elementos do bloco ativo
  const blockElements = elements.filter(e => e.blockCode === activeBlock)
  const currentElement = blockElements[activeIdx] || null

  // Quando muda bloco, reseta índice
  const handleBlockChange = (code) => {
    setActiveBlock(code)
    setActiveIdx(0)
    setComment('')
    setShowComment(false)
  }

  // Navegar dentro do bloco
  const goNext = useCallback(() => {
    if (activeIdx < blockElements.length - 1) {
      setActiveIdx(i => i + 1)
      setComment(''); setShowComment(false)
    } else {
      // Avança para próximo bloco
      const idx = BLOCKS.findIndex(b => b.code === activeBlock)
      if (idx < BLOCKS.length - 1) {
        handleBlockChange(BLOCKS[idx + 1].code)
      }
    }
  }, [activeIdx, blockElements.length, activeBlock])

  const goPrev = useCallback(() => {
    if (activeIdx > 0) {
      setActiveIdx(i => i - 1)
      setComment(''); setShowComment(false)
    }
  }, [activeIdx])

  // Submete revisão
  const submitReview = async (decision) => {
    if (!currentElement || submitting) return
    setSubmitting(true)
    try {
      await elementResultsService.submitReview({
        analysisId,
        elementId: currentElement.elementId,
        decision,
        comment: comment.trim() || null,
      })
      toast.success(decision === 'agree' ? 'Análise confirmada' : 'Marcado como revisado')
      setComment(''); setShowComment(false)
      goNext()
    } catch {
      toast.error('Erro ao salvar revisão')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !analysis) {
    return <div className="page-loader"><div className="spinner"/></div>
  }

  const stats = analysis.stats || {}
  const progressPct = stats.total ? Math.round((stats.confirmed / stats.total) * 100) : 0

  return (
    <div className="review-layout">

      {/* ── Cabeçalho ────────────────────────────────────────────── */}
      <header className="review-header">
        <div className="review-header-left">
          <Link to="/analyses" className="back-link">
            <ArrowLeft size={15}/> Análises
          </Link>
          <div>
            <h1 className="review-school">{analysis.schoolName}</h1>
            <p className="review-meta">{analysis.cre} · PPP {analysis.year}</p>
          </div>
        </div>

        <div className="review-header-right">
          {/* Stats compactos */}
          <div className="header-stats">
            {stats.critical > 0 && (
              <span className="hstat critical">{stats.critical} 🔴</span>
            )}
            {stats.attention > 0 && (
              <span className="hstat attention">{stats.attention} 🟡</span>
            )}
            <span className="hstat adequate">{stats.adequate} 🟢</span>
          </div>

          {/* Progress bar */}
          <div className="header-progress">
            <div className="hpbar">
              <div className="hpfill" style={{ width: `${progressPct}%` }}/>
            </div>
            <span className="hptext">{stats.confirmed}/{stats.total}</span>
          </div>

          <Link to={`/analyses/${analysisId}/report`} className="btn-secondary">
            <FileText size={15}/> Gerar parecer
          </Link>
        </div>
      </header>

      <div className="review-body">

        {/* ── Navegação por blocos ─────────────────────────────────── */}
        <nav className="block-nav">
          {BLOCKS.map(b => {
            const blockElems = elements.filter(e => e.blockCode === b.code)
            if (blockElems.length === 0) return null
            const pending  = blockElems.filter(e => e.humanReview?.status === 'pending').length
            const hasCrit  = blockElems.some(e => e.effectiveStatus === 'critical')

            return (
              <button
                key={b.code}
                className={`block-btn ${activeBlock === b.code ? 'active' : ''} ${hasCrit ? 'has-critical' : ''}`}
                onClick={() => handleBlockChange(b.code)}
              >
                <span className="block-code">{b.code}</span>
                <span className="block-label">{b.label}</span>
                {pending > 0 && <span className="block-badge">{pending}</span>}
              </button>
            )
          })}
        </nav>

        {/* ── Painel central ───────────────────────────────────────── */}
        <div className="review-main">

          {/* Lista lateral de elementos do bloco */}
          <div className="elements-sidebar">
            <p className="elements-sidebar-title">{BLOCKS.find(b=>b.code===activeBlock)?.label}</p>
            {blockElements.map((el, i) => {
              const cfg = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
              const Icon = cfg.icon
              return (
                <button
                  key={el.elementId}
                  className={`element-item ${i === activeIdx ? 'active' : ''}`}
                  onClick={() => { setActiveIdx(i); setComment(''); setShowComment(false) }}
                >
                  <Icon size={14} className={`element-status-icon status-${cfg.color}`}/>
                  <span className="element-item-label">{el.label}</span>
                  {el.humanReview?.status === 'pending' && (
                    <span className="element-pending-dot"/>
                  )}
                </button>
              )
            })}
          </div>

          {/* Card do elemento */}
          {currentElement ? (
            <ElementCard
              element={currentElement}
              submitting={submitting}
              comment={comment}
              setComment={setComment}
              showComment={showComment}
              setShowComment={setShowComment}
              onAgree={() => submitReview('agree')}
              onDisagree={() => submitReview('disagree')}
              onSkip={goNext}
              onPrev={goPrev}
              onNext={goNext}
              hasPrev={activeIdx > 0}
              hasNext={activeIdx < blockElements.length - 1}
              position={`${activeIdx + 1} / ${blockElements.length}`}
            />
          ) : (
            <div className="no-elements">Nenhum elemento neste bloco.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ElementCard ─────────────────────────────────────────────────────────────

function ElementCard({
  element: el,
  submitting, comment, setComment, showComment, setShowComment,
  onAgree, onDisagree, onSkip, onPrev, onNext, hasPrev, hasNext, position,
}) {
  const cfg     = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
  const aiCfg   = STATUS_CONFIG[el.aiResult?.status] || STATUS_CONFIG.adequate
  const Icon    = cfg.icon
  const AiIcon  = aiCfg.icon
  const reviewed = el.humanReview?.status !== 'pending'

  return (
    <div className="element-card animate-fade-in" style={{ borderTopColor: cfg.borderColor }}>

      {/* Topo: status + título */}
      <div className="ec-top">
        <div className="ec-badges">
          <span className={`status-pill status-${cfg.color}`}>
            <Icon size={13}/> {cfg.label}
          </span>
          {el.isNewIn2026 && <span className="new-badge">NOVO 2026</span>}
          {el.isCritical  && <span className="critical-badge">Obrigatório</span>}
          {reviewed && el.humanReview.status === 'overridden' && (
            <span className="override-badge">Revisado pelo analista</span>
          )}
        </div>
        <p className="ec-nav-pos">{position}</p>
      </div>

      <h2 className="ec-title">{el.label}</h2>
      <p className="ec-normref">{el.normRef}</p>

      {/* Análise da IA */}
      <div className={`ec-ai-block ai-${aiCfg.color}`}>
        <div className="ec-ai-header">
          <AiIcon size={14}/>
          <span>Análise da IA</span>
          <span className="ai-score">{Math.round((el.aiResult?.score || 0) * 100)}% confiança</span>
        </div>
        <p className="ec-ai-summary">{el.aiResult?.summary || '—'}</p>

        {/* Trechos localizados */}
        {el.aiResult?.excerpts?.length > 0 && (
          <div className="ec-excerpts">
            <p className="ec-excerpts-label">Trecho localizado no documento:</p>
            {el.aiResult.excerpts.map((ex, i) => (
              <blockquote key={i} className="ec-excerpt">
                <span className="ec-excerpt-section">{ex.section}</span>
                <p>"{ex.text}"</p>
              </blockquote>
            ))}
          </div>
        )}

        {/* Referências legais faltantes */}
        {el.aiResult?.legalRefs?.missing?.length > 0 && (
          <div className="ec-missing-refs">
            <AlertCircle size={12}/>
            <span>Referências legais ausentes: {el.aiResult.legalRefs.missing.join(', ')}</span>
          </div>
        )}

        {/* Itens ausentes */}
        {el.aiResult?.missingItems?.length > 0 && (
          <ul className="ec-missing-list">
            {el.aiResult.missingItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Comentário do analista (se já revisado) */}
      {reviewed && el.humanReview?.comment && (
        <div className="ec-analyst-comment">
          <MessageSquare size={13}/>
          <p>{el.humanReview.comment}</p>
        </div>
      )}

      {/* Comparativo 2025 */}
      {el.comparison2025?.delta && el.comparison2025.delta !== 'same' && (
        <div className={`ec-delta delta-${el.comparison2025.delta}`}>
          {el.comparison2025.delta === 'improved'  && '↑ Melhorou em relação a 2025'}
          {el.comparison2025.delta === 'regressed' && '↓ Piorou em relação a 2025'}
          {el.comparison2025.delta === 'new'       && '★ Elemento novo em 2026'}
        </div>
      )}

      {/* Ações do analista */}
      {!reviewed ? (
        <div className="ec-actions">
          <div className="ec-actions-primary">
            <button
              className="btn-agree"
              onClick={onAgree}
              disabled={submitting}
            >
              <ThumbsUp size={15}/>
              Confirmar análise da IA
            </button>
            <button
              className="btn-disagree"
              onClick={onDisagree}
              disabled={submitting}
            >
              <ThumbsDown size={15}/>
              Discordar — elemento adequado
            </button>
          </div>

          <div className="ec-actions-secondary">
            <button
              className="btn-comment-toggle"
              onClick={() => setShowComment(v => !v)}
            >
              <MessageSquare size={13}/>
              {showComment ? 'Ocultar' : 'Adicionar comentário'}
            </button>
            <button className="btn-ghost" onClick={onSkip}>
              <SkipForward size={13}/> Pular
            </button>
          </div>

          {showComment && (
            <textarea
              className="ec-comment-input"
              placeholder="Descreva sua observação sobre este elemento…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
            />
          )}
        </div>
      ) : (
        <div className="ec-reviewed-state">
          <CheckCircle2 size={15} className="text-green"/>
          <span>
            Revisado como <strong>
              {el.humanReview.decision === 'agree' ? 'confirmado' : 'revisado pelo analista'}
            </strong>
          </span>
        </div>
      )}

      {/* Navegação */}
      <div className="ec-nav">
        <button className="btn-ghost" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft size={15}/> Anterior
        </button>
        <button
          className={`btn-ghost ${hasNext ? '' : 'muted'}`}
          onClick={onNext}
        >
          Próximo <ChevronRight size={15}/>
        </button>
      </div>
    </div>
  )
}
