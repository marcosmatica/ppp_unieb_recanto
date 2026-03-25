/**
 * functions/src/report/generateReport.js
 * Cloud Function (callable) — monta o parecer .docx e devolve URL de download.
 *
 * Chamada pelo front-end:
 *   const fn = httpsCallable(functions, 'generateReport')
 *   const { data } = await fn({ analysisId, notes, decision })
 *   // data.downloadUrl → link temporário do Storage (1 hora)
 */

'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getStorage }              = require('firebase-admin/storage')
const { logger }                  = require('firebase-functions')
const { buildParecer }            = require('./documentBuilder')

const db      = getFirestore()
const storage = getStorage()

exports.generateReport = onCall(
  { region: 'southamerica-east1', timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    // ── Autenticação ────────────────────────────────────────────────────────
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.')

    const { analysisId, notes, decision } = request.data

    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')
    if (!decision)   throw new HttpsError('invalid-argument', 'decision obrigatória.')

    // ── Busca dados ─────────────────────────────────────────────────────────
    const [analysisSnap, userSnap, elementsSnap] = await Promise.all([
      db.collection('analyses').doc(analysisId).get(),
      db.collection('users').doc(uid).get(),
      db.collection('analyses').doc(analysisId).collection('elementResults').get(),
    ])

    if (!analysisSnap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')

    const analysis     = { id: analysisSnap.id, ...analysisSnap.data() }
    const analystName  = userSnap.exists ? userSnap.data().name : null
    const elements     = elementsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) =>
        (a.blockCode || '').localeCompare(b.blockCode || '') ||
        (a.elementId || '').localeCompare(b.elementId || '')
      )

    logger.info('Gerando parecer', { analysisId, decision, elements: elements.length })

    // ── Gera o .docx ────────────────────────────────────────────────────────
    const buffer = await buildParecer({
      analysis,
      elements,
      analystNotes: notes || '',
      decision,
      analystName,
    })

    // ── Salva no Storage ────────────────────────────────────────────────────
    const fileName = `parecer_${analysis.schoolName.replace(/\s+/g, '_')}_${analysis.year}.docx`
    const storagePath = `reports/${analysisId}/${fileName}`
    const bucket    = storage.bucket()
    const fileRef   = bucket.file(storagePath)

    await fileRef.save(buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      metadata: {
        cacheControl: 'private, max-age=3600',
        metadata: { analysisId, generatedBy: uid, decision },
      },
    })

    // URL assinada válida por 1 hora
    const [downloadUrl] = await fileRef.getSignedUrl({
      action:  'read',
      expires: Date.now() + 60 * 60 * 1000,
    })

    // ── Atualiza o Firestore ─────────────────────────────────────────────────
    await db.collection('analyses').doc(analysisId).update({
      status: decision === 'rejected' ? 'rejected' : 'approved',
      'finalReport.generatedAt':  Timestamp.now(),
      'finalReport.storagePath':  storagePath,
      'finalReport.analystNotes': notes || '',
      'finalReport.decision':     decision,
      updatedAt: Timestamp.now(),
    })

    // Audit log
    await db.collection('audit_log').add({
      action:     'report_generated',
      analysisId,
      schoolId:   analysis.schoolId,
      userId:     uid,
      elementId:  null,
      before:     null,
      after:      { decision, storagePath },
      metadata:   { fileName },
      timestamp:  Timestamp.now(),
    })

    logger.info('Parecer gerado com sucesso', { analysisId, storagePath })

    return { downloadUrl, fileName, storagePath }
  }
)
