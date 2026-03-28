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

// Substitua a função wrapHtml() em functions/src/pipeline/docxHighlighter.js

function wrapHtml(body, analysisId) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="analysisId" content="${analysisId}">
<style>
  /* ── Reset & base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    background: #e8e8e8;
    min-height: 100%;
  }

  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #1a1a1a;
    background: #e8e8e8;
    padding: 24px 16px 48px;
  }

  /* ── Simulação de folha A4 ── */
  .page-wrapper {
    max-width: 820px;
    margin: 0 auto;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06);
    border-radius: 2px;
    padding: 72px 90px 80px;   /* margens A4: ~2.5cm laterais */
  }

  /* ── Tipografia ── */
  h1 {
    font-size: 16pt;
    font-weight: 700;
    color: #1a1a2e;
    margin: 28px 0 10px;
    line-height: 1.3;
    page-break-after: avoid;
  }
  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #1a1a2e;
    margin: 22px 0 8px;
    line-height: 1.35;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #2c2c3e;
    margin: 18px 0 6px;
    line-height: 1.4;
  }
  h4, h5, h6 {
    font-size: 12pt;
    font-weight: 600;
    margin: 14px 0 4px;
  }

  p {
    margin: 0 0 10px;
    text-align: justify;
    hyphens: auto;
  }
  p:last-child { margin-bottom: 0; }

  /* ── Listas ── */
  ul, ol {
    margin: 6px 0 10px 24px;
    padding: 0;
  }
  li { margin-bottom: 4px; }

  /* ── Tabelas ── */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 11pt;
  }
  td, th {
    border: 1px solid #c8c8c8;
    padding: 6px 10px;
    vertical-align: top;
  }
  th {
    background: #f0f0f0;
    font-weight: 600;
    text-align: left;
  }
  tr:nth-child(even) td { background: #fafafa; }

  /* ── Imagens ── */
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12px auto;
  }

  /* ── Links ── */
  a { color: #1155cc; text-decoration: underline; }

  /* ── Separadores ── */
  hr {
    border: none;
    border-top: 1px solid #d0d0d0;
    margin: 20px 0;
  }

  /* ── Highlights por status ── */
  mark {
    border-radius: 2px;
    padding: 1px 3px;
    cursor: pointer;
    transition: opacity 0.15s, box-shadow 0.15s;
    text-decoration: none;
  }
  mark:hover {
    box-shadow: 0 0 0 2px rgba(0,0,0,.15);
  }
  mark.hl-adequate {
    background: #bbf7d0;
    color: #14532d;
    border-bottom: 2px solid #16a34a;
  }
  mark.hl-adequate-implicit {
    background: #ccfbf1;
    color: #134e4a;
    border-bottom: 2px solid #0d9488;
  }
  mark.hl-attention {
    background: #fef08a;
    color: #713f12;
    border-bottom: 2px solid #ca8a04;
  }
  mark.hl-critical {
    background: #fecaca;
    color: #7f1d1d;
    border-bottom: 2px solid #dc2626;
  }

  /* ── Mark ativo (selecionado no checklist) ── */
  mark.hl-active {
    outline: 2.5px solid #3b82f6;
    outline-offset: 1px;
    box-shadow: 0 0 0 4px rgba(59,130,246,.15);
  }

  /* ── Fade dos marks não ativos ── */
  body.has-active mark:not(.hl-active) {
    opacity: 0.2;
    transition: opacity 0.2s;
  }

  /* ── Legenda de highlights (rodapé fixo) ── */
  .hl-legend {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 20px;
    background: rgba(255,255,255,.95);
    border-top: 1px solid #e0e0e0;
    font-size: 10pt;
    color: #555;
    backdrop-filter: blur(4px);
    z-index: 100;
  }
  .hl-legend span {
    display: flex; align-items: center; gap: 5px;
  }
  .hl-dot {
    width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0;
  }
  .hl-dot.adequate          { background: #16a34a; }
  .hl-dot.adequate-implicit { background: #0d9488; }
  .hl-dot.attention         { background: #ca8a04; }
  .hl-dot.critical          { background: #dc2626; }
</style>
</head>
<body>
<div class="page-wrapper">
${body}
</div>

<!-- Legenda de highlights -->
<div class="hl-legend">
  <strong>Trechos analisados:</strong>
  <span><div class="hl-dot adequate"></div> Adequado</span>
  <span><div class="hl-dot adequate-implicit"></div> Implícito</span>
  <span><div class="hl-dot attention"></div> Atenção</span>
  <span><div class="hl-dot critical"></div> Crítico</span>
</div>

<script>
  // Sinaliza prontidão ao pai
  window.addEventListener('DOMContentLoaded', () => {
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*')
  })

  // Recebe HIGHLIGHT_ELEMENT do pai
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

  // Clique num mark → notifica o pai
  document.addEventListener('click', (e) => {
    const mark = e.target.closest('mark[data-element]')
    if (!mark) return

    document.querySelectorAll('mark.hl-active').forEach(m => m.classList.remove('hl-active'))
    document.body.classList.add('has-active')
    document.querySelectorAll(\`mark[data-element="\${mark.dataset.element}"]\`)
      .forEach(m => m.classList.add('hl-active'))

    window.parent.postMessage({
      type:      'MARK_CLICKED',
      elementId: mark.dataset.element,
      label:     mark.dataset.label  || '',
      status:    mark.dataset.status || '',
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
