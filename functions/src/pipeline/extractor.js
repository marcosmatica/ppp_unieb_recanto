/**
 * pipeline/extractor.js
 * Extração de texto de PDF e DOCX com fallback OCR para documentos escaneados.
 * v2: gera HTML highlighted para .docx via mammoth (docxHighlighter.js)
 */

const pdfParse  = require('pdf-parse')
const mammoth   = require('mammoth')
const { createWorker } = require('tesseract.js')
const { fromBuffer }   = require('pdf2pic')
const { generateDocxHtml } = require('./docxHighlighter')

const MIN_CHARS_PER_PAGE = 40

/**
 * Extrai texto limpo de um buffer PDF ou DOCX.
 * @returns {{ text, pageCount, method, fileType, htmlStoragePath }}
 *   htmlStoragePath — preenchido apenas para .docx (null para PDF)
 */
async function extractText(buffer, contentType, fileName, analysisId, bucketName) {
  const isPdf = contentType === 'application/pdf' || (fileName || '').endsWith('.pdf')
  const isDocx = contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || (fileName || '').endsWith('.docx')

  if (isPdf)  return extractPDF(buffer)
  if (isDocx) return extractDOCX(buffer, analysisId, bucketName)

  throw new Error(`Tipo de arquivo não suportado: ${contentType}`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function extractPDF(buffer) {
  const data      = await pdfParse(buffer)
  const pageCount = data.numpages || 1
  const text      = cleanText(data.text || '')

  const charsPerPage = text.length / Math.max(pageCount, 1)
  if (charsPerPage < MIN_CHARS_PER_PAGE) {
    return extractPDFOCR(buffer, pageCount)
  }

  return { text, pageCount, method: 'pdf-native', fileType: 'pdf', htmlStoragePath: null }
}

async function extractPDFOCR(buffer, pageCount) {
  const convert = fromBuffer(buffer, { density: 200, format: 'png', width: 2000, height: 2830 })
  const worker  = await createWorker('por')
  const pages   = []

  for (let i = 1; i <= pageCount; i++) {
    const { base64 } = await convert(i, { responseType: 'base64' })
    const { data: { text } } = await worker.recognize(Buffer.from(base64, 'base64'))
    pages.push(text)
  }

  await worker.terminate()
  return {
    text: cleanText(pages.join('\n\n')),
    pageCount,
    method: 'ocr',
    fileType: 'pdf',
    htmlStoragePath: null,
  }
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

async function extractDOCX(buffer, analysisId, bucketName) {
  const result = await mammoth.extractRawText({ buffer })

  // Gera e salva o HTML com formatação preservada (para highlights posteriores)
  let htmlStoragePath = null
  if (analysisId && bucketName) {
    try {
      htmlStoragePath = await generateDocxHtml(buffer, analysisId, bucketName)
    } catch (err) {
      // Não bloqueia o pipeline se o HTML falhar
      const { logger } = require('firebase-functions')
      logger.warn(`Falha ao gerar HTML do docx`, { analysisId, error: err.message })
    }
  }

  return {
    text: cleanText(result.value || ''),
    pageCount: null,
    method: 'docx',
    fileType: 'docx',
    htmlStoragePath,
  }
}

// ─── Limpeza ──────────────────────────────────────────────────────────────────

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/[^\x20-\x7E\x80-\xFF\n]/g, ' ')
    .trim()
}

module.exports = { extractText }
