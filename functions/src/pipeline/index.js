/**
 * pipeline/index.js
 * Cloud Function (2nd gen) — disparada por upload no Cloud Storage
 * Orquestra as etapas 1–8 do pipeline de análise de PPP
 *
 * Trigger: gs://{bucket}/analyses/{analysisId}/{fileName}
 */

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

exports.onPPPUploaded = onObjectFinalized(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 540,      // 9 min — análise completa pode demorar
    memory: '1GiB',
    concurrency: 10,
  },
  async (event) => {
    const filePath = event.data.name         // "analyses/{analysisId}/ppp2026.pdf"
    const contentType = event.data.contentType

    // Só processa arquivos de PPP (ignora saídas do próprio pipeline)
    if (!filePath.startsWith('analyses/')) return
    if (!isDocumentFile(contentType)) return

    const segments = filePath.split('/')
    const analysisId = segments[1]
    const fileName   = segments[2]            // "ppp2026.pdf" ou "ppp2025.pdf"
    const pppYear    = fileName.startsWith('ppp2026') ? 2026 : 2025

    logger.info(`Pipeline iniciado`, { analysisId, pppYear, filePath })

    const analysisRef = db.collection('analyses').doc(analysisId)

    try {
      // ── Marca início do processamento ───────────────────────────────────────
      await analysisRef.update({
        status: 'pending',
        'aiAnalysis.startedAt': Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      // ── Etapa 2: Extração de texto ───────────────────────────────────────────
      const bucket = getStorage().bucket(event.data.bucket)
      const fileRef = bucket.file(filePath)
      const [fileBuffer] = await fileRef.download()

      const { text, pageCount, method } = await extractText(fileBuffer, contentType, fileName)
      logger.info(`Texto extraído`, { analysisId, method, pageCount, chars: text.length })

      // ── Etapa 3: Detecção de seções ──────────────────────────────────────────
      const sectionMap = detectSections(text)
      logger.info(`Seções detectadas`, { analysisId, count: Object.keys(sectionMap).length })

      // ── Etapa 4: Filtra elementos aplicáveis à escola ────────────────────────
      const analysisSnap = await analysisRef.get()
      const analysis     = analysisSnap.data()
      const schoolSnap   = await db.collection('schools').doc(analysis.schoolId).get()
      const school       = schoolSnap.data()

      const allElements = await getChecklistDefinitions()
      const applicable  = filterBySchoolStages(allElements, school.stages)
      logger.info(`Elementos aplicáveis`, { analysisId, total: applicable.length })

      // ── Etapa 5: Análise por elemento (Claude API) ───────────────────────────
      const results = await analyzeAllElements({
        elements: applicable,
        sectionMap,
        fullText: text,
        school,
        analysisId,
        year: pppYear,
      })

      // ── Etapa 6: Grava resultados no Firestore ───────────────────────────────
      await writeResults(analysisId, results, analysis, applicable)

      // ── Etapa 7: Comparativo 2025→2026 (se houver ppp2025) ──────────────────
      if (pppYear === 2026 && analysis.files?.ppp2025?.extractedText) {
        await runComparison(analysisId, results)
      }

      // ── Etapa 8: Marca análise como pronta para revisão ──────────────────────
      await analysisRef.update({
        status: 'in_progress',
        'aiAnalysis.ranAt':        Timestamp.now(),
        'aiAnalysis.modelVersion': 'claude-sonnet-4-6',
        'aiAnalysis.error':        null,
        [`files.${pppYear === 2026 ? 'ppp2026' : 'ppp2025'}.extractedText`]: true,
        updatedAt: Timestamp.now(),
      })

      // Log de auditoria
      await db.collection('audit_log').add({
        action:     'ai_analysis_complete',
        analysisId,
        schoolId:   analysis.schoolId,
        userId:     'system',
        elementId:  null,
        before:     null,
        after:      { status: 'in_progress', elementCount: applicable.length },
        metadata:   { method, pageCount, pppYear },
        timestamp:  Timestamp.now(),
      })

      logger.info(`Pipeline concluído com sucesso`, { analysisId })

    } catch (err) {
      logger.error(`Erro no pipeline`, { analysisId, error: err.message })

      await analysisRef.update({
        'aiAnalysis.error': err.message,
        'aiAnalysis.ranAt': Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      throw err  // Cloud Functions vai retentar automaticamente
    }
  }
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDocumentFile(contentType) {
  return [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ].includes(contentType)
}

/**
 * Lê todos os elementos de /checklist_definitions (são poucos, ~30)
 * e cacheia na instância da função para evitar leituras repetidas.
 */
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

/**
 * Remove elementos condicionais que não se aplicam à escola
 * Exemplo: bloco 4 (Ensino Médio) removido se !school.stages.ensMedio
 */
function filterBySchoolStages(elements, stages) {
  return elements.filter(el => {
    if (!el.isConditional) return true
    const condKey = el.conditionKey               // ex: "ensMedio"
    return stages[condKey] === true
  })
}

/**
 * Grava os resultados da IA em batch no Firestore.
 * Usa batches de 500 (limite do Firestore) e recalcula stats.
 */
async function writeResults(analysisId, results, analysis, applicable) {
  const BATCH_SIZE = 450
  const resultsRef = db
    .collection('analyses').doc(analysisId)
    .collection('elementResults')

  // Batch write dos elementResults
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const slice = results.slice(i, i + BATCH_SIZE)
    for (const result of slice) {
      const docRef = resultsRef.doc(result.elementId)
      batch.set(docRef, result, { merge: false })
    }
    await batch.commit()
  }

  // Recalcula stats
  const stats = results.reduce((acc, r) => {
    acc.total++
    const s = r.aiResult.status
    if (s === 'critical')        acc.critical++
    else if (s === 'attention')  acc.attention++
    else if (s === 'adequate')   acc.adequate++
    return acc
  }, { total: 0, critical: 0, attention: 0, adequate: 0, confirmed: 0, overridden: 0 })

  await db.collection('analyses').doc(analysisId).update({ stats })
}
