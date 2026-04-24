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
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; padding: 2rem; max-width: 780px; margin: 0 auto; background: #fff; }
  h1, h2, h3, h4 { font-family: 'Sora', 'Segoe UI', sans-serif; color: #0b2d5b; line-height: 1.25; margin: 1.6em 0 0.6em; }
  h1 { font-size: 22pt; } h2 { font-size: 17pt; } h3 { font-size: 14pt; }
  p { margin: 0.6em 0; text-align: justify; }
  ul, ol { margin: 0.6em 0 0.6em 1.2em; }
  [data-anchor] { scroll-margin-top: 80px; transition: background-color 0.3s ease; }
  [data-anchor].is-active { background-color: #fff3cd; border-left: 3px solid #f0a500; padding-left: 0.6em; margin-left: -0.9em; }
  [data-anchor].is-hover  { background-color: #eef5ff; }
  table { border-collapse: collapse; margin: 1em 0; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 0.4em 0.6em; font-size: 11pt; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${body}
<script>
  const paragraphs = Array.from(document.querySelectorAll('[data-anchor]'))

  window.addEventListener('message', (event) => {
    const { type, anchorId, offsetTop } = event.data || {}

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
      if (!anchorId) return
      const target = document.querySelector(\`[data-anchor="\${anchorId}"]\`)
      if (target) {
        target.classList.add('is-active')
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (type === 'PARECER_HOVER') {
      paragraphs.forEach(el => el.classList.remove('is-hover'))
      if (!anchorId) return
      document.querySelector(\`[data-anchor="\${anchorId}"]\`)?.classList.add('is-hover')
    }
  })

  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-anchor]')
    if (!p) return
    window.parent.postMessage({ type: 'PARECER_PARAGRAPH_CLICKED', anchorId: p.dataset.anchor }, '*')
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
