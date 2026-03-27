/**
 * pipeline/docxHighlighter.js
 *
 * Dois passos:
 *   1. generateDocxHtml   — converte .docx → HTML via mammoth e salva no Storage
 *                           (chamado em extractor.js após extractDOCX)
 *   2. injectHighlights   — após análise, lê todos os elementResults e injeta
 *                           <mark> tags no HTML salvo (chamado em pipeline/index.js)
 *
 * O HTML resultante fica em:
 *   analyses/{analysisId}/ppp_highlighted.html
 *
 * Estratégia de matching:
 *   - Tenta match exato primeiro
 *   - Fallback: fuzzy (normaliza espaços/pontuação, aceita até 15% de diferença)
 *   - Injeta data-element, data-status e class para o frontend estilizar
 */

'use strict'

const mammoth   = require('mammoth')
const { getStorage } = require('firebase-admin/storage')
const { logger } = require('firebase-functions')

const HIGHLIGHT_FILE = 'ppp_highlighted.html'

// ─── Cores por status (classes CSS injetadas no <mark>) ───────────────────────
const STATUS_CLASS = {
  adequate:          'hl-adequate',
  adequate_implicit: 'hl-adequate-implicit',
  attention:         'hl-attention',
  critical:          'hl-critical',
  not_applicable:    'hl-na',
}

// ─── Passo 1: gera e salva o HTML do docx ────────────────────────────────────

/**
 * Converte buffer .docx para HTML e salva no Storage.
 * Retorna a URL de Storage do HTML gerado.
 *
 * @param {Buffer} buffer
 * @param {string} analysisId
 * @param {string} bucketName
 * @returns {Promise<string>} storagePath
 */
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

  // Envolve em documento HTML completo com estilos básicos
  const html = wrapHtml(rawHtml, analysisId)

  const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
  const bucket = getStorage().bucket(bucketName)
  const file   = bucket.file(storagePath)

  await file.save(Buffer.from(html, 'utf-8'), {
    contentType: 'text/html; charset=utf-8',
    metadata: { metadata: { analysisId, type: 'docx_html' } },
  })

  logger.info(`HTML do docx salvo`, { analysisId, storagePath })
  return storagePath
}

// ─── Passo 2: injeta highlights após análise ─────────────────────────────────

/**
 * Lê o HTML do Storage, injeta <mark> nos trechos de cada elementResult,
 * e re-salva o arquivo.
 *
 * @param {string} analysisId
 * @param {string} bucketName
 * @param {Array}  elementResults — array de elementResult docs do Firestore
 */
async function injectHighlights(analysisId, bucketName, elementResults) {
  const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
  const bucket = getStorage().bucket(bucketName)
  const file   = bucket.file(storagePath)

  let html
  try {
    const [buffer] = await file.download()
    html = buffer.toString('utf-8')
  } catch (err) {
    logger.warn(`HTML não encontrado para highlights — arquivo pode ser PDF`, { analysisId })
    return null
  }

  // Coleta todos os excerpts com metadados
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

  // Injeta em ordem decrescente de tamanho do trecho
  // (trechos mais longos primeiro evita que marks internas quebrem matches externos)
  allExcerpts.sort((a, b) => b.text.length - a.text.length)

  let injected = 0
  for (const ex of allExcerpts) {
    const result = injectMark(html, ex)
    if (result.found) {
      html = result.html
      injected++
    }
  }

  logger.info(`Highlights injetados`, { analysisId, total: allExcerpts.length, injected })

  await file.save(Buffer.from(html, 'utf-8'), {
    contentType: 'text/html; charset=utf-8',
    metadata: { metadata: { analysisId, type: 'docx_html_highlighted', injected } },
  })

  return storagePath
}

// ─── Injeção de um único trecho ───────────────────────────────────────────────

function injectMark(html, { text, elementId, label, status, section }) {
  const cssClass  = STATUS_CLASS[status] || 'hl-attention'
  const dataAttrs = `data-element="${elementId}" data-status="${status}" data-label="${escapeAttr(label)}" data-section="${escapeAttr(section)}"`
  const markOpen  = `<mark class="${cssClass}" ${dataAttrs}>`
  const markClose = `</mark>`

  // 1. Tenta match exato (mais rápido)
  const exactIdx = html.indexOf(text)
  if (exactIdx !== -1) {
    html = html.slice(0, exactIdx) + markOpen + text + markClose + html.slice(exactIdx + text.length)
    return { html, found: true }
  }

  // 2. Tenta match normalizado (ignora espaços extras, pontuação ligeiramente diferente)
  const normalizedTarget = normalizeForMatch(text)
  const normalizedHtml   = normalizeForMatch(html)
  const normIdx          = normalizedHtml.indexOf(normalizedTarget)

  if (normIdx !== -1) {
    // Encontra a posição aproximada no HTML original
    // Usa a proporção de caracteres como heurística
    const ratio    = normIdx / normalizedHtml.length
    const approxPos = Math.floor(ratio * html.length)

    // Busca o texto original num janela ao redor da posição aproximada
    const window   = Math.max(300, text.length * 2)
    const start    = Math.max(0, approxPos - window)
    const end      = Math.min(html.length, approxPos + window + text.length)
    const slice    = html.slice(start, end)

    // Tenta encontrar a melhor substring no slice
    const best = findBestMatch(slice, text)
    if (best !== -1) {
      const absPos = start + best
      html = html.slice(0, absPos) + markOpen + html.slice(absPos, absPos + text.length) + markClose + html.slice(absPos + text.length)
      return { html, found: true }
    }
  }

  // 3. Tenta match por palavras iniciais (primeiros 60 chars do trecho)
  const shortKey = text.slice(0, 60).trim()
  if (shortKey.length > 20) {
    const shortIdx = html.indexOf(shortKey)
    if (shortIdx !== -1) {
      // Injeta mark apenas no trecho curto encontrado
      html = html.slice(0, shortIdx) + markOpen + shortKey + markClose + html.slice(shortIdx + shortKey.length)
      return { html, found: true }
    }
  }

  return { html, found: false }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeForMatch(str) {
  return str
    .replace(/\s+/g, ' ')
    .replace(/[""''«»]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .trim()
}

function findBestMatch(slice, target) {
  // Busca a posição em slice onde a distância ao target é mínima
  // Estratégia: sliding window com tolerância de 15%
  const maxDist = Math.floor(target.length * 0.15)
  const tLen    = target.length

  for (let i = 0; i <= slice.length - tLen; i++) {
    const candidate = slice.slice(i, i + tLen)
    if (levenshteinLte(candidate, target, maxDist)) return i
  }
  return -1
}

// Levenshtein com early-exit quando ultrapassa maxDist
function levenshteinLte(a, b, maxDist) {
  if (Math.abs(a.length - b.length) > maxDist) return false
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    let minInRow = prev
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1]
        ? row[j - 1]
        : 1 + Math.min(row[j - 1], row[j], prev)
      row[j - 1] = prev
      prev = val
      minInRow = Math.min(minInRow, val)
    }
    row[b.length] = prev
    if (minInRow > maxDist) return false
  }
  return row[b.length] <= maxDist
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// ─── Wrapper HTML ─────────────────────────────────────────────────────────────

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
    font-size: 13px;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
    padding: 32px 40px;
    max-width: 820px;
    margin: 0 auto;
  }
  h1 { font-size: 18px; font-weight: 700; margin: 24px 0 8px; }
  h2 { font-size: 15px; font-weight: 600; margin: 20px 0 6px; }
  h3 { font-size: 13px; font-weight: 600; margin: 16px 0 4px; }
  p  { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 8px 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; }

  /* ── Highlights por status ── */
  mark {
    border-radius: 3px;
    padding: 1px 2px;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  mark:hover { opacity: 0.75; }

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

  /* ── Estado: elemento ativo (selecionado no checklist) ── */
  mark.hl-active {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  /* ── Estado: elementos não ativos ficam mais discretos ── */
  body.has-active mark:not(.hl-active) {
    opacity: 0.25;
  }
</style>
</head>
<body>
${body}
<script>
  // Escuta mensagens do pai (postMessage da página de análise)
  window.addEventListener('message', (e) => {
    const { type, elementId } = e.data || {}
    if (type !== 'HIGHLIGHT_ELEMENT') return

    // Remove estado ativo anterior
    document.querySelectorAll('mark.hl-active').forEach(m => m.classList.remove('hl-active'))
    document.body.classList.remove('has-active')

    if (!elementId) return

    // Ativa os marks do elemento selecionado
    const marks = document.querySelectorAll(\`mark[data-element="\${elementId}"]\`)
    if (marks.length === 0) return

    document.body.classList.add('has-active')
    marks.forEach(m => m.classList.add('hl-active'))

    // Scroll para o primeiro mark visível
    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  })

  // Ao clicar num mark, notifica o pai qual elemento foi clicado
  document.addEventListener('click', (e) => {
    const mark = e.target.closest('mark[data-element]')
    if (!mark) return
    window.parent.postMessage({
      type:      'MARK_CLICKED',
      elementId: mark.dataset.element,
      label:     mark.dataset.label,
      status:    mark.dataset.status,
    }, '*')
  })
</script>
</body>
</html>`
}

// ─── Gera URL assinada para o frontend ───────────────────────────────────────

/**
 * Retorna URL assinada do HTML highlighted (válida por 2h).
 * Retorna null se o arquivo não existir (ex: upload foi PDF).
 */
async function getHighlightedHtmlUrl(analysisId, bucketName) {
  try {
    const storagePath = `analyses/${analysisId}/${HIGHLIGHT_FILE}`
    const bucket = getStorage().bucket(bucketName)
    const file   = bucket.file(storagePath)

    const [exists] = await file.exists()
    if (!exists) return null

    const [url] = await file.getSignedUrl({
      action:  'read',
      expires: Date.now() + 2 * 60 * 60 * 1000, // 2h
    })
    return url
  } catch {
    return null
  }
}

module.exports = { generateDocxHtml, injectHighlights, getHighlightedHtmlUrl }
