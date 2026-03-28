/**
 * report/getDocumentViewerUrl.js
 * Retorna URL de download do HTML highlighted e fileType.
 *
 * Usa token de download do Firebase Storage em vez de Signed URL,
 * evitando a necessidade de iam.serviceAccounts.signBlob.
 */

'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore }       = require('firebase-admin/firestore')
const { getStorage }         = require('firebase-admin/storage')
const { logger }             = require('firebase-functions')

const db = getFirestore()
const HIGHLIGHT_FILE = 'ppp_highlighted.html'

exports.getDocumentViewerUrl = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Não autenticado.')

    const { analysisId } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    const snap = await db.collection('analyses').doc(analysisId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')

    const analysis  = snap.data()
    const fileType  = analysis.aiAnalysis?.fileType || null
    const bucket    = process.env.FIREBASE_STORAGE_BUCKET || ''

    if (fileType !== 'docx') {
      return { htmlUrl: null, fileType }
    }

    // Verifica se o arquivo existe
    const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
    const file = getStorage().bucket(bucket).file(storagePath)
    const [exists] = await file.exists()

    if (!exists) {
      logger.info('HTML highlighted não encontrado', { analysisId, storagePath })
      return { htmlUrl: null, fileType }
    }

    // Obtém o download token do metadata do arquivo
    // (criado automaticamente pelo Firebase ao salvar via SDK Admin)
    try {
      const [metadata] = await file.getMetadata()
      const token = metadata?.metadata?.firebaseStorageDownloadTokens

      let htmlUrl
      if (token) {
        // URL pública de download do Firebase Storage (não requer signBlob)
        const encodedPath = encodeURIComponent(storagePath)
        htmlUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${token}`
      } else {
        // Fallback: gera URL assinada (requer signBlob — pode falhar)
        const [url] = await file.getSignedUrl({
          action:  'read',
          expires: Date.now() + 2 * 60 * 60 * 1000,
        })
        htmlUrl = url
      }

      logger.info('htmlUrl gerada', { analysisId, method: token ? 'token' : 'signedUrl' })
      return { htmlUrl, fileType }

    } catch (err) {
      logger.error('Erro ao gerar URL do HTML', { analysisId, error: err.message })
      return { htmlUrl: null, fileType }
    }
  }
)
