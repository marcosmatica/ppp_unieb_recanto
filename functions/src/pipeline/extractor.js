/**
 * pipeline/extractor.js
 * Extração de texto de PDF e DOCX com fallback OCR para documentos escaneados.
 *
 * Dependências (package.json das functions):
 *   pdf-parse, mammoth, tesseract.js, pdf2pic
 */

const pdfParse = require('pdf-parse')
const mammoth  = require('mammoth')
const { createWorker } = require('tesseract.js')
const { fromBuffer } = require('pdf2pic')

const MIN_CHARS_PER_PAGE = 80  // abaixo disso → provável scan

/**
 * Extrai texto limpo de um buffer PDF ou DOCX.
 * Retorna { text, pageCount, method }
 * method: 'pdf-native' | 'docx' | 'ocr'
 */
async function extractText(buffer, contentType, fileName) {
  if (contentType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractPDF(buffer)
  }
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    return extractDOCX(buffer)
  }
  throw new Error(`Tipo de arquivo não suportado: ${contentType}`)
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

async function extractPDF(buffer) {
  const data = await pdfParse(buffer)
  const pageCount = data.numpages
  const text = cleanText(data.text)

  // Heurística: se o texto é escasso → provavelmente escaneado
  const charsPerPage = text.length / Math.max(pageCount, 1)
  if (charsPerPage < MIN_CHARS_PER_PAGE) {
    return extractPDFOCR(buffer, pageCount)
  }

  return { text, pageCount, method: 'pdf-native' }
}

async function extractPDFOCR(buffer, pageCount) {
  // Rasteriza cada página e aplica OCR
  const convert = fromBuffer(buffer, {
    density: 200,
    format: 'png',
    width: 2000,
    height: 2830,
  })

  const worker = await createWorker('por')  // português
  const pages  = []

  for (let i = 1; i <= pageCount; i++) {
    const { base64 } = await convert(i, { responseType: 'base64' })
    const { data: { text } } = await worker.recognize(
      Buffer.from(base64, 'base64')
    )
    pages.push(text)
  }

  await worker.terminate()

  return {
    text: cleanText(pages.join('\n\n')),
    pageCount,
    method: 'ocr',
  }
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: cleanText(result.value),
    pageCount: null,    // DOCX não tem contagem de páginas nativa
    method: 'docx',
  }
}

// ─── Limpeza de texto ────────────────────────────────────────────────────────

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, '\n')              // normaliza quebras de linha
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')        // colapsa espaços em branco excessivos
    .replace(/[ \t]{3,}/g, '  ')         // remove espaços múltiplos
    .replace(/[^\x20-\x7E\x80-\xFF\n]/g, ' ')  // remove chars de controle
    .trim()
}

module.exports = { extractText }
