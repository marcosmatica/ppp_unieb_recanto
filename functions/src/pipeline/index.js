/**
 * pipeline/index.js
 * Cloud Function (2nd gen) — disparada por upload no Cloud Storage
 * Orquestra as etapas do pipeline de análise de PPP
 *
 * Fase 1 (automática): extração → seções → Haiku → grava resultados
 *   → status: 'haiku_complete', lista deepCandidates no doc de análise
 * Fase 2 (sob demanda): usuário confirma → triggerDeepReview (deepReview.js)
 */

const { defineSecret } = require('firebase-functions/params')
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

const { onObjectFinalized } = require('firebase-functions/v2/storage')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { extractText } = require('./extractor')
const { detectSections } = require('./sectionDetector')
const { analyzeAllElements } = require('./elementAnalyzer')
const { runComparison } = require('./comparator')
const { logger } = require('firebase-functions')

const db = getFirestore()

// ─── Trigger ──────────────────────────────────────────────────────────────────
exports.triggerDeepReview = require('./pipeline/deepReview').triggerDeepReview

exports.onPPPUploaded = onObjectFinalized(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '1GiB',
    concurrency: 10,
    secrets: [ANTHROPIC_API_KEY],
  },
  async (event) => {
    const filePath    = event.data.name
    const contentType = event.data.contentType

    if (!filePath.startsWith('analyses/')) return
    if (!isDocumentFile(contentType)) return

    const segments   = filePath.split('/')
    const analysisId = segments[1]
    const fileName   = segments[2]
    const pppYear    = fileName.startsWith('ppp2026') ? 2026 : 2025

    const analysisRef = db.collection('analyses').doc(analysisId)

    try {
      // ── 1. Lê dados da análise e escola ─────────────────────────────────────
      const analysisSnap = await analysisRef.get()
      if (!analysisSnap.exists) throw new Error(`Análise ${analysisId} não encontrada`)
      const analysis = analysisSnap.data()

      const schoolSnap = await db.collection('schools').doc(analysis.schoolId).get()
      if (!schoolSnap.exists) throw new Error(`Escola ${analysis.schoolId} não encontrada`)
      const school = { id: schoolSnap.id, ...schoolSnap.data() }

      await analysisRef.update({ 'aiAnalysis.status': 'extracting', updatedAt: Timestamp.now() })

      // ── 2. Extração de texto ─────────────────────────────────────────────────
      const bucket = getStorage().bucket(event.data.bucket)
      const file   = bucket.file(filePath)
      const [buffer] = await file.download()

      const { text: fullText, method, pageCount } = await extractText(buffer, contentType)
      await analysisRef.update({ 'aiAnalysis.status': 'analyzing', updatedAt: Timestamp.now() })

      // ── 3. Detecção de seções ────────────────────────────────────────────────
      const sectionMap = detectSections(fullText)

      // ── 4. Carrega checklist e filtra por escola ─────────────────────────────
      const allElements = await getChecklistDefinitions()
      const applicable  = filterBySchoolStages(allElements, school.stages || {})

      // ── 5. Análise Haiku (lote por bloco) ────────────────────────────────────
      const { results, deepCandidates } = await analyzeAllElements({
        elements: applicable,
        sectionMap,
        fullText,
        school,
        analysisId,
        year: pppYear,
      })

      // ── 6. Grava resultados no Firestore ─────────────────────────────────────
      await saveElementResults(analysisId, results)

      // ── 7. Comparação com ano anterior (se existir) ──────────────────────────
      await runComparison(analysisId, results)

      // ── 8. Atualiza status — haiku_complete ───────────────────────────────────
      //    deepCandidates: IDs dos elementos críticos com score baixo
      //    O frontend detecta este status e exibe o banner de confirmação
      const stats = computeStats(results)

      await analysisRef.update({
        'aiAnalysis.status':           'haiku_complete',
        'aiAnalysis.ranAt':            Timestamp.now(),
        'aiAnalysis.model':            'haiku',
        'aiAnalysis.deepCandidates':   deepCandidates,
        'aiAnalysis.deepReviewDone':   false,
        'aiAnalysis.method':           method,
        'aiAnalysis.pageCount':        pageCount,
        [`${pppYear === 2026 ? 'ppp2026' : 'ppp2025'}.extractedText`]: true,
        stats,
        updatedAt: Timestamp.now(),
      })

      // ── 9. Log de auditoria ──────────────────────────────────────────────────
      await db.collection('audit_log').add({
        action:     'haiku_analysis_complete',
        analysisId,
        schoolId:   analysis.schoolId,
        userId:     'system',
        elementId:  null,
        before:     null,
        after:      {
          status:         'haiku_complete',
          elementCount:   applicable.length,
          deepCandidates: deepCandidates.length,
        },
        metadata:   { method, pageCount, pppYear },
        timestamp:  Timestamp.now(),
      })

      logger.info(`Fase 1 (Haiku) concluída`, {
        analysisId,
        elements: applicable.length,
        deepCandidates: deepCandidates.length,
      })

    } catch (err) {
      logger.error(`Erro no pipeline`, { analysisId, error: err.message })
      await analysisRef.update({
        'aiAnalysis.error': err.message,
        'aiAnalysis.status': 'error',
        'aiAnalysis.ranAt':  Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      throw err
    }
  }
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDocumentFile(contentType) {
  return [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ].includes(contentType)
}

let _checklistCache = null
async function getChecklistDefinitions() {
  if (_checklistCache) return _checklistCache
  const snap = await db.collection('checklist_definitions')
    .where('active', '==', true)
    .orderBy('blockCode')
    .orderBy('order')
    .get()
  _checklistCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return _checklistCache
}

function filterBySchoolStages(elements, stages) {
  return elements.filter(el => {
    if (!el.isConditional) return true
    return stages[el.conditionKey] === true
  })
}

async function saveElementResults(analysisId, results) {
  const ref = db.collection('analyses').doc(analysisId).collection('elementResults')
  const BATCH_SIZE = 500

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = db.batch()
    results.slice(i, i + BATCH_SIZE).forEach(result => {
      batch.set(ref.doc(result.elementId), result)
    })
    await batch.commit()
  }
}

function computeStats(results) {
  const counts = { adequate: 0, adequate_implicit: 0, attention: 0, critical: 0, not_applicable: 0 }
  results.forEach(r => { counts[r.effectiveStatus] = (counts[r.effectiveStatus] || 0) + 1 })
  const total    = results.length
  const approved = counts.adequate + counts.adequate_implicit
  return { ...counts, total, score: total > 0 ? Math.round((approved / total) * 100) : 0 }
}
