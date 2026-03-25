/**
 * pipeline/comparator.js
 * Compara os elementResults do PPP 2026 com os do PPP 2025
 * e preenche o campo comparison2025.delta em cada elemento.
 *
 * pipeline/statsUpdater.js (exportado junto)
 * Cloud Function (Firestore trigger) que recalcula analyses.stats
 * sempre que um elementResult for atualizado pelo analista.
 */

const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { logger } = require('firebase-functions')

const db = getFirestore()

// ─── Comparator ───────────────────────────────────────────────────────────────

/**
 * Lê os elementResults do mesmo ano anterior (mesma escola, ano-1)
 * e calcula o delta para cada elemento do ano atual.
 */
async function runComparison(analysisId2026, results2026) {
  const analysis2026Snap = await db.collection('analyses').doc(analysisId2026).get()
  const { schoolId, year } = analysis2026Snap.data()

  // Busca análise do ano anterior para a mesma escola
  const prevId = `${schoolId}_${year - 1}`
  const prevSnap = await db.collection('analyses').doc(prevId).get()

  if (!prevSnap.exists) {
    logger.info(`Sem análise anterior para comparação`, { analysisId2026 })
    return
  }

  // Carrega elementResults do ano anterior
  const prevResultsSnap = await db
    .collection('analyses').doc(prevId)
    .collection('elementResults')
    .get()

  const prevMap = {}
  prevResultsSnap.docs.forEach(d => {
    prevMap[d.id] = d.data().effectiveStatus
  })

  // Calcula deltas e atualiza em batch
  const batch = db.batch()
  const currentResultsRef = db
    .collection('analyses').doc(analysisId2026)
    .collection('elementResults')

  const comparisonSummary = {
    newElements:     [],
    removedElements: [],
    improved:        [],
    regressed:       [],
  }

  for (const result of results2026) {
    const prevStatus = prevMap[result.elementId] || null
    const currStatus = result.effectiveStatus

    let delta = null

    if (!prevStatus) {
      delta = 'new'
      comparisonSummary.newElements.push(result.elementId)
    } else if (isImprovement(prevStatus, currStatus)) {
      delta = 'improved'
      comparisonSummary.improved.push(result.elementId)
    } else if (isRegression(prevStatus, currStatus)) {
      delta = 'regressed'
      comparisonSummary.regressed.push(result.elementId)
    } else {
      delta = 'same'
    }

    const docRef = currentResultsRef.doc(result.elementId)
    batch.update(docRef, {
      'comparison2025.previousStatus': prevStatus,
      'comparison2025.delta':          delta,
      updatedAt: Timestamp.now(),
    })
  }

  // Elementos do ano anterior que não existem em 2026
  for (const prevId of Object.keys(prevMap)) {
    if (!results2026.find(r => r.elementId === prevId)) {
      comparisonSummary.removedElements.push(prevId)
    }
  }

  await batch.commit()

  // Persiste o resumo comparativo na análise
  await db.collection('analyses').doc(analysisId2026).update({
    'comparison.ranAt':           Timestamp.now(),
    'comparison.newElements':     comparisonSummary.newElements,
    'comparison.removedElements': comparisonSummary.removedElements,
    'comparison.improved':        comparisonSummary.improved,
    'comparison.regressed':       comparisonSummary.regressed,
    updatedAt: Timestamp.now(),
  })

  logger.info(`Comparativo 2025→2026 concluído`, {
    analysisId2026,
    ...comparisonSummary,
  })
}

const STATUS_ORDER = { adequate: 3, attention: 2, critical: 1, not_applicable: 0 }

function isImprovement(prev, curr) {
  return (STATUS_ORDER[curr] || 0) > (STATUS_ORDER[prev] || 0)
}
function isRegression(prev, curr) {
  return (STATUS_ORDER[curr] || 0) < (STATUS_ORDER[prev] || 0)
}

// ─── Stats Updater (Firestore Trigger) ───────────────────────────────────────
// Recalcula analyses.stats sempre que o analista revisa um elemento.
// Evita que o front-end precise fazer queries pesadas para montar o dashboard.

exports.onElementResultUpdated = onDocumentUpdated(
  {
    document:  'analyses/{analysisId}/elementResults/{elementId}',
    region:    'southamerica-east1',
  },
  async (event) => {
    const { analysisId } = event.params
    const newData = event.data.after.data()
    const oldData = event.data.before.data()

    // Só recalcula se effectiveStatus ou humanReview.status mudou
    const statusChanged =
      newData.effectiveStatus !== oldData.effectiveStatus ||
      newData.humanReview?.status !== oldData.humanReview?.status

    if (!statusChanged) return

    // Lê todos os elementResults da análise para recalcular do zero
    const snap = await db
      .collection('analyses').doc(analysisId)
      .collection('elementResults')
      .get()

    const stats = snap.docs.reduce((acc, doc) => {
      const d = doc.data()
      acc.total++
      const s = d.effectiveStatus
      if (s === 'critical')       acc.critical++
      else if (s === 'attention') acc.attention++
      else if (s === 'adequate')  acc.adequate++

      const hr = d.humanReview?.status
      if (hr === 'confirmed' || hr === 'overridden' || hr === 'skipped') {
        acc.confirmed++
      }
      if (hr === 'overridden') acc.overridden++

      return acc
    }, { total: 0, critical: 0, attention: 0, adequate: 0, confirmed: 0, overridden: 0 })

    await db.collection('analyses').doc(analysisId).update({
      stats,
      updatedAt: Timestamp.now(),
    })
  }
)

// ─── Human Review Updater (chamado pelo front-end via callable function) ──────
// Consolida a decisão do analista: agree → confirma IA; disagree → override

exports.submitHumanReview = require('firebase-functions/v2/https').onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    const { analysisId, elementId, decision, comment } = request.data
    const userId = request.auth?.uid
    if (!userId) throw new Error('Não autenticado')

    const elementRef = db
      .collection('analyses').doc(analysisId)
      .collection('elementResults').doc(elementId)

    const snap = await elementRef.get()
    if (!snap.exists) throw new Error('Elemento não encontrado')

    const el = snap.data()
    const aiStatus = el.aiResult.status

    // Calcula effectiveStatus com base na decisão
    let effectiveStatus
    let hrStatus
    if (decision === 'agree') {
      effectiveStatus = aiStatus
      hrStatus = 'confirmed'
    } else if (decision === 'disagree') {
      // Analista discordou → considera o elemento adequado (ele sabe mais)
      effectiveStatus = 'adequate'
      hrStatus = 'overridden'
    } else {
      hrStatus = 'skipped'
      effectiveStatus = aiStatus
    }

    await elementRef.update({
      'humanReview.status':     hrStatus,
      'humanReview.decision':   decision,
      'humanReview.comment':    comment || null,
      'humanReview.reviewedAt': Timestamp.now(),
      'humanReview.reviewedBy': userId,
      effectiveStatus,
      updatedAt: Timestamp.now(),
    })

    // Audit log
    await db.collection('audit_log').add({
      action:     'element_reviewed',
      analysisId,
      schoolId:   null,
      userId,
      elementId,
      before:     { effectiveStatus: el.effectiveStatus, hrStatus: el.humanReview?.status },
      after:      { effectiveStatus, hrStatus },
      metadata:   { decision, hasComment: !!comment },
      timestamp:  Timestamp.now(),
    })

    return { success: true, effectiveStatus }
  }
)

module.exports.runComparison = runComparison
