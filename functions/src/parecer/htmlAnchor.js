// functions/src/parecer/htmlAnchor.js

'use strict'

const mammoth        = require('mammoth')
const { getStorage } = require('firebase-admin/storage')
const { logger }     = require('firebase-functions')
const { v4: uuidv4 } = require('uuid')

const ANCHORED_FILE = 'parecer_anchored.html'

async function generateAnchoredHtml(buffer, analysisId, bucketName) {
  const { value: rawHtml } = await mammoth.convertToHtml(
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

  const { html: anchoredBody, paragraphs } = injectAnchors(rawHtml)
  const html = wrapHtml(anchoredBody, analysisId)

  const storagePath = `analyses/${analysisId}/${ANCHORED_FILE}`
  const bucket      = getStorage().bucket(bucketName)
  const file        = bucket.file(storagePath)
  const token       = uuidv4()

  await file.save(Buffer.from(html, 'utf-8'), {
    contentType: 'text/html; charset=utf-8',
    metadata: {
      metadata: {
        analysisId,
        type: 'parecer_anchored',
        paragraphCount: String(paragraphs.length),
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  logger.info(`HTML anotado salvo`, { analysisId, storagePath, paragraphs: paragraphs.length })

  return { storagePath, paragraphs, token }
}

function injectAnchors(rawHtml) {
  const paragraphs = []
  let counter = 0

  const blockTagRe = /<(p|h[1-6]|li)([^>]*)>([\s\S]*?)<\/\1>/gi

  const html = rawHtml.replace(blockTagRe, (full, tag, attrs, inner) => {
    const plain = stripTags(inner).trim()
    if (!plain) return full

    counter++
    const anchorId = `anc-${counter}`
    paragraphs.push({ id: anchorId, text: plain, tag: tag.toLowerCase() })

    return `<${tag}${attrs} data-anchor="${anchorId}">${inner}</${tag}>`
  })

  return { html, paragraphs }
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
}

async function getAnchoredHtmlUrl(analysisId, bucketName) {
  const storagePath = `analyses/${analysisId}/${ANCHORED_FILE}`
  const bucket      = getStorage().bucket(bucketName)
  const file        = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (!exists) return null

  const [metadata] = await file.getMetadata()
  const token      = metadata?.metadata?.firebaseStorageDownloadTokens
  if (!token) return null

  const enc = encodeURIComponent(storagePath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${enc}?alt=media&token=${token}`
}

function wrapHtml(body, analysisId) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>PPP — ${analysisId}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; padding: 2rem; max-width: 780px; margin: 0 auto; background: #fff; transition: background-color 0.2s; }
  body.is-selecting { background: #fffbea; cursor: crosshair; }
  body.is-selecting [data-anchor]:hover { background: #fef3c7 !important; outline: 2px dashed #f59e0b; outline-offset: 4px; }
  h1, h2, h3, h4 { font-family: 'Sora', 'Segoe UI', sans-serif; color: #0b2d5b; line-height: 1.25; margin: 1.6em 0 0.6em; }
  h1 { font-size: 22pt; } h2 { font-size: 17pt; } h3 { font-size: 14pt; }
  p { margin: 0.6em 0; text-align: justify; }
  ul, ol { margin: 0.6em 0 0.6em 1.2em; }
  [data-anchor] { scroll-margin-top: 80px; transition: background-color 0.3s ease; }
  [data-anchor].is-active { background-color: #fff3cd; border-left: 3px solid #f0a500; padding-left: 0.6em; margin-left: -0.9em; }
  [data-anchor].is-hover  { background-color: #eef5ff; }
  [data-anchor].has-obs::after {
    content: attr(data-obs-count);
    display: inline-block;
    margin-left: 0.4em;
    padding: 1px 6px;
    background: #0b2d5b;
    color: #fff;
    font-size: 9pt;
    font-family: 'Sora', sans-serif;
    font-weight: 600;
    border-radius: 10px;
    vertical-align: super;
  }
  table { border-collapse: collapse; margin: 1em 0; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 0.4em 0.6em; font-size: 11pt; }
  img { max-width: 100%; height: auto; }
  #selecting-banner {
    position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    background: #f59e0b; color: #fff; padding: 8px 16px; border-radius: 20px;
    font-family: 'Sora', sans-serif; font-size: 12pt; font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999;
    display: none;
  }
  body.is-selecting #selecting-banner { display: block; }
</style>
</head>
<body>
<div id="selecting-banner">Clique em um parágrafo para ancorar a observação · ESC para cancelar</div>
${body}
<script>
  const paragraphs = Array.from(document.querySelectorAll('[data-anchor]'))
  let selectMode = false

  function applyObsCounts(counts) {
    paragraphs.forEach(el => {
      const c = counts[el.dataset.anchor] || 0
      if (c > 0) {
        el.classList.add('has-obs')
        el.setAttribute('data-obs-count', c)
      } else {
        el.classList.remove('has-obs')
        el.removeAttribute('data-obs-count')
      }
    })
  }

  window.addEventListener('message', (event) => {
    const { type } = event.data || {}

    if (type === 'PARECER_INIT') {
      window.parent.postMessage({
        type: 'PARECER_READY',
        paragraphs: paragraphs.map(el => ({
          id: el.dataset.anchor,
          top: el.offsetTop,
          height: el.offsetHeight,
        })),
      }, '*')
      return
    }

    if (type === 'PARECER_HIGHLIGHT') {
      paragraphs.forEach(el => el.classList.remove('is-active'))
      if (!event.data.anchorId) return
      const target = document.querySelector(\`[data-anchor="\${event.data.anchorId}"]\`)
      if (target) {
        target.classList.add('is-active')
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (type === 'PARECER_HOVER') {
      paragraphs.forEach(el => el.classList.remove('is-hover'))
      if (!event.data.anchorId) return
      document.querySelector(\`[data-anchor="\${event.data.anchorId}"]\`)?.classList.add('is-hover')
      return
    }

    if (type === 'PARECER_SELECT_MODE') {
      selectMode = !!event.data.enabled
      document.body.classList.toggle('is-selecting', selectMode)
      return
    }

    if (type === 'PARECER_OBS_COUNTS') {
      applyObsCounts(event.data.counts || {})
    }
  })

  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-anchor]')
    if (!p) return

    if (selectMode) {
      e.preventDefault()
      e.stopPropagation()
      window.parent.postMessage({
        type: 'PARECER_ANCHOR_PICKED',
        anchorId: p.dataset.anchor,
        text: p.innerText.trim().slice(0, 240),
      }, '*')
      return
    }

    window.parent.postMessage({ type: 'PARECER_PARAGRAPH_CLICKED', anchorId: p.dataset.anchor }, '*')
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectMode) {
      window.parent.postMessage({ type: 'PARECER_SELECT_CANCELLED' }, '*')
    }
  })

  document.addEventListener('scroll', () => {
    window.parent.postMessage({ type: 'PARECER_SCROLL', scrollY: window.scrollY }, '*')
  }, { passive: true })

  window.parent.postMessage({ type: 'PARECER_IFRAME_READY' }, '*')
</script>
</body>
</html>`
}

module.exports = { generateAnchoredHtml, getAnchoredHtmlUrl, ANCHORED_FILE }
