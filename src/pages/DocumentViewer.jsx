/**
 * src/components/DocumentViewer.jsx
 *
 * Mudanças em relação à versão anterior:
 * - Usa useTheme() (retorna { darkMode }) em vez de useContext(ThemeContext)
 * - Envia SET_THEME ao iframe quando darkMode muda ou iframe fica pronto
 * - hideExcerpts prop mantida
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../services/firebase'
import { AlertTriangle, FileText, Eye, EyeOff, RefreshCw, FileX } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import ExcerptCards from './ExcerptCards'
import './DocumentViewer.css'

export default function DocumentViewer({ analysisId, activeElement, onMarkClick, hideExcerpts = false }) {
  const iframeRef = useRef(null)
  const { darkMode } = useTheme()

  const [htmlUrl,     setHtmlUrl]     = useState(null)
  const [fileType,    setFileType]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [iframeReady, setIframeReady] = useState(false)
  const [collapsed,   setCollapsed]   = useState(false)
  const [regen,       setRegen]       = useState({ loading: false, error: null })

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
      .catch(() => { setHtmlUrl(null); setFileType(null) })
      .finally(() => setLoading(false))
  }, [analysisId])

  useEffect(() => { loadViewerUrl() }, [loadViewerUrl])

  const handleRegenerate = useCallback(async () => {
    setRegen({ loading: true, error: null })
    try {
      const regenerate = httpsCallable(functions, 'regenerateHighlightedHtml')
      await regenerate({ analysisId })
      loadViewerUrl()
      setRegen({ loading: false, error: null })
    } catch (err) {
      setRegen({ loading: false, error: err.message || 'Erro ao reprocessar.' })
    }
  }, [analysisId, loadViewerUrl])

  // Escuta mensagens do iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'MARK_CLICKED') {
        onMarkClick?.({ elementId: e.data.elementId, label: e.data.label, status: e.data.status })
      }
      if (e.data?.type === 'IFRAME_READY') {
        setIframeReady(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onMarkClick])

  // Envia highlight ao iframe
  useEffect(() => {
    if (!iframeRef.current) return
    const send = () => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'HIGHLIGHT_ELEMENT',
        elementId: activeElement?.elementId || null,
      }, '*')
    }
    if (iframeReady) { send() }
    else if (htmlUrl) { const t = setTimeout(send, 800); return () => clearTimeout(t) }
  }, [activeElement, iframeReady, htmlUrl])

  // Sincroniza tema dark/light com o iframe via postMessage
  // (complementa a leitura de localStorage que o iframe já faz no load)
  useEffect(() => {
    if (!iframeRef.current) return
    const send = () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'SET_THEME', dark: darkMode }, '*')
    }
    if (iframeReady) { send() }
    else if (htmlUrl) { const t = setTimeout(send, 400); return () => clearTimeout(t) }
  }, [darkMode, iframeReady, htmlUrl])

  if (collapsed) {
    return (
      <button className="dv-collapsed-btn" onClick={() => setCollapsed(false)}>
        <Eye size={16} /><span>Ver documento</span>
      </button>
    )
  }

  return (
    <div className="document-viewer">
      <div className="dv-header">
        <span className="dv-title"><FileText size={14} />Documento original</span>
        <button className="dv-collapse-btn" onClick={() => setCollapsed(true)} title="Ocultar painel">
          <EyeOff size={14} />
        </button>
      </div>

      {fileType === 'pdf' && <PdfWarning />}
      {loading && <div className="dv-loading"><div className="dv-spinner" /></div>}

      {!loading && fileType === 'docx' && !htmlUrl && (
        <DocxNotReady regen={regen} onRegenerate={handleRegenerate} />
      )}

      {!loading && fileType === 'docx' && htmlUrl && (
        <div className="dv-iframe-wrapper">
          <iframe
            ref={iframeRef}
            src={htmlUrl}
            className="dv-iframe"
            sandbox="allow-scripts allow-same-origin"
            title="Documento PPP"
            onLoad={() => {
              // Envia tema IMEDIATAMENTE, sem timeout
              iframeRef.current?.contentWindow?.postMessage({
                type: 'SET_THEME',
                dark: darkMode,
              }, '*')

              setTimeout(() => {
                setIframeReady(true)
                iframeRef.current?.contentWindow?.postMessage({
                  type: 'HIGHLIGHT_ELEMENT',
                  elementId: activeElement?.elementId || null,
                }, '*')
              }, 300)
            }}
          />
          {activeElement && <ActiveElementTag element={activeElement} />}
        </div>
      )}

      {!hideExcerpts && !loading && activeElement?.aiResult?.excerpts?.length > 0 && (
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

function PdfWarning() {
  return (
    <div className="dv-pdf-warning">
      <AlertTriangle size={15} />
      <div>
        <strong>Funcionalidades reduzidas</strong>
        <p>O PPP foi enviado em formato PDF. Para a experiência completa, reenvie em <strong>.docx</strong>.</p>
      </div>
    </div>
  )
}

function DocxNotReady({ regen, onRegenerate }) {
  return (
    <div className="dv-not-ready">
      <FileX size={32} className="dv-not-ready-icon" />
      <p className="dv-not-ready-title">Visualizador não processado</p>
      <p className="dv-not-ready-desc">O documento foi enviado como .docx mas o visualizador ainda não foi gerado.</p>
      {regen.error && <p className="dv-not-ready-error">{regen.error}</p>}
      <button className="dv-regen-btn" onClick={onRegenerate} disabled={regen.loading}>
        <RefreshCw size={13} className={regen.loading ? 'spin' : ''} />
        {regen.loading ? 'Processando…' : 'Gerar visualizador'}
      </button>
    </div>
  )
}

function ActiveElementTag({ element }) {
  const STATUS_COLOR = {
    adequate: '#16a34a', adequate_implicit: '#0d9488',
    attention: '#ca8a04', critical: '#dc2626',
  }
  const color = STATUS_COLOR[element.effectiveStatus] || '#6b7280'
  return (
    <div className="dv-active-tag" style={{ borderLeftColor: color }}>
      <span className="dv-active-label">{element.label}</span>
      <span className="dv-active-hint">trechos destacados no documento</span>
    </div>
  )
}
