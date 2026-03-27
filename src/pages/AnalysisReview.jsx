// src/pages/AnalysisReview.jsx
//
// Estratégia 1: DocumentViewer ocupa a coluna central (dominante)
//               ElementCard fica na coluna direita como painel secundário
//
// Estratégia 4: Clique num mark no iframe abre MarkPopover inline
//               sobreposto ao documento, com resumo compacto da análise

import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analysesService, elementResultsService } from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import {
  AlertCircle, AlertTriangle, CheckCircle2, MinusCircle,
  ChevronLeft, ChevronRight, SkipForward, MessageSquare,
  ThumbsUp, ThumbsDown, FileText, ArrowLeft, X
} from 'lucide-react'
import './AnalysisReview.css'
import DeepReviewBanner from '../components/DeepReviewBanner'
import '../components/DeepReviewBanner.css'
import DocumentViewer from '../components/DocumentViewer'
import '../components/DocumentViewer.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

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
  critical:          { icon: AlertCircle,   color: 'critical',   label: 'Crítico',             borderColor: 'var(--red-500)' },
  attention:         { icon: AlertTriangle, color: 'attention',  label: 'Atenção',              borderColor: 'var(--amber-500)' },
  adequate:          { icon: CheckCircle2,  color: 'adequate',   label: 'Adequado',             borderColor: 'var(--green-500)' },
  adequate_implicit: { icon: CheckCircle2,  color: 'adequate',   label: 'Adequado (implícito)', borderColor: 'var(--teal-600)' },
  overridden:        { icon: ThumbsUp,      color: 'overridden', label: 'Rev. analista',        borderColor: 'var(--blue-500)' },
  not_applicable:    { icon: MinusCircle,   color: 'gray',       label: 'N/A',                  borderColor: 'var(--gray-300)' },
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AnalysisReview() {
  const { analysisId } = useParams()
  const { user } = useAuth()

  const [analysis,     setAnalysis]     = useState(null)
  const [elements,     setElements]     = useState([])
  const [activeBlock,  setActiveBlock]  = useState('B1')
  const [activeIdx,    setActiveIdx]    = useState(0)
  const [submitting,   setSubmitting]   = useState(false)
  const [comment,      setComment]      = useState('')
  const [showComment,  setShowComment]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [checklistMap, setChecklistMap] = useState({})

  // ── Estratégia 4: estado do popover de mark clicado ──────────────────────
  const [markPopover, setMarkPopover] = useState(null) // { elementId, label, status }

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

  useEffect(() => {
    getDocs(collection(db, 'checklist_definitions')).then(snapshot => {
      const map = {}
      snapshot.forEach(doc => { map[doc.id] = doc.data() })
      setChecklistMap(map)
    })
  }, [])

  const blockElements = elements.filter(e => e.blockCode === activeBlock)

  // Enriquece com _keywords para o DocumentViewer
  const currentElement = blockElements[activeIdx]
    ? {
        ...blockElements[activeIdx],
        _keywords: checklistMap[blockElements[activeIdx].elementId]?.keywords || [],
      }
    : null

  // ── Estratégia 4: ao clicar num mark no iframe, abre o popover
  //    e navega para o elemento correspondente no checklist ─────────────────
  const handleMarkClick = useCallback(({ elementId, label, status }) => {
    // Navega para o bloco/elemento clicado
    const blockCode = elementId?.split('_')[0]
    if (blockCode && blockCode !== activeBlock) {
      setActiveBlock(blockCode)
      setActiveIdx(0)
    }
    // Encontra o índice do elemento no bloco
    const allBlockElems = elements.filter(e => e.blockCode === blockCode)
    const idx = allBlockElems.findIndex(e => e.elementId === elementId)
    if (idx >= 0) setActiveIdx(idx)

    // Abre o popover compacto
    setMarkPopover({ elementId, label, status })
    setComment('')
    setShowComment(false)
  }, [elements, activeBlock])

  const closeMarkPopover = useCallback(() => setMarkPopover(null), [])

  const handleBlockChange = useCallback((code) => {
    setActiveBlock(code)
    setActiveIdx(0)
    setComment('')
    setShowComment(false)
    setMarkPopover(null)
  }, [])

  const goNext = useCallback(() => {
    setActiveIdx(i => Math.min(i + 1, blockElements.length - 1))
    setComment('')
    setShowComment(false)
    setMarkPopover(null)
  }, [blockElements.length])

  const goPrev = useCallback(() => {
    setActiveIdx(i => Math.max(i - 1, 0))
    setComment('')
    setShowComment(false)
    setMarkPopover(null)
  }, [])

  async function submitReview(action) {
    if (!currentElement) return
    setSubmitting(true)
    try {
      await elementResultsService.submitHumanReview(
        analysisId,
        currentElement.elementId,
        { action, comment: comment.trim() || null, reviewerId: user?.uid }
      )
      toast.success(action === 'agree' ? 'Análise confirmada' : 'Análise revisada pelo analista')
      goNext()
    } catch {
      toast.error('Erro ao salvar revisão')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Contadores por bloco ──────────────────────────────────────────────────
  const blockStats = BLOCKS.map(b => {
    const elems   = elements.filter(e => e.blockCode === b.code)
    const pending = elems.filter(e => e.humanReview?.status === 'pending').length
    const hasCrit = elems.some(e => e.effectiveStatus === 'critical')
    return { ...b, pending, hasCrit }
  })

  if (loading) {
    return (
      <div className="review-loading">
        <div className="spinner" />
      </div>
    )
  }

  // Elemento do popover (pode ser de outro bloco)
  const popoverElement = markPopover
    ? elements.find(e => e.elementId === markPopover.elementId)
    : null

  return (
    <div className="review-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="review-header">
        <Link to="/analyses" className="back-link">
          <ArrowLeft size={15} /> Análises
        </Link>
        <div className="review-title-group">
          <h1 className="review-title">{analysis?.schoolName || 'Carregando…'}</h1>
          <span className="review-meta">
            {analysis?.schoolCode} · PPP {analysis?.year}
          </span>
        </div>
        <div className="review-header-actions">
          <DeepReviewBanner elements={elements} analysisId={analysisId} />
          <Link to={`/analyses/${analysisId}/report`} className="btn-parecer">
            <FileText size={14} /> Gerar parecer
          </Link>
        </div>
      </div>

      <div className="review-body">
        {/* ── Nav de blocos ──────────────────────────────────────────────── */}
        <nav className="block-nav">
          {blockStats.map(b => (
            <button
              key={b.code}
              className={`block-btn ${activeBlock === b.code ? 'active' : ''} ${b.hasCrit ? 'has-critical' : ''}`}
              onClick={() => handleBlockChange(b.code)}
            >
              <span className="block-code">{b.code}</span>
              <span className="block-label">{b.label}</span>
              {b.pending > 0 && <span className="block-badge">{b.pending}</span>}
            </button>
          ))}
        </nav>

        {/*
          ── Grade principal ────────────────────────────────────────────────
          ESTRATÉGIA 1: ordem das colunas invertida
          Coluna 1: sidebar de elementos (estreita)
          Coluna 2: DocumentViewer CENTRAL (dominante — flex:1)
          Coluna 3: ElementCard lateral direito (painel secundário)
        */}
        <div className="review-main">

          {/* Coluna 1: lista de elementos do bloco */}
          <div className="elements-sidebar">
            <p className="elements-sidebar-title">
              {BLOCKS.find(b => b.code === activeBlock)?.label}
            </p>
            {blockElements.map((el, i) => {
              const cfg  = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
              const Icon = cfg.icon
              return (
                <button
                  key={el.elementId}
                  className={`element-item ${i === activeIdx ? 'active' : ''}`}
                  onClick={() => {
                    setActiveIdx(i)
                    setComment('')
                    setShowComment(false)
                    setMarkPopover(null)
                  }}
                >
                  <Icon size={14} className={`element-status-icon status-${cfg.color}`} />
                  <span className="element-item-label">{el.label}</span>
                  {el.humanReview?.status === 'pending' && (
                    <span className="element-pending-dot" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Coluna 2 (CENTRAL): viewer do documento com highlights */}
          <div className="review-viewer-col">
            <DocumentViewer
              analysisId={analysisId}
              activeElement={currentElement}
              onMarkClick={handleMarkClick}
            />

            {/* ESTRATÉGIA 4: popover inline sobreposto ao viewer */}
            {markPopover && popoverElement && (
              <MarkPopover
                element={popoverElement}
                onClose={closeMarkPopover}
                onNavigate={() => {
                  // Garante que o card lateral já está no elemento certo
                  setMarkPopover(null)
                }}
              />
            )}
          </div>

          {/* Coluna 3 (direita): card de análise do elemento selecionado */}
          {currentElement ? (
            <ElementCard
              element={currentElement}
              checklistMap={checklistMap}
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

// ─── MarkPopover (Estratégia 4) ───────────────────────────────────────────────
// Aparece sobreposto ao viewer quando o analista clica num mark no documento.
// Exibe um resumo compacto da análise do elemento clicado.

function MarkPopover({ element: el, onClose, onNavigate }) {
  const cfg    = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
  const Icon   = cfg.icon

  return (
    <div className="mark-popover animate-fade-in">
      <div className="mp-header" style={{ borderLeftColor: cfg.borderColor }}>
        <div className="mp-title-row">
          <Icon size={13} className={`element-status-icon status-${cfg.color}`} />
          <span className="mp-label">{el.label}</span>
          <span className={`status-pill status-${cfg.color} mp-pill`}>
            {cfg.label}
          </span>
        </div>
        <button className="mp-close" onClick={onClose} title="Fechar">
          <X size={14} />
        </button>
      </div>

      {el.aiResult?.summary && (
        <p className="mp-summary">{el.aiResult.summary}</p>
      )}

      {el.aiResult?.excerpts?.length > 0 && (
        <div className="mp-excerpt">
          <span className="mp-excerpt-label">
            📌 {el.aiResult.excerpts[0].section || 'Trecho localizado'}
          </span>
          <p className="mp-excerpt-text">
            {el.aiResult.excerpts[0].text?.slice(0, 180)}
            {el.aiResult.excerpts[0].text?.length > 180 ? '…' : ''}
          </p>
        </div>
      )}

      {el.aiResult?.missingRefs?.length > 0 && (
        <div className="mp-missing">
          <AlertCircle size={12} />
          <span>Referências ausentes: {el.aiResult.missingRefs.slice(0, 2).join(', ')}</span>
        </div>
      )}

      <button className="mp-navigate" onClick={onNavigate}>
        Ver análise completa no painel →
      </button>
    </div>
  )
}

// ─── ExcerptViewer ────────────────────────────────────────────────────────────

function ExcerptViewer({ excerpts, keywords = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expanded, setExpanded]         = useState(false)

  if (!excerpts?.length) return null

  const current = excerpts[currentIndex]
  const text    = current?.text    || ''
  const section = current?.section || 'Seção não identificada'
  const isLong  = text.length > 200

  const highlightText = (str, kws) => {
    if (!str) return ''
    if (!kws?.length) return str
    const escaped = kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex   = new RegExp(`(${escaped.join('|')})`, 'gi')
    return str.split(regex).map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="keyword-highlight">{part}</mark>
        : <span key={i}>{part}</span>
    )
  }

  const displayText = (!expanded && isLong) ? text.slice(0, 200) + '…' : text

  return (
    <div className="excerpt-viewer">
      <div className="excerpt-header">
        <span className="excerpt-section">📌 {section}</span>
        {excerpts.length > 1 && (
          <div className="excerpt-nav">
            <button
              className="excerpt-nav-btn"
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >‹</button>
            <span>{currentIndex + 1}/{excerpts.length}</span>
            <button
              className="excerpt-nav-btn"
              onClick={() => setCurrentIndex(i => Math.min(excerpts.length - 1, i + 1))}
              disabled={currentIndex === excerpts.length - 1}
            >›</button>
          </div>
        )}
      </div>
      <blockquote className="ec-excerpt">
        <p>{highlightText(displayText, keywords)}</p>
        {isLong && (
          <button className="excerpt-expand" onClick={() => setExpanded(v => !v)}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </blockquote>
    </div>
  )
}

// ─── ElementCard ──────────────────────────────────────────────────────────────

function ElementCard({
  element: el, checklistMap,
  submitting, comment, setComment, showComment, setShowComment,
  onAgree, onDisagree, onSkip, onPrev, onNext, hasPrev, hasNext, position,
}) {
  const cfg    = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
  const aiCfg  = STATUS_CONFIG[el.aiResult?.status] || STATUS_CONFIG.adequate
  const Icon   = cfg.icon
  const AiIcon = aiCfg.icon
  const reviewed = el.humanReview?.status !== 'pending'

  return (
    <div className="element-card animate-fade-in" style={{ borderTopColor: cfg.borderColor }}>

      <div className="ec-top">
        <div className="ec-badges">
          <span className={`status-pill status-${cfg.color}`}>
            <Icon size={13} /> {cfg.label}
          </span>
          {el.isNewIn2026 && <span className="new-badge">NOVO 2026</span>}
          {el.isCritical  && <span className="critical-badge">Obrigatório</span>}
          {reviewed && el.humanReview?.status !== 'skipped' && (
            <span className="reviewed-badge">Revisado</span>
          )}
        </div>
        <div className="ec-nav-row">
          <button className={`ec-nav-btn ${!hasPrev ? 'muted' : ''}`} onClick={onPrev} disabled={!hasPrev}>
            <ChevronLeft size={14} />
          </button>
          <span className="ec-nav-pos">{position}</span>
          <button className={`ec-nav-btn ${!hasNext ? 'muted' : ''}`} onClick={onNext} disabled={!hasNext}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <h2 className="ec-title">{el.label}</h2>
      {checklistMap[el.elementId]?.normRef && (
        <p className="ec-normref">{checklistMap[el.elementId].normRef}</p>
      )}

      {/* Bloco da IA */}
      {el.aiResult && (
        <div className={`ec-ai-block ai-${aiCfg.color}`}>
          <div className="ec-ai-header">
            <AiIcon size={13} />
            Análise da IA
            {el.aiResult.confidence != null && (
              <span className="ai-score">{Math.round(el.aiResult.confidence * 100)}% confiança</span>
            )}
          </div>
          {el.aiResult.summary && (
            <p className="ec-ai-summary">{el.aiResult.summary}</p>
          )}
          {el.aiResult.excerpts?.length > 0 && (
            <div className="ec-excerpts">
              <p className="ec-excerpts-label">Trechos localizados no documento:</p>
              <ExcerptViewer
                excerpts={el.aiResult.excerpts}
                keywords={el._keywords || []}
              />
            </div>
          )}
          {el.aiResult.missingRefs?.length > 0 && (
            <div className="ec-missing-refs">
              <AlertCircle size={13} />
              <span>Ausente: {el.aiResult.missingRefs.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Comentário do analista */}
      {el.humanReview?.comment && (
        <div className="ec-analyst-comment">
          <MessageSquare size={13} />
          <span>{el.humanReview.comment}</span>
        </div>
      )}

      {/* Ações */}
      {!reviewed && (
        <div className="ec-actions">
          <button className="btn-agree" onClick={onAgree} disabled={submitting}>
            <ThumbsUp size={13} /> Confirmar análise da IA
          </button>
          <button className="btn-disagree" onClick={onDisagree} disabled={submitting}>
            <ThumbsDown size={13} /> Discordar — elemento adequado
          </button>
          <div className="ec-secondary-actions">
            {!showComment ? (
              <button className="btn-ghost" onClick={() => setShowComment(true)}>
                <MessageSquare size={13} /> Adicionar comentário
              </button>
            ) : (
              <div className="comment-box">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Observação opcional..."
                  rows={3}
                />
              </div>
            )}
            <button className="btn-ghost" onClick={onSkip}>
              <SkipForward size={13} /> Pular
            </button>
          </div>
        </div>
      )}

      {reviewed && (
        <div className="ec-nav">
          <button className={`btn-ghost ${!hasPrev ? 'muted' : ''}`} onClick={onPrev} disabled={!hasPrev}>
            ← Anterior
          </button>
          <button className={`btn-ghost ${!hasNext ? 'muted' : ''}`} onClick={onNext} disabled={!hasNext}>
            Próximo →
          </button>
        </div>
      )}
    </div>
  )
}
