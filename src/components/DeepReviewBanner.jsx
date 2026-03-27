/**
 * src/components/DeepReviewBanner.jsx
 *
 * Observa o campo aiAnalysis.status da análise via onSnapshot.
 * Quando status === 'haiku_complete' e existem deepCandidates,
 * exibe um banner explicativo com botão de confirmação.
 *
 * Props:
 *   analysisId  — string
 *   onComplete  — callback chamado após deep review concluído (opcional)
 */

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../services/firebase'

const STATUS_LABELS = {
  adequate:          { label: 'adequado',         color: 'var(--color-success)' },
  adequate_implicit: { label: 'adequado (impl.)', color: 'var(--color-success)' },
  attention:         { label: 'atenção',           color: 'var(--color-warning)' },
  critical:          { label: 'crítico',           color: 'var(--color-danger)'  },
}

export default function DeepReviewBanner({ analysisId, onComplete }) {
  const [aiAnalysis,  setAiAnalysis]  = useState(null)
  const [candidates,  setCandidates]  = useState([])   // elementResults dos candidatos
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [dismissed,   setDismissed]   = useState(false)

  // ── Observa o documento da análise ─────────────────────────────────────────
  useEffect(() => {
    if (!analysisId) return
    const unsub = onSnapshot(doc(db, 'analyses', analysisId), snap => {
      if (snap.exists()) setAiAnalysis(snap.data().aiAnalysis || null)
    })
    return unsub
  }, [analysisId])

  // ── Carrega os elementResults dos candidatos para exibir na prévia ──────────
  useEffect(() => {
    if (!aiAnalysis || aiAnalysis.status !== 'haiku_complete') return
    const ids = aiAnalysis.deepCandidates || []
    if (ids.length === 0) return

    // Lê os elementResults já gravados pelo Haiku
    import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
      const q = query(
        collection(db, 'analyses', analysisId, 'elementResults'),
        where('elementId', 'in', ids.slice(0, 10)) // Firestore 'in' limite: 10
      )
      getDocs(q).then(snap => {
        setCandidates(snap.docs.map(d => d.data()))
      })
    })
  }, [aiAnalysis, analysisId])

  // ── Nada a mostrar ──────────────────────────────────────────────────────────
  if (!aiAnalysis) return null
  if (dismissed)   return null
  if (aiAnalysis.status === 'complete' || aiAnalysis.deepReviewDone) return null
  if (aiAnalysis.status === 'deep_reviewing') return <ReviewingIndicator />
  if (aiAnalysis.status !== 'haiku_complete') return null

  const deepIds = aiAnalysis.deepCandidates || []
  if (deepIds.length === 0) return null

  // ── Confirmação ─────────────────────────────────────────────────────────────
  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const triggerDeepReview = httpsCallable(functions, 'triggerDeepReview')
      await triggerDeepReview({ analysisId })
      onComplete?.()
    } catch (err) {
      setError(err.message || 'Erro ao iniciar análise aprofundada.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="deep-review-banner" role="region" aria-label="Análise aprofundada disponível">
      <div className="drb-header">
        <span className="drb-icon">🔍</span>
        <div>
          <p className="drb-title">Análise aprofundada disponível</p>
          <p className="drb-subtitle">
            {deepIds.length} elemento{deepIds.length > 1 ? 's' : ''} crítico{deepIds.length > 1 ? 's' : ''} com
            resultado incerto foram identificados pela análise inicial (Haiku).
            Uma análise aprofundada com o modelo Sonnet pode melhorar a precisão
            desses resultados — especialmente em conteúdo pedagógico implícito.
          </p>
        </div>
      </div>

      {/* Prévia dos candidatos */}
      {candidates.length > 0 && (
        <div className="drb-candidates">
          <p className="drb-candidates-label">Elementos que serão re-analisados:</p>
          <ul className="drb-candidates-list">
            {candidates.map(el => (
              <li key={el.elementId} className="drb-candidate-item">
                <span className="drb-candidate-label">{el.label}</span>
                <span
                  className="drb-candidate-status"
                  style={{ color: STATUS_LABELS[el.aiResult?.status]?.color }}
                >
                  {STATUS_LABELS[el.aiResult?.status]?.label ?? el.aiResult?.status}
                  {' · '}score {Math.round((el.aiResult?.score ?? 0) * 100)}%
                </span>
                {el.aiResult?.summary && (
                  <span className="drb-candidate-summary">{el.aiResult.summary}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="drb-error">{error}</p>}

      <div className="drb-actions">
        <button
          className="drb-btn-secondary"
          onClick={() => setDismissed(true)}
          disabled={loading}
        >
          Usar somente análise inicial
        </button>
        <button
          className="drb-btn-primary"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? 'Analisando…' : `Confirmar análise aprofundada (${deepIds.length} elemento${deepIds.length > 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}

function ReviewingIndicator() {
  return (
    <div className="deep-review-banner deep-review-banner--reviewing">
      <span className="drb-icon drb-icon--spin">⏳</span>
      <p className="drb-title">Análise aprofundada em andamento…</p>
      <p className="drb-subtitle">O modelo Sonnet está re-analisando os elementos críticos. Isso pode levar alguns minutos.</p>
    </div>
  )
}
