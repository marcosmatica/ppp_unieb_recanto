// src/pages/AnalysisReview.jsx
//
// Navegação em gavetas aninhadas:
//   [Bloco (gaveta externa)] → expande → [Elemento (gaveta interna)] → clique → ElementCard

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analysesService, elementResultsService } from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import {
  AlertCircle, AlertTriangle, CheckCircle2, MinusCircle,
  ChevronRight, SkipForward, MessageSquare,
  ThumbsUp, ThumbsDown, FileText, ArrowLeft, X, Loader2,
  ChevronDown, ChevronLeft,
} from 'lucide-react'
import './AnalysisReview.css'
import DeepReviewBanner from '../components/DeepReviewBanner'
import '../components/DeepReviewBanner.css'
import DocumentViewer from '../components/DocumentViewer'
import '../components/DocumentViewer.css'
import ExcerptCards from '../components/ExcerptCards'
import ReviewActions from '../components/ReviewActions'
import '../components/ReviewActions.css'

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

// Cor de fundo por status para o dot de cada elemento na gaveta
const STATUS_DOT = {
  critical:          'var(--red-500)',
  attention:         'var(--amber-400)',
  adequate:          'var(--green-500)',
  adequate_implicit: 'var(--teal-500)',
  overridden:        'var(--blue-400)',
  not_applicable:    'var(--gray-300)',
}

const COL_DEFAULTS = { drawer: 280, card: 380 }
const COL_MIN      = { drawer: 200, card: 260 }
const COL_MAX      = { drawer: 420, card: 520 }

// ─── Hook resize ─────────────────────────────────────────────────────────────
function useColResize(colKey, defaultWidth) {
  const [width,      setWidth]      = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = width
    setIsDragging(true)
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      const delta = colKey === 'card'
        ? startX.current - ev.clientX
        : ev.clientX - startX.current
      const next = Math.min(COL_MAX[colKey], Math.max(COL_MIN[colKey], startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      setIsDragging(false)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, colKey])

  return [width, onMouseDown, isDragging]
}

// ─── ResizeBorder ─────────────────────────────────────────────────────────────
function ResizeBorder({ onMouseDown, isDragging, side = 'right' }) {
  return (
    <div
      className={`resize-border resize-border--${side}${isDragging ? ' resize-border--active' : ''}`}
      onMouseDown={onMouseDown}
    />
  )
}

// ─── ProcessingStatus ────────────────────────────────────────────────────────
const PROCESSING_STEPS = [
  { key: 'pending',    label: 'Aguardando início do processamento…' },
  { key: 'extracting', label: 'Extraindo texto do documento…' },
  { key: 'analyzing',  label: 'Analisando com IA (Haiku)…' },
]

function ProcessingStatus({ status, schoolName }) {
  const currentIdx = PROCESSING_STEPS.findIndex(s => s.key === status)
  return (
    <div className="analysis-processing-screen">
      <div className="ps-wrapper">
        <div className="ps-card">
          <div className="ps-icon-wrap"><Loader2 size={32} className="ps-spinner" /></div>
          <h2 className="ps-title">Analisando documento</h2>
          {schoolName && <p className="ps-school">{schoolName}</p>}
          <p className="ps-subtitle">
            A IA está verificando o PPP contra os critérios da Portaria SEEDF nº 139/2024.
            Isso costuma levar entre 1 e 3 minutos.
          </p>
          <div className="ps-steps">
            {PROCESSING_STEPS.map((step, i) => {
              const isDone    = i < currentIdx
              const isCurrent = i === currentIdx
              return (
                <div key={step.key} className={`ps-step${isDone ? ' ps-step--done' : ''}${isCurrent ? ' ps-step--active' : ''}`}>
                  <div className="ps-step-dot">
                    {isDone    && <CheckCircle2 size={14} />}
                    {isCurrent && <Loader2 size={14} className="ps-spin-sm" />}
                  </div>
                  <span className="ps-step-label">{step.label}</span>
                </div>
              )
            })}
          </div>
          <p className="ps-hint">A página atualiza automaticamente quando a análise for concluída.</p>
        </div>
      </div>
    </div>
  )
}

// ─── DrawerNav ────────────────────────────────────────────────────────────────
// Coluna de gavetas aninhadas: Bloco → Elemento
// Cada bloco é uma gaveta (accordion). Ao abrir, exibe os elementos como
// sub-itens com dot colorido por status. O elemento ativo fica destacado.

function DrawerNav({ blocks, elements, activeBlock, activeElementId, onSelectElement }) {
  // Blocos abertos — inicialmente o bloco ativo
  const [openBlocks, setOpenBlocks] = useState(() => new Set([activeBlock]))

  // Abre o bloco do elemento ativo quando muda externamente
  useEffect(() => {
    setOpenBlocks(prev => {
      if (prev.has(activeBlock)) return prev
      return new Set([...prev, activeBlock])
    })
  }, [activeBlock])

  const toggleBlock = (code) => {
    setOpenBlocks(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <div className="drawer-nav">
      {blocks.map((block, blockIdx) => {
        const blockElems  = elements.filter(e => e.blockCode === block.code)
        const isOpen      = openBlocks.has(block.code)
        const isActive    = block.code === activeBlock
        const pending     = blockElems.filter(e => e.humanReview?.status === 'pending').length
        const critCount   = blockElems.filter(e => e.effectiveStatus === 'critical').length
        const attCount    = blockElems.filter(e => e.effectiveStatus === 'attention').length
        const okCount     = blockElems.filter(e =>
          e.effectiveStatus === 'adequate' || e.effectiveStatus === 'adequate_implicit' || e.effectiveStatus === 'overridden'
        ).length

        // Mini barra de progresso de status do bloco
        const total = blockElems.length || 1

        return (
          <div
            key={block.code}
            className={`drawer-block${isOpen ? ' drawer-block--open' : ''}${isActive ? ' drawer-block--active' : ''}`}
            style={{ '--block-depth': blockIdx }}
          >
            {/* Cabeçalho do bloco — gaveta externa */}
            <button
              className="drawer-block-header"
              onClick={() => toggleBlock(block.code)}
            >
              {/* Indicador de abertura */}
              <span className={`drawer-chevron${isOpen ? ' drawer-chevron--open' : ''}`}>
                <ChevronRight size={13} />
              </span>

              {/* Código do bloco */}
              <span className="drawer-block-code">{block.code}</span>

              {/* Rótulo */}
              <span className="drawer-block-label">{block.label}</span>

              {/* Mini-pills de status */}
              <div className="drawer-block-pills">
                {critCount > 0 && (
                  <span className="drawer-pill drawer-pill--critical">{critCount}</span>
                )}
                {attCount > 0 && (
                  <span className="drawer-pill drawer-pill--attention">{attCount}</span>
                )}
                {pending > 0 && (
                  <span className="drawer-pill drawer-pill--pending">{pending}p</span>
                )}
              </div>
            </button>

            {/* Mini-barra de progresso do bloco */}
            {blockElems.length > 0 && (
              <div className="drawer-progress-bar">
                <div
                  className="drawer-progress-ok"
                  style={{ width: `${(okCount / total) * 100}%` }}
                />
                <div
                  className="drawer-progress-att"
                  style={{ width: `${(attCount / total) * 100}%` }}
                />
                <div
                  className="drawer-progress-crit"
                  style={{ width: `${(critCount / total) * 100}%` }}
                />
              </div>
            )}

            {/* Corpo da gaveta — elementos */}
            {isOpen && blockElems.length > 0 && (
              <div className="drawer-elements">
                {blockElems.map((el) => {
                  const isElActive  = el.elementId === activeElementId
                  const dotColor    = STATUS_DOT[el.effectiveStatus] || 'var(--gray-300)'
                  const isPending   = el.humanReview?.status === 'pending'

                  return (
                    <button
                      key={el.elementId}
                      className={`drawer-element${isElActive ? ' drawer-element--active' : ''}`}
                      onClick={() => onSelectElement(block.code, el.elementId)}
                    >
                      {/* Linha de conexão visual (gaveta interna) */}
                      <span className="drawer-element-line" />

                      {/* Dot de status */}
                      <span
                        className="drawer-element-dot"
                        style={{ background: dotColor }}
                      />

                      {/* Rótulo do elemento */}
                      <span className="drawer-element-label">{el.label}</span>

                      {/* Indicador de pendente */}
                      {isPending && <span className="drawer-element-pending" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Estado: sem elementos no bloco */}
            {isOpen && blockElems.length === 0 && (
              <div className="drawer-empty">Nenhum elemento</div>
            )}
          </div>
        )
      })}
    </div>
  )
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
  const [markPopover,  setMarkPopover]  = useState(null)

  const [drawerW, onDrawerDrag, drawerDragging] = useColResize('drawer', COL_DEFAULTS.drawer)
  const [cardW,   onCardDrag,   cardDragging]   = useColResize('card',   COL_DEFAULTS.card)
  const iframeSendRef = useRef(null)
  const aiStatus     = analysis?.aiAnalysis?.status
  const isProcessing = analysis !== null && ['pending', 'extracting', 'analyzing'].includes(aiStatus)
  const isReady      = analysis !== null && ['haiku_complete', 'complete'].includes(aiStatus)

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

  const currentElement = blockElements[activeIdx]
    ? {
        ...blockElements[activeIdx],
        _keywords: checklistMap[blockElements[activeIdx].elementId]?.keywords || [],
      }
    : null

  // activeElementId para o DrawerNav
  const activeElementId = currentElement?.elementId || null

  // Selecionar elemento via gaveta
  const handleSelectElement = useCallback((blockCode, elementId) => {
    setActiveBlock(blockCode)
    const blockElems = elements.filter(e => e.blockCode === blockCode)
    const idx = blockElems.findIndex(e => e.elementId === elementId)
    setActiveIdx(idx >= 0 ? idx : 0)
    setComment('')
    setShowComment(false)
    setMarkPopover(null)
  }, [elements])

  const handleMarkClick = useCallback(({ elementId }) => {
    const blockCode = elementId?.split('_')[0]
    handleSelectElement(blockCode, elementId)
    setMarkPopover({ elementId })
  }, [handleSelectElement])

  const scrollToExcerpt = useCallback((excerptText) => {
    if (!iframeSendRef.current || !excerptText) return
    iframeSendRef.current({ type: 'SCROLL_TO_TEXT', text: excerptText })
  }, [])

  const closeMarkPopover = useCallback(() => setMarkPopover(null), [])

  const goNext = useCallback(() => {
    // Avança para o próximo elemento — se acabar o bloco, vai para o próximo bloco
    const blockElems = elements.filter(e => e.blockCode === activeBlock)
    if (activeIdx < blockElems.length - 1) {
      setActiveIdx(i => i + 1)
    } else {
      // Próximo bloco com elementos
      const blockIdx = BLOCKS.findIndex(b => b.code === activeBlock)
      for (let i = blockIdx + 1; i < BLOCKS.length; i++) {
        const nextElems = elements.filter(e => e.blockCode === BLOCKS[i].code)
        if (nextElems.length > 0) {
          setActiveBlock(BLOCKS[i].code)
          setActiveIdx(0)
          break
        }
      }
    }
    setComment('')
    setShowComment(false)
    setMarkPopover(null)
  }, [activeBlock, activeIdx, elements])

  const goPrev = useCallback(() => {
    if (activeIdx > 0) {
      setActiveIdx(i => i - 1)
    } else {
      // Bloco anterior com elementos
      const blockIdx = BLOCKS.findIndex(b => b.code === activeBlock)
      for (let i = blockIdx - 1; i >= 0; i--) {
        const prevElems = elements.filter(e => e.blockCode === BLOCKS[i].code)
        if (prevElems.length > 0) {
          setActiveBlock(BLOCKS[i].code)
          setActiveIdx(prevElems.length - 1)
          break
        }
      }
    }
    setComment('')
    setShowComment(false)
    setMarkPopover(null)
  }, [activeBlock, activeIdx, elements])

  // Determina se há anterior/próximo global
  const blockIdx    = BLOCKS.findIndex(b => b.code === activeBlock)
  const hasPrevGlobal = activeIdx > 0 || BLOCKS.slice(0, blockIdx).some(b => elements.some(e => e.blockCode === b.code))
  const hasNextGlobal = activeIdx < blockElements.length - 1 || BLOCKS.slice(blockIdx + 1).some(b => elements.some(e => e.blockCode === b.code))

  // Posição global do elemento
  const globalIdx   = elements.findIndex(e => e.elementId === activeElementId)
  const globalPos   = globalIdx >= 0 ? `${globalIdx + 1} / ${elements.length}` : '—'

  async function submitReview(decision, overrideStatus = null) {
    if (!currentElement) return
    setSubmitting(true)
    try {
      await elementResultsService.submitHumanReview(
          analysisId,
          currentElement.elementId,
          {
            decision,
            overrideStatus,               // null quando decision === 'agree'
            comment: comment.trim() || null,
            reviewerId: user?.uid,
          }
      )
      const msg = decision === 'agree'
          ? 'Análise da IA confirmada'
          : `Elemento marcado como ${overrideStatus}`
      toast.success(msg)
      setComment('')
      setShowComment(false)
      goNext()
    } catch {
      toast.error('Erro ao salvar revisão')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !analysis) {
    return <div className="review-loading"><div className="spinner" /></div>
  }

  if (isProcessing) {
    return <ProcessingStatus status={aiStatus} schoolName={analysis?.schoolName} />
  }

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
          <h1 className="review-title">{analysis?.schoolName || '—'}</h1>
          <span className="review-meta">{analysis?.schoolCode} · PPP {analysis?.year}</span>
        </div>
        <div className="review-header-actions">
          <Link to={`/analyses/${analysisId}/report`} className="btn-parecer">
            <FileText size={14} /> Gerar parecer
          </Link>
        </div>
      </div>

      {/* ── DeepReviewBanner ────────────────────────────────────────────── */}
      {isReady && (
        <DeepReviewBanner elements={elements} analysisId={analysisId} />
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="review-body">

        {/* Col 0: Gavetas (DrawerNav) */}
        <div
          className={`drawer-col${drawerDragging ? ' col--dragging' : ''}`}
          style={{ width: drawerW, minWidth: drawerW, maxWidth: drawerW }}
        >
          <DrawerNav
            blocks={BLOCKS}
            elements={elements}
            activeBlock={activeBlock}
            activeElementId={activeElementId}
            onSelectElement={handleSelectElement}
          />
          <ResizeBorder onMouseDown={onDrawerDrag} isDragging={drawerDragging} side="right" />
        </div>

        {/* Col 1: Viewer central */}
        <div className="review-viewer-col">
          <DocumentViewer
            analysisId={analysisId}
            activeElement={currentElement}
            onMarkClick={handleMarkClick}
            hideExcerpts={true}
            onIframeReady={(sendFn) => { iframeSendRef.current = sendFn }}
          />
          {markPopover && popoverElement && (
            <MarkPopover
              element={popoverElement}
              onClose={closeMarkPopover}
              onNavigate={() => setMarkPopover(null)}
            />
          )}
        </div>

        {/* Col 2: ElementCard */}
        {currentElement ? (
          <div
            className={`element-card-col${cardDragging ? ' col--dragging' : ''}`}
            style={{ width: cardW, minWidth: cardW, maxWidth: cardW }}
          >
            <ResizeBorder onMouseDown={onCardDrag} isDragging={cardDragging} side="left" />
            <ElementCard
              element={currentElement}
              checklistMap={checklistMap}
              submitting={submitting}
              comment={comment}
              setComment={setComment}
              showComment={showComment}
              setShowComment={setShowComment}
              onAgree={() => submitReview('agree')}
              onOverride={(status) => submitReview('override', status)}
              onSkip={goNext}
              onPrev={goPrev}
              onNext={goNext}
              hasPrev={hasPrevGlobal}
              hasNext={hasNextGlobal}
              position={globalPos}
              onExcerptClick={(idx) => scrollToExcerpt(currentElement?.aiResult?.excerpts?.[idx]?.text)}
            />
          </div>
        ) : (
          <div
            className="no-elements"
            style={{ width: cardW, minWidth: cardW, maxWidth: cardW }}
          >
            Nenhum elemento neste bloco.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MarkPopover ──────────────────────────────────────────────────────────────

function MarkPopover({ element: el, onClose, onNavigate }) {
  const cfg  = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
  const Icon = cfg.icon
  return (
    <div className="mark-popover animate-fade-in">
      <div className="mp-header" style={{ borderLeftColor: cfg.borderColor }}>
        <div className="mp-title-row">
          <Icon size={13} className={`element-status-icon status-${cfg.color}`} />
          <span className="mp-label">{el.label}</span>
          <span className={`status-pill status-${cfg.color} mp-pill`}>{cfg.label}</span>
        </div>
        <button className="mp-close" onClick={onClose} title="Fechar"><X size={14} /></button>
      </div>
      {el.aiResult?.summary && <p className="mp-summary">{el.aiResult.summary}</p>}
      {el.aiResult?.excerpts?.length > 0 && (
        <div className="mp-excerpt">
          <span className="mp-excerpt-label">📌 {el.aiResult.excerpts[0].section || 'Trecho localizado'}</span>
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
      <button className="mp-navigate" onClick={onNavigate}>Ver análise completa no painel →</button>
    </div>
  )
}

// ─── ElementCard ──────────────────────────────────────────────────────────────

// Substitua o componente ElementCard inteiro no final de
// src/pages/AnalysisReview.jsx por este bloco completo.
// Nada mais no arquivo precisa mudar.

function ElementCard({
                       element: el, checklistMap,
                       submitting, comment, setComment, showComment, setShowComment,
                       onAgree, onOverride, onSkip, onPrev, onNext, hasPrev, hasNext, position,
                     }) {
  const cfg    = STATUS_CONFIG[el.effectiveStatus] || STATUS_CONFIG.adequate
  const aiCfg  = STATUS_CONFIG[el.aiResult?.status] || STATUS_CONFIG.adequate
  const Icon   = cfg.icon
  const AiIcon = aiCfg.icon
  const reviewed = el.humanReview?.status !== 'pending'

  // Status da IA (antes de qualquer revisão humana) — passado ao ReviewActions
  const aiStatus = el.aiResult?.status || 'adequate'

  return (
      <div className="element-card animate-fade-in" style={{ borderTopColor: cfg.borderColor }}>

        {/* ── Topo: badges + navegação ── */}
        <div className="ec-top">
          <div className="ec-badges">
            <span className={`status-pill status-${cfg.color}`}><Icon size={13} /> {cfg.label}</span>
            {el.isNewIn2026 && <span className="new-badge">NOVO 2026</span>}
            {el.isCritical  && <span className="critical-badge">Obrigatório</span>}
            {reviewed && el.humanReview?.status === 'confirmed'  && <span className="reviewed-badge">✓ Confirmado</span>}
            {reviewed && el.humanReview?.status === 'overridden' && <span className="overridden-badge">✎ Revisado</span>}
            {reviewed && el.humanReview?.status === 'skipped'    && <span className="skipped-badge">→ Pulado</span>}
          </div>
          <div className="ec-nav-row">
            <button className={`ec-nav-btn${!hasPrev ? ' muted' : ''}`} onClick={onPrev} disabled={!hasPrev}>
              <ChevronLeft size={14} />
            </button>
            <span className="ec-nav-pos">{position}</span>
            <button className={`ec-nav-btn${!hasNext ? ' muted' : ''}`} onClick={onNext} disabled={!hasNext}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Título e referência normativa ── */}
        <h2 className="ec-title">{el.label}</h2>
        {checklistMap[el.elementId]?.normRef && (
            <p className="ec-normref">{checklistMap[el.elementId].normRef}</p>
        )}

        {/* ── Bloco de análise da IA ── */}
        {el.aiResult && (
            <div className={`ec-ai-block ai-${aiCfg.color}`}>
              <div className="ec-ai-header">
                <AiIcon size={13} /> Análise da IA
                {el.aiResult.score != null && (
                    <span className="ai-score">{Math.round(el.aiResult.score * 100)}% score</span>
                )}
              </div>
              {el.aiResult.summary && <p className="ec-ai-summary">{el.aiResult.summary}</p>}
              {el.aiResult.missingRefs?.length > 0 && (
                  <div className="ec-missing-refs">
                    <AlertCircle size={13} />
                    <span>Ausente: {el.aiResult.missingRefs.join(', ')}</span>
                  </div>
              )}
            </div>
        )}

        {/* ── Trechos localizados ── */}
        {el.aiResult?.excerpts?.length > 0 && (
            <div className="ec-excerpts-block">
              <p className="ec-excerpts-label">Trechos localizados no documento</p>
              <ExcerptCards
                  excerpts={el.aiResult.excerpts}
                  keywords={el._keywords || []}
                  status={el.effectiveStatus}
                  onExcerptClick={onExcerptClick}
              />
            </div>
        )}

        {/* ── Comentário já salvo do analista ── */}
        {el.humanReview?.comment && (
            <div className="ec-analyst-comment">
              <MessageSquare size={13} />
              <span>{el.humanReview.comment}</span>
            </div>
        )}

        {/* ── Ações: ReviewActions (pendente) ou nav (revisado) ── */}
        {!reviewed ? (
            <ReviewActions
                aiStatus={aiStatus}
                submitting={submitting}
                comment={comment}
                setComment={setComment}
                showComment={showComment}
                setShowComment={setShowComment}
                onAgree={onAgree}
                onOverride={onOverride}
                onSkip={onSkip}
            />
        ) : (
            <div className="ec-nav">
              <button className={`btn-ghost${!hasPrev ? ' muted' : ''}`} onClick={onPrev} disabled={!hasPrev}>
                ← Anterior
              </button>
              <button className={`btn-ghost${!hasNext ? ' muted' : ''}`} onClick={onNext} disabled={!hasNext}>
                Próximo →
              </button>
            </div>
        )}
      </div>
  )
}
