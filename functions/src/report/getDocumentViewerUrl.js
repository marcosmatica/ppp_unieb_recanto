/**
 * report/getDocumentViewerUrl.js
 * Cloud Function callable — retorna URL assinada do HTML highlighted e fileType.
 * Chamada pelo DocumentViewer.jsx ao montar.
 */

'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore }       = require('firebase-admin/firestore')
const { getHighlightedHtmlUrl } = require('../pipeline/docxHighlighter')

const db = getFirestore()

exports.getDocumentViewerUrl = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Não autenticado.')

    const { analysisId } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    const snap = await db.collection('analyses').doc(analysisId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')

    const analysis = snap.data()
    const fileType  = analysis.aiAnalysis?.fileType || null
    const bucket    = process.env.FIREBASE_STORAGE_BUCKET || ''

    // Para docx: gera URL assinada (válida por 2h)
    const htmlUrl = fileType === 'docx'
      ? await getHighlightedHtmlUrl(analysisId, bucket)
      : null

    return { htmlUrl, fileType }
  }
)
