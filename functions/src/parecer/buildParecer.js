// functions/src/parecer/buildParecer.js

'use strict'

const { onCall, HttpsError }     = require('firebase-functions/v2/https')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')
const { getStorage }              = require('firebase-admin/storage')
const { logger }                  = require('firebase-functions')
const { generateAnchoredHtml, getAnchoredHtmlUrl } = require('./htmlAnchor')
const { buildObservations }       = require('./buildObservations')

const db         = getFirestore()
const BUCKET     = 'unieb-recanto.firebasestorage.app'

exports.buildParecer = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: 180, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.')

    const { analysisId, force = false } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    const analysisRef  = db.collection('analyses').doc(analysisId)
    const analysisSnap = await analysisRef.get()
    if (!analysisSnap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')

    const analysis = analysisSnap.data()
    const fileType = analysis.aiAnalysis?.fileType
    if (fileType !== 'docx') {
      throw new HttpsError('failed-precondition', 'Parecer ancorado disponível apenas para .docx.')
    }

    const bucket = getStorage().bucket(BUCKET)

    const names = ['ppp2026.docx', 'ppp2025.docx', 'ppp.docx']
    let docxBuffer = null
    for (const name of names) {
      const f = bucket.file(`analyses/${analysisId}/${name}`)
      const [exists] = await f.exists()
      if (exists) { const [buf] = await f.download(); docxBuffer = buf; break }
    }
    if (!docxBuffer) {
      const [files] = await bucket.getFiles({ prefix: `analyses/${analysisId}/` })
      const d = files.find(f => f.name.endsWith('.docx'))
      if (d) { const [buf] = await d.download(); docxBuffer = buf }
    }
    if (!docxBuffer) throw new HttpsError('not-found', 'Arquivo .docx original não encontrado.')

    const { paragraphs, storagePath } = await generateAnchoredHtml(docxBuffer, analysisId, BUCKET)

    const resultsSnap = await analysisRef.collection('elementResults').get()
    const elementResults = resultsSnap.docs.map(d => ({ elementId: d.id, ...d.data() }))

    const observations = buildObservations(elementResults, paragraphs)

    const obsColl = analysisRef.collection('observations')
    const existingSnap = await obsColl.get()

    if (existingSnap.size > 0 && !force) {
      const manualCount = existingSnap.docs.filter(d => d.data().status !== 'auto').length
      if (manualCount > 0) {
        throw new HttpsError(
          'failed-precondition',
          `Existem ${manualCount} observação(ões) editada(s). Use force=true para regenerar (perderá edições).`
        )
      }
    }

    const batchDelete = db.batch()
    existingSnap.docs.forEach(d => batchDelete.delete(d.ref))
    if (existingSnap.size > 0) await batchDelete.commit()

    const chunks = chunk(observations, 400)
    let total = 0
    for (const group of chunks) {
      const batch = db.batch()
      for (const obs of group) {
        const ref = obsColl.doc()
        batch.set(ref, {
          ...obs,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: uid,
        })
        total++
      }
      await batch.commit()
    }

    const htmlUrl = await getAnchoredHtmlUrl(analysisId, BUCKET)

    await analysisRef.update({
      'parecer.anchoredHtmlPath': storagePath,
      'parecer.anchoredHtmlUrl':  htmlUrl,
      'parecer.paragraphCount':   paragraphs.length,
      'parecer.observationCount': total,
      'parecer.generatedAt':      Timestamp.now(),
      'parecer.generatedBy':      uid,
      'parecer.status':           'draft',
      updatedAt: Timestamp.now(),
    })

    logger.info(`Parecer gerado`, { analysisId, observations: total, paragraphs: paragraphs.length })

    return {
      ok: true,
      observationCount: total,
      paragraphCount:   paragraphs.length,
      htmlUrl,
    }
  }
)

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
