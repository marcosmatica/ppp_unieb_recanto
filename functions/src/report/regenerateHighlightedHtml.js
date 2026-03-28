/**
 * functions/src/report/regenerateHighlightedHtml.js
 *
 * Cloud Function callable — regenera o ppp_highlighted.html para uma análise
 * já existente sem precisar re-fazer o upload do documento.
 *
 * Fluxo:
 *   1. Lê o doc da análise no Firestore
 *   2. Baixa o .docx original do Storage
 *   3. Chama generateDocxHtml (converte docx → HTML limpo)
 *   4. Lê todos os elementResults do Firestore
 *   5. Chama injectHighlights (injeta <mark> tags)
 *   6. Retorna { ok: true, injected: N }
 *
 * Uso no frontend (botão "Reprocessar visualizador"):
 *   const regen = httpsCallable(functions, 'regenerateHighlightedHtml')
 *   await regen({ analysisId })
 *   // depois recarrega a URL assinada no DocumentViewer
 */

'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore }       = require('firebase-admin/firestore')
const { getStorage }         = require('firebase-admin/storage')
const { logger }             = require('firebase-functions')
const { generateDocxHtml, injectHighlights } = require('../pipeline/docxHighlighter')

const db = getFirestore()

exports.regenerateHighlightedHtml = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Não autenticado.')

    const { analysisId } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    // 1. Lê a análise
    const analysisSnap = await db.collection('analyses').doc(analysisId).get()
    if (!analysisSnap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')
    const analysis = analysisSnap.data()

    const fileType = analysis.aiAnalysis?.fileType
    if (fileType !== 'docx') {
      throw new HttpsError('failed-precondition', 'Esta análise foi enviada como PDF — visualizador com highlights não disponível.')
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || ''
    const bucket     = getStorage().bucket(bucketName)

    // 2. Localiza o .docx original no Storage
    //    Tenta os dois nomes possíveis de arquivo
    const possibleNames = ['ppp2026.docx', 'ppp2025.docx', 'ppp.docx']
    let docxBuffer = null
    let foundName  = null

    for (const name of possibleNames) {
      const filePath = `analyses/${analysisId}/${name}`
      const file     = bucket.file(filePath)
      const [exists] = await file.exists()
      if (exists) {
        const [buf] = await file.download()
        docxBuffer  = buf
        foundName   = name
        break
      }
    }

    if (!docxBuffer) {
      // Último recurso: lista todos os arquivos da pasta e pega o primeiro .docx
      const [files] = await bucket.getFiles({ prefix: `analyses/${analysisId}/` })
      const docxFile = files.find(f => f.name.endsWith('.docx'))
      if (docxFile) {
        const [buf] = await docxFile.download()
        docxBuffer  = buf
        foundName   = docxFile.name
      }
    }

    if (!docxBuffer) {
      throw new HttpsError('not-found', 'Arquivo .docx original não encontrado no Storage.')
    }

    logger.info(`Regenerando HTML para ${analysisId}`, { foundName })

    // 3. Gera HTML limpo do docx
    await generateDocxHtml(docxBuffer, analysisId, bucketName)

    // 4. Lê todos os elementResults
    const resultsSnap = await db
      .collection('analyses').doc(analysisId)
      .collection('elementResults')
      .get()

    const elementResults = resultsSnap.docs.map(d => ({ elementId: d.id, ...d.data() }))

    // 5. Injeta highlights
    await injectHighlights(analysisId, bucketName, elementResults)

    logger.info(`HTML regenerado com sucesso`, { analysisId, elements: elementResults.length })

    return { ok: true, elementCount: elementResults.length }
  }
)
