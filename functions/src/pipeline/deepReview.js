/**
 * pipeline/deepReview.js
 * Cloud Function callable — executa a re-análise Sonnet após confirmação do usuário.
 *
 * Chamada pelo frontend quando o usuário clica em "Confirmar análise aprofundada".
 * Lê os deepCandidates do Firestore, reconstrói o contexto e roda o Sonnet
 * apenas nesses elementos, atualizando os elementResults existentes.
 */

'use strict'

const { defineSecret } = require('firebase-functions/params')
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { extractText } = require('./extractor')
const { detectSections } = require('./sectionDetector')
const { runDeepReview } = require('./elementAnalyzer')
const { logger } = require('firebase-functions')

const db = getFirestore()

exports.triggerDeepReview = onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    // ── Auth ────────────────────────────────────────────────────────────────────
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.')

    const { analysisId } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    const analysisRef = db.collection('analyses').doc(analysisId)

    // ── Valida estado da análise ────────────────────────────────────────────────
    const analysisSnap = await analysisRef.get()
    if (!analysisSnap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')

    const analysis = analysisSnap.data()

    if (analysis.aiAnalysis?.status !== 'haiku_complete') {
      throw new HttpsError('failed-precondition', 'A análise inicial ainda não foi concluída ou a re-análise já foi executada.')
    }

    if (analysis.aiAnalysis?.deepReviewDone === true) {
      throw new HttpsError('already-exists', 'A análise aprofundada já foi executada para este PPP.')
    }

    const deepCandidates = analysis.aiAnalysis?.deepCandidates || []
    if (deepCandidates.length === 0) {
      // Nada a fazer — marca como concluído e retorna
      await analysisRef.update({
        'aiAnalysis.status':         'complete',
        'aiAnalysis.deepReviewDone': true,
        updatedAt: Timestamp.now(),
      })
      return { deepReviewed: 0, message: 'Nenhum candidato para re-análise.' }
    }

    await analysisRef.update({ 'aiAnalysis.status': 'deep_reviewing', updatedAt: Timestamp.now() })

    try {
      // ── Carrega escola ────────────────────────────────────────────────────────
      const schoolSnap = await db.collection('schools').doc(analysis.schoolId).get()
      if (!schoolSnap.exists) throw new HttpsError('not-found', 'Escola não encontrada.')
      const school = { id: schoolSnap.id, ...schoolSnap.data() }

      // ── Reconstrói fullText a partir do arquivo no Storage ────────────────────
      const pppYear    = analysis.year || 2026
      const fileName   = `ppp${pppYear}.pdf`   // convenção — ajuste se necessário
      const filePath   = `analyses/${analysisId}/${fileName}`
      const bucket     = getStorage().bucket()

      let fullText, sectionMap
      try {
        const file = bucket.file(filePath)
        const [buffer] = await file.download()
        const extracted = await extractText(buffer, 'application/pdf')
        fullText    = extracted.text
        sectionMap  = detectSections(fullText)
      } catch (storageErr) {
        // Tenta .docx como fallback
        const docxPath = `analyses/${analysisId}/ppp${pppYear}.docx`
        const file = bucket.file(docxPath)
        const [buffer] = await file.download()
        const extracted = await extractText(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        fullText   = extracted.text
        sectionMap = detectSections(fullText)
      }

      // ── Carrega definições dos elementos candidatos ───────────────────────────
      const checklistSnap = await db.collection('checklist_definitions')
        .where('active', '==', true)
        .get()
      const allDefinitions = checklistSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const candidateElements = allDefinitions.filter(el => deepCandidates.includes(el.elementId))

      if (candidateElements.length === 0) {
        throw new Error('Nenhuma definição encontrada para os candidatos: ' + deepCandidates.join(', '))
      }

      // ── Executa re-análise Sonnet ─────────────────────────────────────────────
      const deepResults = await runDeepReview({
        elements:   candidateElements,
        sectionMap,
        fullText,
        school,
        year:       pppYear,
        analysisId,
      })

      // ── Atualiza elementResults no Firestore ──────────────────────────────────
      const resultsRef = analysisRef.collection('elementResults')
      const batch = db.batch()

      deepResults.forEach(result => {
        // Remove campo interno _el se presente
        const { _el, ...clean } = result
        batch.set(resultsRef.doc(clean.elementId), {
          ...clean,
          updatedAt: Timestamp.now(),
        }, { merge: true })
      })

      await batch.commit()

      // ── Recalcula stats globais ───────────────────────────────────────────────
      const allResultsSnap = await resultsRef.get()
      const allResults = allResultsSnap.docs.map(d => d.data())
      const stats = computeStats(allResults)

      // ── Atualiza status da análise para 'complete' ────────────────────────────
      await analysisRef.update({
        'aiAnalysis.status':         'complete',
        'aiAnalysis.deepReviewDone': true,
        'aiAnalysis.deepReviewAt':   Timestamp.now(),
        'aiAnalysis.deepReviewBy':   uid,
        stats,
        updatedAt: Timestamp.now(),
      })

      // ── Log de auditoria ──────────────────────────────────────────────────────
      await db.collection('audit_log').add({
        action:     'deep_review_complete',
        analysisId,
        schoolId:   analysis.schoolId,
        userId:     uid,
        elementId:  null,
        before:     null,
        after:      { deepReviewed: deepResults.length, status: 'complete' },
        metadata:   { candidates: deepCandidates },
        timestamp:  Timestamp.now(),
      })

      logger.info(`Deep review concluído`, { analysisId, deepReviewed: deepResults.length })

      return {
        deepReviewed: deepResults.length,
        message: `Re-análise aprofundada concluída para ${deepResults.length} elemento(s).`,
      }

    } catch (err) {
      logger.error(`Erro no deep review`, { analysisId, error: err.message })
      await analysisRef.update({
        'aiAnalysis.status':      'haiku_complete',  // volta ao estado anterior para permitir nova tentativa
        'aiAnalysis.deepError':   err.message,
        updatedAt: Timestamp.now(),
      })
      throw new HttpsError('internal', `Erro na análise aprofundada: ${err.message}`)
    }
  }
)

// ─── Helper ───────────────────────────────────────────────────────────────────

function computeStats(results) {
  const counts = { adequate: 0, adequate_implicit: 0, attention: 0, critical: 0, not_applicable: 0 }
  results.forEach(r => {
    const s = r.effectiveStatus || r.aiResult?.status || 'critical'
    counts[s] = (counts[s] || 0) + 1
  })
  const total    = results.length
  const approved = counts.adequate + counts.adequate_implicit
  return { ...counts, total, score: total > 0 ? Math.round((approved / total) * 100) : 0 }
}
