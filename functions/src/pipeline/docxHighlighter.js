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

function wrapHtml(body, analysisId) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="analysisId" content="${analysisId}">
<style>
  /* ════════════════════════════════════════════════════════════════
     BASE — modo claro (padrão)
     ════════════════════════════════════════════════════════════════ */
 
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
 
  :root {
    --page-bg:      #d6d6d6;   /* fundo externo à folha — cinza médio */
    --sheet-bg:     #ffffff;   /* cor da folha */
    --text-color:   #1a1a1a;
    --heading-1:    #0d1b2a;
    --heading-2:    #0d1b2a;
    --heading-3:    #1e3050;
    --table-border: #c0c0c0;
    --table-header: #f0f0f0;
    --table-stripe: #fafafa;
    --hr-color:     #d0d0d0;
    --link-color:   #1155cc;
    --legend-bg:    rgba(255,255,255,.96);
    --legend-border:#e0e0e0;
    --legend-text:  #555;
 
    /* ── Highlights — modo claro ── */
    /* Cores saturadas com borda inferior sólida para não sumirem no branco */
    --hl-adequate-bg:    #bbf7d0;
    --hl-adequate-text:  #14532d;
    --hl-adequate-bd:    #16a34a;
 
    --hl-implicit-bg:    #99f6e4;
    --hl-implicit-text:  #134e4a;
    --hl-implicit-bd:    #0d9488;
 
    --hl-attention-bg:   #fde68a;
    --hl-attention-text: #78350f;
    --hl-attention-bd:   #d97706;
 
    --hl-critical-bg:    #fca5a5;
    --hl-critical-text:  #7f1d1d;
    --hl-critical-bd:    #dc2626;
  }
 
  /* ════════════════════════════════════════════════════════════════
     DARK MODE — detectado via prefers-color-scheme E via classe
     .dark injetada pelo pai através de postMessage (ver script).
     Ambos os mecanismos são suportados.
     ════════════════════════════════════════════════════════════════ */
  @media (prefers-color-scheme: dark) { :root { --_dark: 1; } }
  html.dark { --_dark: 1; }
 
  @media (prefers-color-scheme: dark) {
    :root {
      --page-bg:      #1a1e26;   /* fundo externo — azul-escuro suave, não preto puro */
      --sheet-bg:     #242a36;   /* folha — cinza-azulado escuro */
      --text-color:   #d1d5db;
      --heading-1:    #93c5fd;   /* azul claro — destaca do fundo escuro */
      --heading-2:    #93c5fd;
      --heading-3:    #7dd3fc;
      --table-border: #374151;
      --table-header: #1f2937;
      --table-stripe: #1a2030;
      --hr-color:     #374151;
      --link-color:   #60a5fa;
      --legend-bg:    rgba(30,36,48,.97);
      --legend-border:#374151;
      --legend-text:  #9ca3af;
 
      /* Highlights — modo escuro: mais saturados, texto claro */
      --hl-adequate-bg:    #14532d;
      --hl-adequate-text:  #bbf7d0;
      --hl-adequate-bd:    #22c55e;
 
      --hl-implicit-bg:    #134e4a;
      --hl-implicit-text:  #99f6e4;
      --hl-implicit-bd:    #14b8a6;
 
      --hl-attention-bg:   #78350f;
      --hl-attention-text: #fde68a;
      --hl-attention-bd:   #f59e0b;
 
      --hl-critical-bg:    #7f1d1d;
      --hl-critical-text:  #fca5a5;
      --hl-critical-bd:    #ef4444;
    }
  }
 
  /* Mesma paleta para classe .dark (sincronizada via postMessage) */
  html.dark {
    --page-bg:      #1a1e26;
    --sheet-bg:     #242a36;
    --text-color:   #d1d5db;
    --heading-1:    #93c5fd;
    --heading-2:    #93c5fd;
    --heading-3:    #7dd3fc;
    --table-border: #374151;
    --table-header: #1f2937;
    --table-stripe: #1a2030;
    --hr-color:     #374151;
    --link-color:   #60a5fa;
    --legend-bg:    rgba(30,36,48,.97);
    --legend-border:#374151;
    --legend-text:  #9ca3af;
 
    --hl-adequate-bg:    #14532d;
    --hl-adequate-text:  #bbf7d0;
    --hl-adequate-bd:    #22c55e;
 
    --hl-implicit-bg:    #134e4a;
    --hl-implicit-text:  #99f6e4;
    --hl-implicit-bd:    #14b8a6;
 
    --hl-attention-bg:   #78350f;
    --hl-attention-text: #fde68a;
    --hl-attention-bd:   #f59e0b;
 
    --hl-critical-bg:    #7f1d1d;
    --hl-critical-text:  #fca5a5;
    --hl-critical-bd:    #ef4444;
  }
 
  /* ════════════════════════════════════════════════════════════════
     LAYOUT
     ════════════════════════════════════════════════════════════════ */
 
  html {
    background: var(--page-bg);
    min-height: 100%;
    transition: background .2s;
  }
 
  body {
    font-family: 'Calibri', 'Carlito', 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    color: var(--text-color);
    background: var(--page-bg);
    padding: 28px 16px 64px;   /* espaço inferior para a legenda fixa */
    transition: background .2s, color .2s;
  }
 
  /* Simulação de folha A4 com sombra */
  .page-wrapper {
    max-width: 794px;           /* 210mm @ 96dpi ≈ 794px */
    margin: 0 auto;
    background: var(--sheet-bg);
    box-shadow:
      0 1px 3px rgba(0,0,0,.12),
      0 4px 16px rgba(0,0,0,.18),
      0 0 0 1px rgba(0,0,0,.06);
    border-radius: 2px;
    padding: 96px 108px 96px;   /* ABNT: margens sup/inf 3cm, lat 3cm/2cm */
    transition: background .2s, box-shadow .2s;
  }
 
  /* ════════════════════════════════════════════════════════════════
     TIPOGRAFIA — fidelidade ao Word / ABNT
     ════════════════════════════════════════════════════════════════ */
 
  h1, h2, h3, h4, h5, h6 {
    color: var(--heading-1);
    page-break-after: avoid;
    line-height: 1.3;
    transition: color .2s;
  }
 
  h1 {
    font-size: 14pt;
    font-weight: 700;
    margin: 32px 0 12px;
    text-transform: uppercase;
    letter-spacing: .04em;
    border-bottom: 2px solid var(--heading-1);
    padding-bottom: 4px;
  }
 
  h2 {
    font-size: 12pt;
    font-weight: 700;
    margin: 24px 0 8px;
    color: var(--heading-2);
  }
 
  h3 {
    font-size: 12pt;
    font-weight: 600;
    margin: 18px 0 6px;
    color: var(--heading-3);
  }
 
  h4, h5, h6 {
    font-size: 12pt;
    font-weight: 600;
    margin: 14px 0 4px;
  }
 
  p {
    margin: 0 0 12px;
    text-align: justify;
    hyphens: auto;
    orphans: 3;
    widows: 3;
  }
  p:last-child { margin-bottom: 0; }
 
  /* Parágrafo recuado (padrão ABNT) */
  p + p { text-indent: 1.25cm; }
  h1 + p, h2 + p, h3 + p, h4 + p, li > p { text-indent: 0; }
 
  /* ── Listas ── */
  ul, ol {
    margin: 8px 0 12px 32px;
    padding: 0;
  }
  li {
    margin-bottom: 5px;
    line-height: 1.6;
  }
 
  /* ── Tabelas ── */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 20px 0;
    font-size: 11pt;
  }
  td, th {
    border: 1px solid var(--table-border);
    padding: 7px 11px;
    vertical-align: top;
    transition: background .2s, border-color .2s;
  }
  th {
    background: var(--table-header);
    font-weight: 600;
    text-align: left;
  }
  tr:nth-child(even) td { background: var(--table-stripe); }
 
  /* ── Imagens ── */
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 16px auto;
  }
 
  /* ── Links ── */
  a { color: var(--link-color); text-decoration: underline; transition: color .2s; }
 
  /* ── Separadores ── */
  hr {
    border: none;
    border-top: 1px solid var(--hr-color);
    margin: 24px 0;
    transition: border-color .2s;
  }
 
  /* ── Citações longas (blockquote) ── */
  blockquote {
    margin: 16px 0 16px 40px;
    font-size: 11pt;
    color: var(--text-color);
    border-left: 3px solid var(--hr-color);
    padding-left: 12px;
  }
 
  /* ════════════════════════════════════════════════════════════════
     HIGHLIGHTS — visíveis tanto no fundo branco quanto no escuro
 
     Estratégia:
     - Borda inferior grossa (3px) garante visibilidade mesmo quando
       o fundo do highlight é próximo ao fundo da folha.
     - Borda esquerda fina (2px) cria identidade visual lateral.
     - Padding generoso para não cortar letras.
     - Cursor pointer indica interatividade.
     ════════════════════════════════════════════════════════════════ */
 
  mark {
    border-radius: 3px;
    padding: 1px 4px 0;
    cursor: pointer;
    transition: opacity .15s, box-shadow .15s, filter .1s;
    text-decoration: none;
    display: inline;
    /* Borda inferior sempre visível */
    border-bottom: 3px solid transparent;
    border-left: 2px solid transparent;
  }
  mark:hover {
    filter: brightness(.92);
    box-shadow: 0 2px 8px rgba(0,0,0,.18);
  }
 
  mark.hl-adequate {
    background: var(--hl-adequate-bg);
    color: var(--hl-adequate-text);
    border-bottom-color: var(--hl-adequate-bd);
    border-left-color: var(--hl-adequate-bd);
  }
  mark.hl-adequate-implicit {
    background: var(--hl-implicit-bg);
    color: var(--hl-implicit-text);
    border-bottom-color: var(--hl-implicit-bd);
    border-left-color: var(--hl-implicit-bd);
  }
  mark.hl-attention {
    background: var(--hl-attention-bg);
    color: var(--hl-attention-text);
    border-bottom-color: var(--hl-attention-bd);
    border-left-color: var(--hl-attention-bd);
  }
  mark.hl-critical {
    background: var(--hl-critical-bg);
    color: var(--hl-critical-text);
    border-bottom-color: var(--hl-critical-bd);
    border-left-color: var(--hl-critical-bd);
  }
 
  /* Mark ativo (selecionado no checklist) */
  mark.hl-active {
    outline: 2.5px solid #3b82f6;
    outline-offset: 2px;
    box-shadow: 0 0 0 5px rgba(59,130,246,.20);
  }
 
  /* Fade dos marks não ativos quando há um ativo */
  body.has-active mark:not(.hl-active) {
    opacity: 0.18;
    transition: opacity .2s;
  }
 
  /* ════════════════════════════════════════════════════════════════
     LEGENDA — fixa no rodapé do iframe
     ════════════════════════════════════════════════════════════════ */
 
  .hl-legend {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 7px 20px;
    background: var(--legend-bg);
    border-top: 1px solid var(--legend-border);
    font-size: 10.5pt;
    color: var(--legend-text);
    backdrop-filter: blur(6px);
    z-index: 100;
    transition: background .2s, border-color .2s;
  }
  .hl-legend strong { font-size: 10pt; color: var(--legend-text); margin-right: 4px; }
  .hl-legend span   { display: flex; align-items: center; gap: 6px; font-size: 10pt; }
  .hl-dot {
    width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0;
    border: 1px solid rgba(0,0,0,.12);
  }
  .hl-dot.adequate          { background: var(--hl-adequate-bd); }
  .hl-dot.adequate-implicit { background: var(--hl-implicit-bd); }
  .hl-dot.attention         { background: var(--hl-attention-bd); }
  .hl-dot.critical          { background: var(--hl-critical-bd); }
    
    .hl-scroll-target {
    outline: 3px solid #f59e0b !important;
    outline-offset: 3px;
    box-shadow: 0 0 0 6px rgba(245,158,11,.25) !important;
    animation: scroll-pulse 1.8s ease-out forwards;
  }
  @keyframes scroll-pulse {
    0%   { box-shadow: 0 0 0 8px rgba(245,158,11,.40); outline-color: #f59e0b; }
    70%  { box-shadow: 0 0 0 6px rgba(245,158,11,.20); outline-color: #f59e0b; }
    100% { box-shadow: 0 0 0 0px rgba(245,158,11,.0);  outline-color: transparent; }
  }
</style>
</head>
<body>
<div class="page-wrapper">
${body}
</div>
 
<div class="hl-legend">
  <strong>Trechos analisados:</strong>
  <span><div class="hl-dot adequate"></div> Adequado</span>
  <span><div class="hl-dot adequate-implicit"></div> Implícito</span>
  <span><div class="hl-dot attention"></div> Atenção</span>
  <span><div class="hl-dot critical"></div> Crítico</span>
</div>
 
<script>
  // ── Sinaliza prontidão ao pai ──────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*')
  })
 
  // ── Sincroniza dark mode com o tema do pai ─────────────────────────────────
  // O pai envia { type: 'SET_THEME', dark: true/false } ao carregar e ao trocar.
  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
 
  // Detecta o tema do pai pela cor de fundo do document (heurística simples)
  // e aplica imediatamente para evitar flash.
  try {
    const parentBg = window.parent.document.documentElement.classList.contains('dark')
    applyTheme(parentBg)
  } catch (e) {
    // cross-origin: usa prefers-color-scheme como fallback (já tratado no CSS)
  }
 
  // ── Recebe mensagens do pai ────────────────────────────────────────────────
  window.addEventListener('message', (e) => {
    const { type, elementId, dark } = e.data || {}
 
    // Sincronização de tema
    if (type === 'SET_THEME') {
      applyTheme(dark)
      return
    }
 
    if (type === 'SCROLL_TO_TEXT') {
      const searchText = e.data.text
      if (!searchText) return
 
      // Remove pulso anterior
      document.querySelectorAll('.hl-scroll-target').forEach(m => {
        m.classList.remove('hl-scroll-target')
      })
 
      const needle = searchText.slice(0, 80).toLowerCase().trim()
      let target = null
 
      // 1. Tenta encontrar em marks já destacados
      const allMarks = document.querySelectorAll('mark[data-element]')
      for (const m of allMarks) {
        if (m.textContent.toLowerCase().includes(needle)) {
          target = m
          break
        }
      }
 
      // 2. Fallback: busca em qualquer nó de texto
      if (!target) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let node
        while ((node = walker.nextNode())) {
          if (node.textContent.toLowerCase().includes(needle)) {
            target = node.parentElement
            break
          }
        }
      }
 
      if (target) {
        target.classList.add('hl-scroll-target')
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Remove a classe após a animação
        setTimeout(() => target.classList.remove('hl-scroll-target'), 2000)
      }
      return
    }
 
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
 
  // ── Clique num mark → notifica o pai ──────────────────────────────────────
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
