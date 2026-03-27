/**
 * pipeline/comparator.js
 * Compara elementResults do PPP 2026 com os do PPP 2025.
 *
 * pipeline/statsUpdater.js (exportado junto)
 * Cloud Function (Firestore trigger) que recalcula analyses.stats
 * sempre que um elementResult for atualizado pelo analista.
 */

const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { logger } = require('firebase-functions')

const db = getFirestore()

// ─── Status positivos (aprovação) ────────────────────────────────────────────
// adequate_implicit é tão válido quanto adequate — linguagem pedagógica própria da escola

const POSITIVE_STATUSES = new Set(['adequate', 'adequate_implicit'])

// Ordem para cálculo de melhora/regressão
// adequate_implicit e adequate têm o mesmo peso (3)
const STATUS_ORDER = {
  adequate:          3,
  adequate_implicit: 3,
  attention:         2,
  critical:          1,
  not_applicable:    0,
}

function isImprovement(prev, curr) {
  return (STATUS_ORDER[curr] ?? 0) > (STATUS_ORDER[prev] ?? 0)
}

function isRegression(prev, curr) {
  return (STATUS_ORDER[curr] ?? 0) < (STATUS_ORDER[prev] ?? 0)
}

// ─── Comparator ───────────────────────────────────────────────────────────────

async function runComparison(analysisId2026, results2026) {
  const analysis2026Snap = await db.collection('analyses').doc(analysisId2026).get()
  const { schoolId, year } = analysis2026Snap.data()

  const prevId   = `${schoolId}_${year - 1}`
  const prevSnap = await db.collection('analyses').doc(prevId).get()

  if (!prevSnap.exists) {
    logger.info(`Sem análise anterior para comparação`, { analysisId2026 })
    return
  }

  const prevResultsSnap = await db
    .collection('analyses').doc(prevId)
    .collection('elementResults')
    .get()

  const prevMap = {}
  prevResultsSnap.docs.forEach(d => { prevMap[d.id] = d.data().effectiveStatus })

  const batch = db.batch()
  const currentResultsRef = db
    .collection('analyses').doc(analysisId2026)
    .collection('elementResults')

  const summary = { newElements: [], removedElements: [], improved: [], regressed: [] }

  for (const result of results2026) {
    const prevStatus = prevMap[result.elementId] || null
    const currStatus = result.effectiveStatus
    let delta

    if (!prevStatus) {
      delta = 'new'
      summary.newElements.push(result.elementId)
    } else if (isImprovement(prevStatus, currStatus)) {
      delta = 'improved'
      summary.improved.push(result.elementId)
    } else if (isRegression(prevStatus, currStatus)) {
      delta = 'regressed'
      summary.regressed.push(result.elementId)
    } else {
      delta = 'same'
    }

    batch.update(currentResultsRef.doc(result.elementId), {
      'comparison2025.previousStatus': prevStatus,
      'comparison2025.delta':          delta,
      updatedAt: Timestamp.now(),
    })
  }

  // Elementos do ano anterior removidos em 2026
  for (const pId of Object.keys(prevMap)) {
    if (!results2026.find(r => r.elementId === pId)) {
      summary.removedElements.push(pId)
    }
  }

  await batch.commit()

  await db.collection('analyses').doc(analysisId2026).update({
    'comparison.ranAt':           Timestamp.now(),
    'comparison.newElements':     summary.newElements,
    'comparison.removedElements': summary.removedElements,
    'comparison.improved':        summary.improved,
    'comparison.regressed':       summary.regressed,
    updatedAt: Timestamp.now(),
  })

  logger.info(`Comparativo 2025→2026 concluído`, { analysisId2026, ...summary })
}

// ─── Stats Updater (Firestore Trigger) ───────────────────────────────────────

exports.onElementResultUpdated = onDocumentUpdated(
  { document: 'analyses/{analysisId}/elementResults/{elementId}', region: 'southamerica-east1' },
  async (event) => {
    const { analysisId } = event.params
    const newData = event.data.after.data()
    const oldData = event.data.before.data()

    const statusChanged =
      newData.effectiveStatus    !== oldData.effectiveStatus ||
      newData.humanReview?.status !== oldData.humanReview?.status

    if (!statusChanged) return

    const snap = await db
      .collection('analyses').doc(analysisId)
      .collection('elementResults')
      .get()

    const stats = snap.docs.reduce((acc, doc) => {
      const d  = doc.data()
      const s  = d.effectiveStatus
      const hr = d.humanReview?.status

      acc.total++

      if (s === 'critical')          acc.critical++
      else if (s === 'attention')    acc.attention++
      else if (POSITIVE_STATUSES.has(s)) {
        acc.adequate++   // agrupa adequate + adequate_implicit no mesmo contador de aprovados
        if (s === 'adequate_implicit') acc.adequate_implicit = (acc.adequate_implicit || 0) + 1
      }

      if (hr === 'confirmed' || hr === 'overridden' || hr === 'skipped') acc.confirmed++
      if (hr === 'overridden') acc.overridden++

      return acc
    }, {
      total: 0, critical: 0, attention: 0,
      adequate: 0, adequate_implicit: 0,
      confirmed: 0, overridden: 0,
    })

    // Score de aprovação considera ambos os status positivos
    stats.score = stats.total > 0
      ? Math.round((stats.adequate / stats.total) * 100)
      : 0

    await db.collection('analyses').doc(analysisId).update({ stats, updatedAt: Timestamp.now() })
  }
)

// ─── Human Review (callable) ─────────────────────────────────────────────────

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

    let effectiveStatus, hrStatus
    if (decision === 'agree') {
      effectiveStatus = aiStatus
      hrStatus = 'confirmed'
    } else if (decision === 'disagree') {
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

    await db.collection('audit_log').add({
      action: 'element_reviewed', analysisId, schoolId: null, userId, elementId,
      before: { effectiveStatus: el.effectiveStatus, hrStatus: el.humanReview?.status },
      after:  { effectiveStatus, hrStatus },
      metadata: { decision, hasComment: !!comment },
      timestamp: Timestamp.now(),
    })

    return { success: true, effectiveStatus }
  }
)

module.exports.runComparison = runComparison
