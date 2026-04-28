// functions/src/parecer/exportParecerPdf.js

'use strict'

const { onCall, HttpsError }      = require('firebase-functions/v2/https')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getStorage }              = require('firebase-admin/storage')
const { logger }                  = require('firebase-functions')
const { v4: uuidv4 }              = require('uuid')
const chromium                    = require('@sparticuz/chromium')
const puppeteer                   = require('puppeteer-core')
const { renderParecerHtml }       = require('./parecerTemplate')

const db     = getFirestore()
const BUCKET = 'unieb-recanto.firebasestorage.app'

exports.exportParecerPdf = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    timeoutSeconds: 300,
    memory: '2GiB',
    cpu: 2,
  },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.')

    const { analysisId } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    const analysisRef  = db.collection('analyses').doc(analysisId)
    const analysisSnap = await analysisRef.get()
    if (!analysisSnap.exists) throw new HttpsError('not-found', 'Análise não encontrada.')

    const analysis      = analysisSnap.data()
    const anchoredPath  = analysis?.parecer?.anchoredHtmlPath
    if (!anchoredPath) {
      throw new HttpsError('failed-precondition', 'Gere o parecer primeiro.')
    }

    const bucket = getStorage().bucket(BUCKET)
    const [anchoredBuf] = await bucket.file(anchoredPath).download()
    const { body, paragraphs } = extractBodyAndParagraphs(anchoredBuf.toString('utf-8'))

    const obsSnap = await analysisRef.collection('observations').orderBy('createdAt', 'asc').get()
    const observations = obsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const html = renderParecerHtml({
      analysis: { id: analysisId, ...analysis },
      observations,
      anchoredBodyHtml: body,
      paragraphs,
    })

    logger.info('Iniciando Puppeteer', { analysisId, observations: observations.length })

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    let pdfBuffer
    try {
      const page = await browser.newPage()
      await page.emulateMediaType('print')
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })

      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      })
    } finally {
      await browser.close()
    }

    const storagePath = `analyses/${analysisId}/parecer.pdf`
    const file        = bucket.file(storagePath)
    const token       = uuidv4()

    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        metadata: {
          analysisId,
          type: 'parecer_pdf',
          observationCount: String(observations.length),
          firebaseStorageDownloadTokens: token,
          generatedAt: new Date().toISOString(),
        },
      },
    })

    const enc         = encodeURIComponent(storagePath)
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${enc}?alt=media&token=${token}`

    await analysisRef.update({
      'parecer.pdfPath':        storagePath,
      'parecer.pdfUrl':         downloadUrl,
      'parecer.pdfGeneratedAt': Timestamp.now(),
      'parecer.pdfGeneratedBy': uid,
      'parecer.pdfSizeBytes':   pdfBuffer.length,
      updatedAt: Timestamp.now(),
    })

    logger.info('PDF gerado', { analysisId, sizeKB: Math.round(pdfBuffer.length / 1024) })

    return {
      ok: true,
      downloadUrl,
      fileName: `parecer_${slugify(analysis.schoolName)}_${analysis.year}.pdf`,
      sizeBytes: pdfBuffer.length,
    }
  }
)

function extractBodyAndParagraphs(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const rawBody   = bodyMatch ? bodyMatch[1] : html
  const body      = rawBody
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<div id="selecting-banner"[\s\S]*?<\/div>/gi, '')

  const paragraphs = []
  const re = /data-anchor="(anc-\d+)"/gi
  let m
  while ((m = re.exec(body)) !== null) {
    paragraphs.push({ id: m[1] })
  }
  return { body, paragraphs }
}

function slugify(str) {
  return (str || 'parecer')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 50)
}
