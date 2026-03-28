/**
 * src/components/DocumentViewer.jsx
 *
 * Para .docx: carrega o HTML highlighted via URL assinada (getDocumentViewerUrl).
 *   - Se htmlUrl === null (HTML ainda não gerado), oferece botão "Reprocessar"
 *     que chama regenerateHighlightedHtml e recarrega automaticamente.
 *   - postMessage bidirecional com iframe para highlights e cliques em marks.
 *
 * Para .pdf: exibe aviso de limitação (funcionalidades reduzidas).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../services/firebase'
import { AlertTriangle, FileText, Eye, EyeOff, RefreshCw, FileX } from 'lucide-react'
import ExcerptCards from './ExcerptCards'
import './DocumentViewer.css'

export default function DocumentViewer({ analysisId, activeElement, onMarkClick }) {
  const iframeRef = useRef(null)

  const [htmlUrl,      setHtmlUrl]      = useState(null)
  const [fileType,     setFileType]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [iframeReady,  setIframeReady]  = useState(false)
  const [collapsed,    setCollapsed]    = useState(false)
  const [regen,        setRegen]        = useState({ loading: false, error: null })

  // ── Carrega URL do HTML highlighted ────────────────────────────────────────
  const loadViewerUrl = useCallback(() => {
    if (!analysisId) return
    setLoading(true)
    setIframeReady(false)

    const getViewerUrl = httpsCallable(functions, 'getDocumentViewerUrl')
    getViewerUrl({ analysisId })
      .then(({ data }) => {
        setHtmlUrl(data.htmlUrl || null)
        setFileType(data.fileType || null)
      })
      .catch(() => {
        setHtmlUrl(null)
        setFileType(null)
      })
      .finally(() => setLoading(false))
  }, [analysisId])

  useEffect(() => { loadViewerUrl() }, [loadViewerUrl])

  // ── Reprocessar HTML (docx sem HTML gerado) ────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    setRegen({ loading: true, error: null })
    try {
      const regenerate = httpsCallable(functions, 'regenerateHighlightedHtml')
      await regenerate({ analysisId })
      // Recarrega a URL após geração
      loadViewerUrl()
      setRegen({ loading: false, error: null })
    } catch (err) {
      setRegen({ loading: false, error: err.message || 'Erro ao reprocessar.' })
    }
  }, [analysisId, loadViewerUrl])

  // ── Escuta mensagens do iframe ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'MARK_CLICKED') {
        onMarkClick?.({
          elementId: e.data.elementId,
          label:     e.data.label,
          status:    e.data.status,
        })
      }
      if (e.data?.type === 'IFRAME_READY') {
        setIframeReady(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onMarkClick])

  // ── Envia postMessage ao iframe quando muda o elemento ativo ───────────────
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return
    iframeRef.current.contentWindow?.postMessage({
      type:      'HIGHLIGHT_ELEMENT',
      elementId: activeElement?.elementId || null,
    }, '*')
  }, [activeElement, iframeReady])

  // ── Collapsed ───────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button className="dv-collapsed-btn" onClick={() => setCollapsed(false)}>
        <Eye size={16} />
        <span>Ver documento</span>
      </button>
    )
  }

  return (
    <div className="document-viewer">
      {/* Header */}
      <div className="dv-header">
        <span className="dv-title">
          <FileText size={14} />
          Documento original
        </span>
        <button className="dv-collapse-btn" onClick={() => setCollapsed(true)} title="Ocultar painel">
          <EyeOff size={14} />
        </button>
      </div>

      {/* Aviso para PDF */}
      {fileType === 'pdf' && <PdfWarning />}

      {/* Loading */}
      {loading && <div className="dv-loading"><div className="dv-spinner" /></div>}

      {/* Caso: docx MAS sem htmlUrl — HTML não foi gerado */}
      {!loading && fileType === 'docx' && !htmlUrl && (
        <DocxNotReady
          regen={regen}
          onRegenerate={handleRegenerate}
        />
      )}

      {/* Caso normal: docx com htmlUrl — iframe com highlights */}
      {!loading && fileType === 'docx' && htmlUrl && (
        <div className="dv-iframe-wrapper">
          <iframe
            ref={iframeRef}
            src={htmlUrl}
            className="dv-iframe"
            sandbox="allow-scripts allow-same-origin"
            title="Documento PPP"
            onLoad={() => setTimeout(() => setIframeReady(true), 100)}
          />
          {activeElement && <ActiveElementTag element={activeElement} />}
        </div>
      )}

      {/* Excerpts — fallback universal abaixo do iframe (ou sozinho p/ PDF) */}
      {!loading && activeElement?.aiResult?.excerpts?.length > 0 && (
        <div className="dv-excerpts-section">
          <p className="dv-excerpts-title">
            {fileType === 'docx' ? 'Trechos citados pela análise' : 'Trechos extraídos do documento'}
          </p>
          <ExcerptCards
            excerpts={activeElement.aiResult.excerpts}
            keywords={activeElement._keywords || []}
            status={activeElement.effectiveStatus}
          />
        </div>
      )}

      {!loading && !activeElement && fileType === 'docx' && htmlUrl && (
        <p className="dv-hint">Selecione um elemento no checklist para destacar os trechos no documento.</p>
      )}
    </div>
  )
}

// ─── Aviso de PDF ─────────────────────────────────────────────────────────────
function PdfWarning() {
  return (
    <div className="dv-pdf-warning">
      <AlertTriangle size={15} />
      <div>
        <strong>Funcionalidades reduzidas</strong>
        <p>
          O PPP foi enviado em formato PDF. A visualização com destaque de trechos
          no documento original não está disponível. Para a experiência completa,
          reenvie o documento em formato <strong>.docx</strong>.
        </p>
      </div>
    </div>
  )
}

// ─── Docx sem HTML gerado ─────────────────────────────────────────────────────
function DocxNotReady({ regen, onRegenerate }) {
  return (
    <div className="dv-not-ready">
      <FileX size={32} className="dv-not-ready-icon" />
      <p className="dv-not-ready-title">Visualizador não processado</p>
      <p className="dv-not-ready-desc">
        O documento foi enviado como .docx mas o visualizador com
        destaque de trechos ainda não foi gerado.
      </p>
      {regen.error && (
        <p className="dv-not-ready-error">{regen.error}</p>
      )}
      <button
        className="dv-regen-btn"
        onClick={onRegenerate}
        disabled={regen.loading}
      >
        <RefreshCw size={13} className={regen.loading ? 'spin' : ''} />
        {regen.loading ? 'Processando…' : 'Gerar visualizador'}
      </button>
    </div>
  )
}

// ─── Tag do elemento ativo sobre o iframe ────────────────────────────────────
function ActiveElementTag({ element }) {
  const STATUS_COLOR = {
    adequate:          '#16a34a',
    adequate_implicit: '#0d9488',
    attention:         '#ca8a04',
    critical:          '#dc2626',
  }
  const color = STATUS_COLOR[element.effectiveStatus] || '#6b7280'
  return (
    <div className="dv-active-tag" style={{ borderLeftColor: color }}>
      <span className="dv-active-label">{element.label}</span>
      <span className="dv-active-hint">trechos destacados no documento</span>
    </div>
  )
}
