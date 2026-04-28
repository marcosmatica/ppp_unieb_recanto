// functions/src/parecer/parecerTemplate.js

'use strict'

const TIPO_CONFIG = {
  nao_conformidade: { label: 'Não conformidade', color: '#b91c1c', bg: '#fef2f2' },
  ajuste:           { label: 'Ajuste necessário', color: '#b45309', bg: '#fffbeb' },
  observacao:       { label: 'Observação',        color: '#0f766e', bg: '#f0fdfa' },
  conformidade:     { label: 'Conforme',          color: '#166534', bg: '#f0fdf4' },
  info:             { label: 'Informação',        color: '#1d4ed8', bg: '#eff6ff' },
}

function renderParecerHtml({ analysis, observations, anchoredBodyHtml, paragraphs }) {
  const schoolName = escapeHtml(analysis.schoolName || '—')
  const year       = analysis.year || ''
  const inep       = analysis.schoolCode || ''
  const cre        = analysis.cre || ''
  const genDate    = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const visible = observations
    .filter(o => o.status !== 'rejected')
    .map((o, i) => ({ ...o, _num: i + 1 }))

  const pMap = {}
  for (const p of paragraphs) pMap[p.id] = p

  const obsByAnchor = {}
  for (const o of visible) {
    if (!o.anchorId) continue
    if (!obsByAnchor[o.anchorId]) obsByAnchor[o.anchorId] = []
    obsByAnchor[o.anchorId].push(o)
  }

  const orphans = visible.filter(o => !o.anchorId || !pMap[o.anchorId])

  const twoColumnBody = wrapInTwoColumnGrid(anchoredBodyHtml, obsByAnchor)

  const counts = {
    total:            visible.length,
    nao_conformidade: visible.filter(o => o.tipo === 'nao_conformidade').length,
    ajuste:           visible.filter(o => o.tipo === 'ajuste').length,
    observacao:       visible.filter(o => o.tipo === 'observacao').length,
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Parecer PPP — ${schoolName}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 12mm 16mm 12mm;
    @top-left {
      content: "${schoolName}";
      font-family: 'Cambria', 'Times New Roman', Georgia, serif;
      font-size: 8.5pt;
      font-style: italic;
      color: #64748b;
    }
    @top-right {
      content: "Parecer Técnico-Pedagógico · PPP ${year}";
      font-family: 'Cambria', 'Times New Roman', Georgia, serif;
      font-size: 8.5pt;
      color: #475569;
    }
    @bottom-left {
      content: "SEEDF · UNIEB Recanto das Emas";
      font-family: 'Cambria', 'Times New Roman', Georgia, serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-family: 'Cambria', 'Times New Roman', Georgia, serif;
      font-size: 8.5pt;
      color: #475569;
    }
  }
  @page :first {
    margin: 25mm 22mm 22mm 22mm;
    @top-left { content: none; } @top-right { content: none; }
    @bottom-left { content: none; } @bottom-right { content: none; }
  }

  * { box-sizing: border-box; }
  html, body {
    font-family: 'Cambria', 'Times New Roman', Georgia, serif;
    color: #111827;
    margin: 0; padding: 0;
    text-rendering: optimizeLegibility;
  }

  /* ─────────────── CAPA ─────────────── */
  .cover { page-break-after: always; padding: 8mm 5mm 0; font-size: 12pt; }
  .cover-brand {
    font-family: 'Calibri', 'Segoe UI', sans-serif;
    font-size: 10pt; color: #0b2d5b;
    text-transform: uppercase; letter-spacing: 2.5px;
    border-bottom: 2.5px solid #f0a500;
    padding-bottom: 3mm; margin-bottom: 12mm;
    display: inline-block;
  }
  .cover h1 {
    font-family: 'Cambria', 'Times New Roman', serif;
    font-size: 26pt; color: #0b2d5b;
    margin: 4mm 0 3mm; line-height: 1.2; font-weight: 700;
  }
  .cover-subtitle {
    font-size: 15pt; color: #334155;
    margin-bottom: 16mm; font-style: italic;
  }
  .cover-meta {
    display: grid; grid-template-columns: 38mm 1fr;
    gap: 3mm 6mm; font-size: 11.5pt; margin-bottom: 12mm;
    padding: 6mm 7mm; background: #f8fafc;
    border-left: 3px solid #0b2d5b;
  }
  .cover-meta b { color: #475569; font-weight: 600; }
  .cover-meta span { color: #111827; }
  .cover-summary {
    margin-top: 6mm; padding: 6mm 7mm;
    border: 1px solid #e2e8f0; border-radius: 1.5mm;
  }
  .cover-summary h3 {
    font-family: 'Calibri', 'Segoe UI', sans-serif;
    font-size: 13pt; color: #0b2d5b;
    margin: 0 0 4mm; text-transform: uppercase; letter-spacing: 0.6px;
  }
  .cover-counts { display: flex; gap: 5mm; flex-wrap: wrap; margin-bottom: 4mm; }
  .cc {
    font-family: 'Calibri', 'Segoe UI', sans-serif;
    font-size: 10.5pt; padding: 1.8mm 4mm;
    border-radius: 2.5mm; font-weight: 600;
  }
  .cc-tot { background: #e0e7ff; color: #3730a3; }
  .cc-nao { background: #fef2f2; color: #b91c1c; }
  .cc-aju { background: #fffbeb; color: #b45309; }
  .cc-obs { background: #f0fdfa; color: #0f766e; }
  .cover-legend {
    margin-top: 5mm; font-family: 'Calibri', 'Segoe UI', sans-serif;
    font-size: 10pt; color: #475569; line-height: 1.55; font-style: italic;
  }

  /* ─────────────── LAYOUT 2 COLUNAS — edição do professor ─────────────── */
  .doc-grid {
    width: 100%; border-collapse: collapse;
    table-layout: fixed; margin: 0;
  }
  .doc-grid col.col-text   { width: 70%; }
  .doc-grid col.col-margin { width: 30%; }
  .doc-grid > tbody > tr {
    page-break-inside: avoid; break-inside: avoid;
  }
  .doc-grid > tbody > tr > td {
    vertical-align: top; padding: 0;
  }
  .doc-grid td.doc-text {
    padding: 0 6mm 0 0;
    font-size: 10pt; line-height: 1.45; color: #1f2937;
  }
  .doc-grid td.doc-margin {
    padding: 0 0 0 5mm;
    border-left: 1.5px solid #fcd34d;
    background: #fefce8;
    font-family: 'Calibri', 'Segoe UI', sans-serif;
  }
  .doc-grid td.doc-margin:empty::before {
    content: ""; display: block; min-height: 1px;
  }

  /* Texto reduzido (coluna esquerda) */
  td.doc-text h1, td.doc-text h2, td.doc-text h3, td.doc-text h4 {
    font-family: 'Cambria', 'Times New Roman', serif;
    color: #0b2d5b; line-height: 1.25;
    page-break-after: avoid; break-after: avoid;
    margin: 4mm 0 1.5mm;
  }
  td.doc-text h1 { font-size: 13pt; font-weight: 700; }
  td.doc-text h2 { font-size: 12pt; font-weight: 700; }
  td.doc-text h3 { font-size: 11pt; font-weight: 700; }
  td.doc-text h4 { font-size: 10.5pt; font-weight: 700; color: #1e3a8a; }
  td.doc-text p {
    margin: 0 0 2mm; text-align: justify;
    text-indent: 6mm; orphans: 3; widows: 3; hyphens: auto;
  }
  td.doc-text h1 + p, td.doc-text h2 + p, td.doc-text h3 + p, td.doc-text h4 + p { text-indent: 0; }
  td.doc-text ul, td.doc-text ol { margin: 1.5mm 0 2mm 7mm; padding: 0; }
  td.doc-text li { margin-bottom: 0.8mm; text-align: justify; }
  td.doc-text blockquote {
    margin: 2mm 4mm; padding: 1.5mm 3mm;
    border-left: 2px solid #cbd5e1;
    color: #334155; font-style: italic; font-size: 9.5pt;
  }
  td.doc-text table {
    border-collapse: collapse; margin: 2.5mm 0;
    width: 100%; font-size: 9pt; line-height: 1.35;
  }
  td.doc-text table thead { display: table-header-group; }
  td.doc-text table tr {
    page-break-inside: avoid; break-inside: avoid;
  }
  td.doc-text table td, td.doc-text table th {
    border: 1px solid #94a3b8;
    padding: 1.2mm 2mm; vertical-align: top;
  }
  td.doc-text table th {
    background: #f1f5f9; font-weight: 700; color: #0b2d5b;
  }
  td.doc-text img { max-width: 100%; height: auto; page-break-inside: avoid; }

  /* Marcadores numéricos */
  .obs-marker {
    display: inline-block;
    min-width: 4mm; height: 4mm;
    padding: 0 1.1mm; margin: 0 0.4mm;
    background: #0b2d5b; color: #fff;
    font-family: 'Calibri', 'Segoe UI', sans-serif;
    font-size: 7pt; font-weight: 700;
    text-align: center; line-height: 4mm;
    border-radius: 2mm; vertical-align: super;
  }
  .obs-marker.mk-critical  { background: #b91c1c; }
  .obs-marker.mk-attention { background: #b45309; }
  .obs-marker.mk-implicit  { background: #0f766e; }
  .obs-marker.mk-info      { background: #1d4ed8; }

  td.doc-text [data-anchor].has-obs {
    background: linear-gradient(transparent 60%, #fef9c3 60%);
    padding: 0 0.5mm;
  }

  /* Callouts na margem */
  .callout {
    margin: 0 0 3mm; padding: 2.5mm 3mm 3mm;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #0b2d5b;
    border-radius: 0 1.2mm 1.2mm 0;
    font-size: 9pt; line-height: 1.4;
    page-break-inside: avoid; break-inside: avoid;
  }
  .callout.cl-critical  { border-left-color: #b91c1c; background: #fffafa; }
  .callout.cl-attention { border-left-color: #b45309; background: #fffdf5; }
  .callout.cl-implicit  { border-left-color: #0f766e; background: #f6fffd; }
  .callout.cl-info      { border-left-color: #1d4ed8; background: #f8faff; }

  .callout-head {
    display: flex; align-items: center;
    gap: 2mm; margin-bottom: 1.5mm; flex-wrap: wrap;
  }
  .callout-num {
    display: inline-block;
    min-width: 4.2mm; height: 4.2mm;
    line-height: 4.2mm; text-align: center;
    background: #0b2d5b; color: #fff;
    font-size: 7.5pt; font-weight: 700;
    border-radius: 2.1mm; padding: 0 1.1mm;
  }
  .callout.cl-critical  .callout-num { background: #b91c1c; }
  .callout.cl-attention .callout-num { background: #b45309; }
  .callout.cl-implicit  .callout-num { background: #0f766e; }
  .callout.cl-info      .callout-num { background: #1d4ed8; }

  .callout-tipo {
    display: inline-block;
    font-size: 7pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.4px;
    padding: 0.4mm 1.6mm; border-radius: 0.8mm;
  }
  .callout-section-label {
    font-size: 7.5pt; color: #0b2d5b;
    font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.3px; margin-left: auto;
  }
  .callout-title {
    font-weight: 700; color: #0b2d5b;
    font-size: 9.5pt; margin: 0 0 1mm; line-height: 1.3;
  }
  .callout-body {
    color: #1f2937; margin: 0 0 1.2mm;
    text-align: left; text-indent: 0;
  }
  .callout-body strong { color: #0b2d5b; }
  .callout-missing {
    margin: 0.8mm 0 0; padding-left: 4mm;
    color: #475569; font-size: 8.5pt;
  }
  .callout-missing li { margin-bottom: 0.3mm; text-indent: 0; }
  .callout-missing-refs {
    margin-top: 1.2mm; color: #b91c1c;
    font-size: 8.5pt; font-weight: 600;
  }
  .callout-ref {
    margin-top: 1.5mm; padding-top: 1.2mm;
    border-top: 1px dashed #cbd5e1;
    color: #475569; font-size: 8pt; font-style: italic;
  }
  .callout-comment {
    margin-top: 1.5mm; padding: 1.2mm 2mm;
    background: #fffbeb; border-left: 2px solid #f59e0b;
    color: #78350f; font-size: 8.5pt;
  }
  .callout-comment::before {
    content: "Comentário do analista: "; font-weight: 700;
  }

  /* Órfãs */
  .orphans-section { page-break-before: always; padding-top: 5mm; }
  .orphans-section h2 {
    font-family: 'Cambria', serif;
    font-size: 14pt; color: #0b2d5b;
    border-bottom: 2.5px solid #f0a500;
    padding-bottom: 2mm; margin: 0 0 4mm;
  }
  .orphans-intro {
    color: #475569; font-size: 11pt;
    font-style: italic; margin-bottom: 5mm;
  }
  .orphans-section .callout { font-size: 10pt; padding: 3mm 4mm; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-brand">SEEDF · UNIEB Recanto das Emas</div>
  <h1>Parecer Técnico-Pedagógico<br/>Projeto Político-Pedagógico</h1>
  <div class="cover-subtitle">${schoolName}</div>

  <div class="cover-meta">
    <b>Escola:</b>         <span>${schoolName}</span>
    ${inep ? `<b>Código INEP:</b>     <span>${escapeHtml(inep)}</span>` : ''}
    ${cre  ? `<b>CRE:</b>            <span>${escapeHtml(cre)}</span>`  : ''}
    <b>Ano letivo:</b>     <span>${year}</span>
    <b>Emitido em:</b>     <span>${genDate}</span>
    <b>Fundamentação:</b>  <span>Portaria SEEDF nº 139/2024 · Portaria nº 174/2026</span>
  </div>

  <div class="cover-summary">
    <h3>Síntese das observações</h3>
    <div class="cover-counts">
      <span class="cc cc-tot">${counts.total} no total</span>
      <span class="cc cc-nao">${counts.nao_conformidade} não conformidades</span>
      <span class="cc cc-aju">${counts.ajuste} ajustes</span>
      <span class="cc cc-obs">${counts.observacao} observações</span>
    </div>
    <div class="cover-legend">
      O documento original aparece reduzido na coluna principal. Na faixa lateral à direita,
      destacada em fundo claro, encontram-se as observações da análise alinhadas ao
      respectivo trecho. Marcadores numerados (<span class="obs-marker mk-critical">1</span>)
      indicam a ligação entre cada observação e o ponto do texto.
    </div>
  </div>
</section>

<table class="doc-grid">
  <colgroup>
    <col class="col-text">
    <col class="col-margin">
  </colgroup>
  <tbody>
    ${twoColumnBody}
  </tbody>
</table>

${orphans.length > 0 ? renderOrphansSection(orphans) : ''}

</body>
</html>`
}

function wrapInTwoColumnGrid(bodyHtml, obsByAnchor) {
  const blockRe = /<(p|h[1-6]|ul|ol|table|blockquote|div|figure|pre)\b[^>]*>[\s\S]*?<\/\1>|<(hr|br)\b[^>]*\/?>/gi

  const rows = []
  let match

  while ((match = blockRe.exec(bodyHtml)) !== null) {
    const block = match[0]

    const anchorIds = []
    const anchorRe = /data-anchor="([^"]+)"/g
    let am
    while ((am = anchorRe.exec(block)) !== null) anchorIds.push(am[1])

    let processedBlock = block
    const allCallouts = []

    if (anchorIds.length > 0) {
      processedBlock = block.replace(
        /<(p|h[1-6]|li|blockquote)([^>]*?)data-anchor="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
        (full, tag, before, anchorId, after, inner) => {
          const obs = obsByAnchor[anchorId]
          if (!obs) return full

          const markers = obs.map(o =>
            `<span class="obs-marker ${mkClass(o.tipo)}">${o._num}</span>`
          ).join('')

          obs.forEach(o => allCallouts.push(renderCallout(o)))

          const cleanedAttrs = (before + after).replace(/\sclass="[^"]*"/i, '')
          return `<${tag}${cleanedAttrs} data-anchor="${anchorId}" class="has-obs">${inner}${markers}</${tag}>`
        }
      )
    }

    const rightCol = allCallouts.length > 0 ? allCallouts.join('') : ''
    rows.push(`<tr><td class="doc-text">${processedBlock}</td><td class="doc-margin">${rightCol}</td></tr>`)
  }

  return rows.join('\n')
}

function renderCallout(o) {
  const cfg = TIPO_CONFIG[o.tipo] || TIPO_CONFIG.info
  const cls = clClass(o.tipo)

  const tipoBadge = `<span class="callout-tipo" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>`
  const sectionLabel = o.blockLabel
    ? `<span class="callout-section-label">${escapeHtml(o.blockLabel)}</span>` : ''
  const title = o.label
    ? `<div class="callout-title">${escapeHtml(cleanText(o.label))}</div>` : ''
  const body = o.texto
    ? `<p class="callout-body"><strong>Análise:</strong> ${escapeHtml(cleanText(o.texto))}</p>` : ''
  const missing = (o.missingItems?.length > 0)
    ? `<ul class="callout-missing">${o.missingItems.slice(0, 6).map(m => `<li>${escapeHtml(cleanText(m))}</li>`).join('')}</ul>` : ''
  const missingRefs = (o.missingRefs?.length > 0)
    ? `<p class="callout-missing-refs">Refs. ausentes: ${escapeHtml(o.missingRefs.join(', '))}</p>` : ''
  const ref = o.normRef
    ? `<div class="callout-ref">${escapeHtml(o.normRef)}</div>` : ''
  const humanComment = o.humanReview
    ? `<div class="callout-comment">${escapeHtml(cleanText(o.humanReview))}</div>` : ''

  return `<div class="callout ${cls}">
    <div class="callout-head">
      <span class="callout-num">${o._num}</span>
      ${tipoBadge}
      ${sectionLabel}
    </div>
    ${title}
    ${body}
    ${missing}
    ${missingRefs}
    ${humanComment}
    ${ref}
  </div>`
}

function renderOrphansSection(orphans) {
  const cards = orphans.map(o => {
    const cfg = TIPO_CONFIG[o.tipo] || TIPO_CONFIG.info
    const cls = clClass(o.tipo)

    return `<div class="callout ${cls}">
      <div class="callout-head">
        <span class="callout-num">${o._num}</span>
        <span class="callout-tipo" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>
        ${o.blockLabel ? `<span class="callout-section-label">${escapeHtml(o.blockLabel)}</span>` : ''}
      </div>
      ${o.label ? `<div class="callout-title">${escapeHtml(cleanText(o.label))}</div>` : ''}
      ${o.section ? `<p class="callout-body" style="color:#475569"><em>Seção: ${escapeHtml(o.section)}</em></p>` : ''}
      ${o.texto ? `<p class="callout-body"><strong>Análise:</strong> ${escapeHtml(cleanText(o.texto))}</p>` : ''}
      ${o.missingItems?.length > 0 ? `<ul class="callout-missing">${o.missingItems.slice(0,8).map(m => `<li>${escapeHtml(cleanText(m))}</li>`).join('')}</ul>` : ''}
      ${o.missingRefs?.length > 0 ? `<p class="callout-missing-refs">Refs. ausentes: ${escapeHtml(o.missingRefs.join(', '))}</p>` : ''}
      ${o.humanReview ? `<div class="callout-comment">${escapeHtml(cleanText(o.humanReview))}</div>` : ''}
      ${o.normRef ? `<div class="callout-ref">${escapeHtml(o.normRef)}</div>` : ''}
    </div>`
  }).join('')

  return `<section class="orphans-section">
    <h2>Observações sem trecho ancorado</h2>
    <p class="orphans-intro">
      Referem-se a elementos previstos pela normativa não localizados no documento ou
      aplicáveis à totalidade do PPP.
    </p>
    ${cards}
  </section>`
}

function cleanText(str) {
  if (str == null) return ''
  return String(str)
    .replace(/An[áa]lise\s+(?:de|da)\s+IA\s*[:\-—]?\s*/gi, 'Análise: ')
    .replace(/An[áa]lise\s+(?:de|da)\s+IA/gi, 'Análise')
    .replace(/\bA\s+IA\s+(identificou|encontrou|detectou|sugere|indica|aponta|verificou|notou|observou)/gi, 'A análise $1')
    .replace(/\bIA\s+(identificou|encontrou|detectou|sugere|indica|aponta|verificou|notou|observou)/gi, 'A análise $1')
    .replace(/\s+/g, ' ')
    .trim()
}

function mkClass(tipo) {
  if (tipo === 'nao_conformidade') return 'mk-critical'
  if (tipo === 'ajuste')           return 'mk-attention'
  if (tipo === 'observacao')       return 'mk-implicit'
  return 'mk-info'
}
function clClass(tipo) {
  if (tipo === 'nao_conformidade') return 'cl-critical'
  if (tipo === 'ajuste')           return 'cl-attention'
  if (tipo === 'observacao')       return 'cl-implicit'
  return 'cl-info'
}

function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { renderParecerHtml }
