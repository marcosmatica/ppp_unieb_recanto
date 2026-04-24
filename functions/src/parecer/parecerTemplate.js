// functions/src/parecer/parecerTemplate.js

'use strict'

const TIPO_CONFIG = {
  nao_conformidade: { label: 'Não conformidade', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  ajuste:           { label: 'Ajuste necessário', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  observacao:       { label: 'Observação',        color: '#0f766e', bg: '#f0fdfa', border: '#5eead4' },
  conformidade:     { label: 'Conforme',          color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  info:             { label: 'Informação',        color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
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

  const bodyWithMarkers = injectMarkers(anchoredBodyHtml, obsByAnchor)

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
    margin: 20mm 85mm 20mm 20mm;
    @top-right {
      content: "Parecer PPP · ${schoolName}";
      font-family: 'Sora', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-center {
      content: counter(page) " / " counter(pages);
      font-family: 'Sora', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
  }
  @page :first {
    margin: 20mm 20mm 20mm 20mm;
    @top-right { content: none; }
    @bottom-center { content: none; }
  }

  * { box-sizing: border-box; }
  html, body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }

  .cover { page-break-after: always; padding: 40mm 10mm 20mm; }
  .cover-brand {
    font-family: 'Sora', sans-serif;
    font-size: 10pt;
    color: #0b2d5b;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 6mm;
    border-bottom: 2px solid #f0a500;
    padding-bottom: 3mm;
    display: inline-block;
  }
  .cover h1 {
    font-family: 'Sora', sans-serif;
    font-size: 28pt;
    color: #0b2d5b;
    margin: 8mm 0 4mm;
    line-height: 1.15;
  }
  .cover-subtitle {
    font-family: 'Sora', sans-serif;
    font-size: 14pt;
    color: #334155;
    margin-bottom: 15mm;
  }
  .cover-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4mm 8mm;
    font-family: 'Sora', sans-serif;
    font-size: 11pt;
    margin-bottom: 15mm;
  }
  .cover-meta b { color: #64748b; font-weight: 500; }
  .cover-meta span { color: #1a1a1a; font-weight: 600; }

  .cover-summary {
    background: #f8fafc;
    border-left: 4px solid #0b2d5b;
    padding: 6mm 8mm;
    margin-top: 10mm;
  }
  .cover-summary h3 {
    font-family: 'Sora', sans-serif;
    font-size: 12pt;
    color: #0b2d5b;
    margin: 0 0 4mm;
  }
  .cover-counts { display: flex; gap: 6mm; flex-wrap: wrap; }
  .cover-counts .cc {
    font-family: 'Sora', sans-serif;
    font-size: 10pt;
    padding: 2mm 4mm;
    border-radius: 3mm;
    font-weight: 600;
  }
  .cc-nao { background: #fef2f2; color: #b91c1c; }
  .cc-aju { background: #fffbeb; color: #b45309; }
  .cc-obs { background: #f0fdfa; color: #0f766e; }
  .cc-tot { background: #e0e7ff; color: #3730a3; }

  .cover-legend {
    margin-top: 12mm;
    font-family: 'Sora', sans-serif;
    font-size: 9pt;
    color: #64748b;
    line-height: 1.6;
  }
  .cover-footer {
    position: absolute;
    bottom: 25mm;
    left: 30mm;
    right: 30mm;
    font-family: 'Sora', sans-serif;
    font-size: 9pt;
    color: #64748b;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 4mm;
  }

  h1, h2, h3, h4 {
    font-family: 'Sora', 'Segoe UI', sans-serif;
    color: #0b2d5b;
    line-height: 1.25;
    page-break-after: avoid;
  }
  h1 { font-size: 18pt; margin: 6mm 0 3mm; }
  h2 { font-size: 14pt; margin: 5mm 0 2.5mm; }
  h3 { font-size: 12pt; margin: 4mm 0 2mm; }
  p  { margin: 2mm 0; text-align: justify; orphans: 3; widows: 3; }
  ul, ol { margin: 2mm 0 2mm 6mm; }
  table { border-collapse: collapse; margin: 3mm 0; width: 100%; page-break-inside: avoid; }
  td, th { border: 1px solid #cbd5e1; padding: 2mm 3mm; font-size: 10pt; }

  [data-anchor] { position: relative; }

  .obs-marker {
    display: inline-block;
    min-width: 4.5mm;
    height: 4.5mm;
    padding: 0 1.2mm;
    margin: 0 0.3mm;
    background: #0b2d5b;
    color: #fff;
    font-family: 'Sora', sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    text-align: center;
    line-height: 4.5mm;
    border-radius: 2.3mm;
    vertical-align: super;
  }
  .obs-marker.mk-critical  { background: #b91c1c; }
  .obs-marker.mk-attention { background: #b45309; }
  .obs-marker.mk-implicit  { background: #0f766e; }
  .obs-marker.mk-info      { background: #1d4ed8; }

  .sidenote {
    position: absolute;
    width: 72mm;
    left: 100%;
    margin-left: 5mm;
    padding: 2.5mm 3mm;
    border-radius: 1.5mm;
    font-family: 'Sora', 'Segoe UI', sans-serif;
    font-size: 8.5pt;
    line-height: 1.4;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-left-width: 3px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    page-break-inside: avoid;
  }
  .sidenote.sn-critical  { border-left-color: #b91c1c; }
  .sidenote.sn-attention { border-left-color: #b45309; }
  .sidenote.sn-implicit  { border-left-color: #0f766e; }
  .sidenote.sn-info      { border-left-color: #1d4ed8; }

  .sidenote-num {
    display: inline-block;
    width: 4.5mm;
    height: 4.5mm;
    line-height: 4.5mm;
    text-align: center;
    background: #0b2d5b;
    color: #fff;
    font-size: 7.5pt;
    font-weight: 700;
    border-radius: 2.3mm;
    margin-right: 2mm;
  }
  .sidenote.sn-critical  .sidenote-num { background: #b91c1c; }
  .sidenote.sn-attention .sidenote-num { background: #b45309; }
  .sidenote.sn-implicit  .sidenote-num { background: #0f766e; }
  .sidenote.sn-info      .sidenote-num { background: #1d4ed8; }

  .sidenote-tipo {
    display: inline-block;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 0.5mm 1.5mm;
    border-radius: 1mm;
    margin-bottom: 1.2mm;
  }
  .sidenote-title {
    font-weight: 700;
    color: #0b2d5b;
    font-size: 9pt;
    margin: 0 0 1mm;
    line-height: 1.3;
  }
  .sidenote-body {
    color: #334155;
    margin: 0 0 1mm;
  }
  .sidenote-missing {
    margin: 1mm 0 0;
    padding-left: 3.5mm;
    color: #475569;
    font-size: 8pt;
  }
  .sidenote-ref {
    margin-top: 1.5mm;
    padding-top: 1mm;
    border-top: 1px dashed #e2e8f0;
    color: #64748b;
    font-size: 7.5pt;
    font-style: italic;
  }

  .orphans-section {
    page-break-before: always;
    padding: 0 10mm;
  }
  .orphans-section h2 {
    border-bottom: 2px solid #f0a500;
    padding-bottom: 2mm;
  }
  .orphan-card {
    margin: 4mm 0;
    padding: 3mm 4mm;
    border-left: 3px solid #0b2d5b;
    background: #f8fafc;
    border-radius: 1mm;
    font-family: 'Sora', 'Segoe UI', sans-serif;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  .orphan-card.oc-critical  { border-left-color: #b91c1c; }
  .orphan-card.oc-attention { border-left-color: #b45309; }
  .orphan-card.oc-implicit  { border-left-color: #0f766e; }
  .orphan-card.oc-info      { border-left-color: #1d4ed8; }
  .orphan-card .sidenote-title { font-size: 10pt; }

  img { max-width: 100%; height: auto; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-brand">SEEDF · UNIEB Recanto das Emas</div>
  <h1>Parecer Técnico sobre o<br/>Projeto Político-Pedagógico</h1>
  <div class="cover-subtitle">${schoolName}</div>

  <div class="cover-meta">
    <b>Escola:</b>         <span>${schoolName}</span>
    ${inep ? `<b>INEP:</b>          <span>${escapeHtml(inep)}</span>` : ''}
    ${cre  ? `<b>CRE:</b>           <span>${escapeHtml(cre)}</span>`  : ''}
    <b>Ano letivo:</b>     <span>${year}</span>
    <b>Emitido em:</b>     <span>${genDate}</span>
    <b>Fundamentação:</b>  <span>Portaria nº 139/2024 · Portaria nº 174/2026</span>
  </div>

  <div class="cover-summary">
    <h3>Síntese das observações</h3>
    <div class="cover-counts">
      <span class="cc cc-tot">${counts.total} observações</span>
      <span class="cc cc-nao">${counts.nao_conformidade} não conformidades</span>
      <span class="cc cc-aju">${counts.ajuste} ajustes</span>
      <span class="cc cc-obs">${counts.observacao} observações</span>
    </div>
    <div class="cover-legend">
      As observações aparecem nas margens laterais do documento, ao lado do trecho
      ao qual se referem. Marcadores numerados no corpo do texto
      (ex.: <span class="obs-marker mk-critical">1</span>) indicam a localização de cada observação.
    </div>
  </div>

  <div class="cover-footer">
    Documento gerado automaticamente pela plataforma UNIEB Recanto das Emas · SEEDF
  </div>
</section>

${bodyWithMarkers}

${orphans.length > 0 ? renderOrphansSection(orphans) : ''}

</body>
</html>`
}

function injectMarkers(bodyHtml, obsByAnchor) {
  return bodyHtml.replace(
    /<(p|h[1-6]|li)([^>]*?)data-anchor="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag, before, anchorId, after, inner) => {
      const obs = obsByAnchor[anchorId]
      if (!obs) return full

      const markers = obs.map(o => {
        const cls = mkClass(o.tipo)
        return `<span class="obs-marker ${cls}">${o._num}</span>`
      }).join('')

      const sidenotes = obs.map(o => renderSidenote(o)).join('')

      return `<${tag}${before}data-anchor="${anchorId}"${after}>${inner}${markers}${sidenotes}</${tag}>`
    }
  )
}

function renderSidenote(o) {
  const cfg = TIPO_CONFIG[o.tipo] || TIPO_CONFIG.info
  const cls = snClass(o.tipo)

  const tipoBadge = `<span class="sidenote-tipo" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>`

  const title = o.label
    ? `<div class="sidenote-title">${escapeHtml(o.label)}</div>`
    : ''

  const body = o.texto
    ? `<p class="sidenote-body">${escapeHtml(o.texto)}</p>`
    : ''

  const missing = (o.missingItems?.length > 0)
    ? `<ul class="sidenote-missing">${o.missingItems.slice(0, 4).map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
    : ''

  const missingRefs = (o.missingRefs?.length > 0)
    ? `<p class="sidenote-body" style="color:#b91c1c;font-size:8pt;margin-top:1mm">Ausente: ${escapeHtml(o.missingRefs.join(', '))}</p>`
    : ''

  const ref = o.normRef
    ? `<div class="sidenote-ref">${escapeHtml(o.normRef)}</div>`
    : ''

  return `<aside class="sidenote ${cls}">
    <span class="sidenote-num">${o._num}</span>
    ${tipoBadge}
    ${title}
    ${body}
    ${missing}
    ${missingRefs}
    ${ref}
  </aside>`
}

function renderOrphansSection(orphans) {
  const cards = orphans.map(o => {
    const cfg = TIPO_CONFIG[o.tipo] || TIPO_CONFIG.info
    const cls = ocClass(o.tipo)

    return `<div class="orphan-card ${cls}">
      <span class="sidenote-num">${o._num}</span>
      <span class="sidenote-tipo" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>
      ${o.label ? `<div class="sidenote-title">${escapeHtml(o.label)}</div>` : ''}
      ${o.section ? `<p class="sidenote-body" style="color:#64748b;font-size:8pt">📌 ${escapeHtml(o.section)}</p>` : ''}
      ${o.texto ? `<p class="sidenote-body">${escapeHtml(o.texto)}</p>` : ''}
      ${o.missingItems?.length > 0 ? `<ul class="sidenote-missing">${o.missingItems.slice(0,6).map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>` : ''}
      ${o.missingRefs?.length > 0 ? `<p class="sidenote-body" style="color:#b91c1c;font-size:8pt">Ausente: ${escapeHtml(o.missingRefs.join(', '))}</p>` : ''}
      ${o.normRef ? `<div class="sidenote-ref">${escapeHtml(o.normRef)}</div>` : ''}
    </div>`
  }).join('')

  return `<section class="orphans-section">
    <h2>Observações sem trecho ancorado</h2>
    <p style="color:#64748b;font-size:9.5pt;font-style:italic">
      Estas observações referem-se a elementos ausentes ou não localizados no documento original.
    </p>
    ${cards}
  </section>`
}

function mkClass(tipo) {
  if (tipo === 'nao_conformidade') return 'mk-critical'
  if (tipo === 'ajuste')           return 'mk-attention'
  if (tipo === 'observacao')       return 'mk-implicit'
  return 'mk-info'
}
function snClass(tipo) {
  if (tipo === 'nao_conformidade') return 'sn-critical'
  if (tipo === 'ajuste')           return 'sn-attention'
  if (tipo === 'observacao')       return 'sn-implicit'
  return 'sn-info'
}
function ocClass(tipo) {
  if (tipo === 'nao_conformidade') return 'oc-critical'
  if (tipo === 'ajuste')           return 'oc-attention'
  if (tipo === 'observacao')       return 'oc-implicit'
  return 'oc-info'
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
