/**
 * src/components/DocumentViewer.jsx
 *
 * Painel lateral de visualização do documento original com highlights.
 *
 * Para .docx: carrega o HTML gerado pelo docxHighlighter via URL assinada.
 *   - Ao selecionar um elemento no checklist, envia postMessage para o iframe
 *     que rola e destaca os marks correspondentes.
 *   - Cliques em marks dentro do iframe notificam o pai via postMessage.
 *
 * Para .pdf: exibe aviso de limitação + fallback de excerpts em texto.
 *
 * Props:
 *   analysisId    — string
 *   activeElement — elementResult atualmente selecionado (ou null)
 *   onMarkClick   — callback({ elementId, label, status }) ao clicar num mark
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../services/firebase'
import { AlertTriangle, FileText, Eye, EyeOff } from 'lucide-react'
import ExcerptCards from './ExcerptCards'
import './DocumentViewer.css'

export default function DocumentViewer({ analysisId, activeElement, onMarkClick }) {
  const iframeRef           = useRef(null)
  const [htmlUrl, setHtmlUrl]     = useState(null)   // URL assinada do HTML
  const [fileType, setFileType]   = useState(null)   // 'docx' | 'pdf' | null
  const [loading, setLoading]     = useState(true)
  const [iframeReady, setIframeReady] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // ── Carrega URL do HTML highlighted ────────────────────────────────────────
  useEffect(() => {
    if (!analysisId) return
    setLoading(true)

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

  // ── Escuta mensagens do iframe (mark clicado) ───────────────────────────────
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

  // ── Envia postMessage para o iframe quando muda o elemento ativo ────────────
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return
    iframeRef.current.contentWindow?.postMessage({
      type:      'HIGHLIGHT_ELEMENT',
      elementId: activeElement?.elementId || null,
    }, '*')
  }, [activeElement, iframeReady])

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
      {fileType === 'pdf' && (
        <PdfWarning />
      )}

      {/* Conteúdo principal */}
      {loading && <div className="dv-loading"><div className="dv-spinner" /></div>}

      {!loading && fileType === 'docx' && htmlUrl && (
        <div className="dv-iframe-wrapper">
          <iframe
            ref={iframeRef}
            src={htmlUrl}
            className="dv-iframe"
            sandbox="allow-scripts allow-same-origin"
            title="Documento PPP"
            onLoad={() => {
              // Sinaliza prontidão após carregamento
              setTimeout(() => setIframeReady(true), 100)
            }}
          />
          {activeElement && (
            <ActiveElementTag element={activeElement} />
          )}
        </div>
      )}

      {/* Fallback de excerpts — sempre visível abaixo do iframe (ou sozinho p/ PDF) */}
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
        <strong>Visualização limitada</strong>
        <p>
          O PPP foi enviado em formato PDF. A visualização com destaque de trechos
          no documento original não está disponível — apenas os trechos extraídos
          pela IA serão exibidos abaixo. Para a experiência completa, reenvie o
          documento no formato <strong>.docx</strong>.
        </p>
      </div>
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
