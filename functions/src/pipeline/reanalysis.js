/**
 * pipeline/reanalysis.js
 *
 * Cloud Function (callable) que reanalisada elementos de um PPP atualizado,
 * focando nos elementos que não foram confirmados como adequados na análise original.
 *
 * Fluxo:
 *   1. Recebe analysisId + caminho do arquivo atualizado no Storage
 *   2. Extrai texto e detecta seções do novo documento
 *   3. Identifica elementos que precisam ser reanalisados:
 *      - Excluídos: confirmados pelo analista como adequate/adequate_implicit
 *      - Incluídos: todos os demais (pending, skipped, critical, attention)
 *   4. Executa analyzeAllElements no subconjunto selecionado
 *   5. Persiste os novos aiResult, preserva o anterior em previousAiResult
 *   6. Reseta humanReview dos reanalisados para 'pending'
 */

const { onCall }                   = require('firebase-functions/v2/https')
const { getFirestore, Timestamp }  = require('firebase-admin/firestore')
const { getStorage }               = require('firebase-admin/storage')
const { defineSecret }             = require('firebase-functions/params')
const { logger }                   = require('firebase-functions')

const { extractText }        = require('./extractor')
const { detectSections }     = require('./sectionDetector')
const { analyzeAllElements } = require('./elementAnalyzer')
const { loadModeOverrides }  = require('./feedbackAggregator')
const { injectHighlights }   = require('./docxHighlighter')

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')
const db     = getFirestore()
const BUCKET = 'unieb-recanto.firebasestorage.app'

const POSITIVE_STATUSES = new Set(['adequate', 'adequate_implicit'])

exports.triggerReanalysis = onCall(
  {
    region:         'southamerica-east1',
    timeoutSeconds: 540,
    memory:         '1GiB',
    concurrency:    3,
    secrets:        [ANTHROPIC_API_KEY],
  },
  async (request) => {
    const { analysisId, updatedFilePath } = request.data
    const userId = request.auth?.uid
    if (!userId)          throw new Error('Não autenticado')
    if (!analysisId)      throw new Error('analysisId é obrigatório')
    if (!updatedFilePath) throw new Error('updatedFilePath é obrigatório')

    const analysisRef  = db.collection('analyses').doc(analysisId)
    const analysisSnap = await analysisRef.get()
    if (!analysisSnap.exists) throw new Error('Análise não encontrada')
    const analysis = analysisSnap.data()

    await analysisRef.update({
      'reanalysis.status':          'extracting',
      'reanalysis.updatedFilePath': updatedFilePath,
      'reanalysis.startedAt':       Timestamp.now(),
      'reanalysis.error':           null,
      updatedAt: Timestamp.now(),
    })

    try {
      // ── 1. Download + extração de texto do arquivo atualizado ─────────────────
      const bucket      = getStorage().bucket(BUCKET)
      const [buffer]    = await bucket.file(updatedFilePath).download()
      const ext         = updatedFilePath.split('.').pop().toLowerCase()
      const contentType = ext === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const fileName = updatedFilePath.split('/').pop()

      const { text: fullText, method, pageCount, fileType, htmlStoragePath } =
        await extractText(buffer, contentType, fileName, analysisId, BUCKET)

      await analysisRef.update({ 'reanalysis.status': 'analyzing', updatedAt: Timestamp.now() })

      // ── 2. Detecção de seções no novo documento ───────────────────────────────
      const sectionMap = detectSections(fullText)

      // ── 3. Identifica elementos para reanálise ────────────────────────────────
      const existingSnap = await db
        .collection('analyses').doc(analysisId)
        .collection('elementResults')
        .get()

      const existingResults = existingSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const toReanalyze = existingResults.filter(el => {
        const hrStatus  = el.humanReview?.status
        const effStatus = el.effectiveStatus
        // Preserva apenas elementos que o analista confirmou explicitamente como adequados
        if (hrStatus === 'confirmed' && POSITIVE_STATUSES.has(effStatus)) return false
        return true
      })

      logger.info('Elementos para reanálise', { analysisId, count: toReanalyze.length })

      if (toReanalyze.length === 0) {
        await analysisRef.update({
          'reanalysis.status':          'complete',
          'reanalysis.ranAt':           Timestamp.now(),
          'reanalysis.reanalyzedCount': 0,
          updatedAt: Timestamp.now(),
        })
        return { success: true, reanalyzed: 0 }
      }

      // ── 4. Carrega checklist para os elementos alvo ───────────────────────────
      const checklistSnap = await db.collection('checklist_definitions')
        .where('active', '==', true)
        .get()
      const allChecklist  = checklistSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const reanalyzeIds  = new Set(toReanalyze.map(r => r.elementId))
      const elementsToAnalyze = allChecklist.filter(el =>
        reanalyzeIds.has(el.id) || reanalyzeIds.has(el.elementId)
      )

      // ── 5. Escola e overrides de modo ─────────────────────────────────────────
      const schoolSnap = await db.collection('schools').doc(analysis.schoolId).get()
      if (!schoolSnap.exists) throw new Error(`Escola ${analysis.schoolId} não encontrada`)
      const school        = { id: schoolSnap.id, ...schoolSnap.data() }
      const modeOverrides = await loadModeOverrides()

      // ── 6. Análise IA do subconjunto ──────────────────────────────────────────
      const { results } = await analyzeAllElements({
        elements:      elementsToAnalyze,
        sectionMap,
        fullText,
        school,
        analysisId,
        year:          analysis.year,
        modeOverrides,
      })

      // ── 7. Persiste: preserva aiResult anterior, reseta humanReview ───────────
      const elementResultsRef = db
        .collection('analyses').doc(analysisId)
        .collection('elementResults')

      const BATCH_SIZE = 500
      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = db.batch()
        results.slice(i, i + BATCH_SIZE).forEach(result => {
          const existing = toReanalyze.find(r => r.elementId === result.elementId)
          batch.update(elementResultsRef.doc(result.elementId), {
            previousAiResult:         existing?.aiResult ?? null,
            aiResult:                 result.aiResult,
            effectiveStatus:          result.aiResult.status,
            'humanReview.status':     'pending',
            'humanReview.decision':   null,
            'humanReview.comment':    null,
            'humanReview.reviewedAt': null,
            'humanReview.reviewedBy': null,
            reanalyzedAt: Timestamp.now(),
            updatedAt:    Timestamp.now(),
          })
        })
        await batch.commit()
      }

      // ── 8. Highlights para docx atualizado ───────────────────────────────────
      // Nota: extractText já salvou o HTML do docx atualizado em ppp_highlighted.html
      // (sobrescrevendo o original). injectHighlights adiciona os highlights do novo
      // resultado para que o viewer mostre o documento atualizado com marcações.
      if (fileType === 'docx' && htmlStoragePath) {
        try {
          await injectHighlights(analysisId, BUCKET, results)
        } catch (hlErr) {
          logger.warn('Falha ao injetar highlights na reanálise', { analysisId, error: hlErr.message })
        }
      }

      // ── 9. Auditoria ──────────────────────────────────────────────────────────
      await db.collection('audit_log').add({
        action:    'reanalysis_complete',
        analysisId,
        schoolId:  analysis.schoolId,
        userId,
        elementId: null,
        before:    null,
        after:     { reanalyzedCount: results.length, method, fileType },
        metadata:  { updatedFilePath },
        timestamp: Timestamp.now(),
      })

      await analysisRef.update({
        'reanalysis.status':          'complete',
        'reanalysis.ranAt':           Timestamp.now(),
        'reanalysis.reanalyzedCount': results.length,
        'reanalysis.method':          method,
        'reanalysis.pageCount':       pageCount,
        'reanalysis.fileType':        fileType,
        'reanalysis.updatedHtmlPath': htmlStoragePath ?? null,
        // Marca a análise como completa para fechar o DeepReviewBanner.
        // DeepReview (análise do documento original) deixa de ser relevante
        // após o upload de um documento atualizado.
        'aiAnalysis.status':          'complete',
        'aiAnalysis.deepReviewDone':  true,
        updatedAt: Timestamp.now(),
      })

      logger.info('Reanálise concluída', { analysisId, reanalyzed: results.length })
      return { success: true, reanalyzed: results.length }

    } catch (err) {
      logger.error('Erro na reanálise', { analysisId, error: err.message })
      await analysisRef.update({
        'reanalysis.status': 'error',
        'reanalysis.error':  err.message,
        updatedAt: Timestamp.now(),
      })
      throw err
    }
  }
)
