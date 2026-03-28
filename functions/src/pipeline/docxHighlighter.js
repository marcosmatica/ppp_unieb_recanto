/**
 * pipeline/docxHighlighter.js
 * v3: adiciona firebaseStorageDownloadTokens ao salvar para evitar signBlob
 */

'use strict'

const mammoth        = require('mammoth')
const { getStorage } = require('firebase-admin/storage')
const { logger }     = require('firebase-functions')
const { v4: uuidv4 } = require('uuid')

const HIGHLIGHT_FILE = 'ppp_highlighted.html'

const STATUS_CLASS = {
  adequate:          'hl-adequate',
  adequate_implicit: 'hl-adequate-implicit',
  attention:         'hl-attention',
  critical:          'hl-critical',
  not_applicable:    'hl-na',
}

// ─── Passo 1: gera e salva o HTML do docx ────────────────────────────────────

async function generateDocxHtml(buffer, analysisId, bucketName) {
  const { value: rawHtml, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Título 1']  => h1:fresh",
        "p[style-name='Título 2']  => h2:fresh",
        "p[style-name='Título 3']  => h3:fresh",
      ],
    }
  )

  if (messages.length > 0) {
    logger.info(`mammoth warnings para ${analysisId}`, { count: messages.length })
  }

  const html        = wrapHtml(rawHtml, analysisId)
  const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
  const bucket      = getStorage().bucket(bucketName)
  const file        = bucket.file(storagePath)
  const token       = uuidv4()

  await file.save(Buffer.from(html, 'utf-8'), {
    contentType: 'text/html; charset=utf-8',
    metadata: {
      metadata: {
        analysisId,
        type: 'docx_html',
        firebaseStorageDownloadTokens: token,   // ← token de download
      },
    },
  })

  logger.info(`HTML do docx salvo`, { analysisId, storagePath })
  return storagePath
}

// ─── Passo 2: injeta highlights após análise ─────────────────────────────────

async function injectHighlights(analysisId, bucketName, elementResults) {
  const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
  const bucket      = getStorage().bucket(bucketName)
  const file        = bucket.file(storagePath)

  let html
  let existingToken
  try {
    const [buffer]   = await file.download()
    html             = buffer.toString('utf-8')
    // Preserva o token existente (se houver)
    const [meta]     = await file.getMetadata()
    existingToken    = meta?.metadata?.firebaseStorageDownloadTokens
  } catch (err) {
    logger.warn(`HTML não encontrado para highlights`, { analysisId })
    return null
  }

  const allExcerpts = []
  for (const result of elementResults) {
    const excerpts = result.aiResult?.excerpts || []
    for (const ex of excerpts) {
      if (ex.text && ex.text.length > 10) {
        allExcerpts.push({
          text:      ex.text,
          elementId: result.elementId,
          label:     result.label,
          status:    result.effectiveStatus || result.aiResult?.status || 'attention',
          section:   ex.section || '',
        })
      }
    }
  }

  if (allExcerpts.length === 0) {
    logger.info(`Nenhum excerpt para injetar`, { analysisId })
    return storagePath
  }

  allExcerpts.sort((a, b) => b.text.length - a.text.length)

  let injected = 0
  for (const ex of allExcerpts) {
    const result = injectMark(html, ex)
    if (result.found) { html = result.html; injected++ }
  }

  logger.info(`Highlights injetados`, { analysisId, total: allExcerpts.length, injected })

  // Mantém o token existente ou gera um novo
  const token = existingToken || uuidv4()

  await file.save(Buffer.from(html, 'utf-8'), {
    contentType: 'text/html; charset=utf-8',
    metadata: {
      metadata: {
        analysisId,
        type: 'docx_html_highlighted',
        injected,
        firebaseStorageDownloadTokens: token,   // ← token de download
      },
    },
  })

  return storagePath
}

// ─── Injeção de um único trecho ───────────────────────────────────────────────

function injectMark(html, { text, elementId, label, status, section }) {
  const cssClass  = STATUS_CLASS[status] || 'hl-attention'
  const dataAttrs = `data-element="${elementId}" data-status="${status}" data-label="${escapeAttr(label)}" data-section="${escapeAttr(section)}"`
  const markOpen  = `<mark class="${cssClass}" ${dataAttrs}>`
  const markClose = `</mark>`

  // 1. Match exato
  const exactIdx = html.indexOf(text)
  if (exactIdx !== -1) {
    html = html.slice(0, exactIdx) + markOpen + text + markClose + html.slice(exactIdx + text.length)
    return { html, found: true }
  }

  // 2. Match normalizado (espaços colapsados)
  const norm   = s => s.replace(/\s+/g, ' ').trim()
  const normT  = norm(text)
  const normH  = norm(html)
  const normIdx = normH.indexOf(normT)
  if (normIdx !== -1) {
    // Encontra a posição aproximada no HTML original
    let charCount = 0; let origIdx = 0
    while (origIdx < html.length && charCount < normIdx) {
      if (html[origIdx] !== ' ' || (origIdx > 0 && html[origIdx - 1] !== ' ')) charCount++
      origIdx++
    }
    const end = origIdx + text.length
    if (end <= html.length) {
      html = html.slice(0, origIdx) + markOpen + html.slice(origIdx, end) + markClose + html.slice(end)
      return { html, found: true }
    }
  }

  return { html, found: false }
}

// ─── URL de download via token ────────────────────────────────────────────────

async function getHighlightedHtmlUrl(analysisId, bucketName) {
  try {
    const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
    const bucket      = getStorage().bucket(bucketName)
    const file        = bucket.file(storagePath)

    const [exists] = await file.exists()
    if (!exists) return null

    const [metadata] = await file.getMetadata()
    const token      = metadata?.metadata?.firebaseStorageDownloadTokens

    if (token) {
      const encodedPath = encodeURIComponent(storagePath)
      return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`
    }

    // Fallback: re-salva com token e retorna URL
    logger.warn(`Token ausente — re-salvando com token`, { analysisId })
    const [buffer] = await file.download()
    const newToken = uuidv4()
    await file.save(buffer, {
      contentType: 'text/html; charset=utf-8',
      metadata: { metadata: { ...metadata.metadata, firebaseStorageDownloadTokens: newToken } },
    })
    const encodedPath = encodeURIComponent(storagePath)
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${newToken}`

  } catch (err) {
    logger.error(`Erro ao gerar URL`, { analysisId, error: err.message })
    return null
  }
}

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function wrapHtml(body, analysisId) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="analysisId" content="${analysisId}">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px; line-height: 1.7;
    color: #1a1a1a; background: #fff;
    padding: 32px 40px; max-width: 820px; margin: 0 auto;
  }
  h1 { font-size: 18px; font-weight: 700; margin: 24px 0 8px; }
  h2 { font-size: 15px; font-weight: 600; margin: 20px 0 6px; }
  h3 { font-size: 13px; font-weight: 600; margin: 16px 0 4px; }
  p  { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 8px 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; }

  mark { border-radius: 3px; padding: 1px 2px; cursor: pointer; transition: opacity 0.15s; }
  mark:hover { opacity: 0.75; }
  mark.hl-adequate          { background: #bbf7d0; color: #14532d; border-bottom: 2px solid #16a34a; }
  mark.hl-adequate-implicit { background: #ccfbf1; color: #134e4a; border-bottom: 2px solid #0d9488; }
  mark.hl-attention         { background: #fef08a; color: #713f12; border-bottom: 2px solid #ca8a04; }
  mark.hl-critical          { background: #fecaca; color: #7f1d1d; border-bottom: 2px solid #dc2626; }
  mark.hl-active            { outline: 2px solid #3b82f6; outline-offset: 2px; }
  body.has-active mark:not(.hl-active) { opacity: 0.25; }
</style>
</head>
<body>
${body}
<script>
  window.addEventListener('DOMContentLoaded', () => {
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*')
  })

  window.addEventListener('message', (e) => {
    const { type, elementId } = e.data || {}
    if (type !== 'HIGHLIGHT_ELEMENT') return
    document.querySelectorAll('mark.hl-active').forEach(m => m.classList.remove('hl-active'))
    document.body.classList.remove('has-active')
    if (!elementId) return
    const marks = document.querySelectorAll(\`mark[data-element="\${elementId}"]\`)
    if (!marks.length) return
    document.body.classList.add('has-active')
    marks.forEach(m => m.classList.add('hl-active'))
    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  })

  document.addEventListener('click', (e) => {
    const mark = e.target.closest('mark[data-element]')
    if (!mark) return
    document.querySelectorAll('mark.hl-active').forEach(m => m.classList.remove('hl-active'))
    document.body.classList.add('has-active')
    document.querySelectorAll(\`mark[data-element="\${mark.dataset.element}"]\`).forEach(m => m.classList.add('hl-active'))
    window.parent.postMessage({
      type: 'MARK_CLICKED', elementId: mark.dataset.element,
      label: mark.dataset.label || '', status: mark.dataset.status || '',
    }, '*')
  })
</script>
</body>
</html>`
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

module.exports = { generateDocxHtml, injectHighlights, getHighlightedHtmlUrl }
