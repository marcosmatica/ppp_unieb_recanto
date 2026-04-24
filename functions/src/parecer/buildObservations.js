// functions/src/parecer/buildObservations.js

'use strict'

const { findAnchorForExcerpt, findAnchorForSection } = require('./anchorMatcher')

const SEVERITY_BY_STATUS = {
  critical:          3,
  attention:         2,
  adequate_implicit: 1,
  adequate:          0,
  not_applicable:    0,
}

const TIPO_BY_STATUS = {
  critical:          'nao_conformidade',
  attention:         'ajuste',
  adequate_implicit: 'observacao',
  adequate:          'conformidade',
  not_applicable:    'info',
}

function buildObservations(elementResults, paragraphs) {
  const observations = []

  for (const el of elementResults) {
    const status = el.effectiveStatus || el.aiResult?.status
    if (status === 'adequate' || status === 'not_applicable') continue

    const excerpts = el.aiResult?.excerpts || []
    const missingItems = el.aiResult?.missingItems || []
    const missingRefs = el.aiResult?.legalRefs?.missing || []

    const baseObs = {
      elementId:   el.elementId,
      blockCode:   el.blockCode,
      blockLabel:  el.blockLabel,
      label:       el.label,
      normRef:     el.normRef || null,
      tipo:        TIPO_BY_STATUS[status] || 'info',
      severidade:  SEVERITY_BY_STATUS[status] || 1,
      status:      'auto',
      isCritical:  el.isCritical || false,
      isNewIn2026: el.isNewIn2026 || false,
    }

    if (excerpts.length === 0) {
      const sectionAnchor = tryFindSectionFromLabel(el.label, paragraphs)
      observations.push({
        ...baseObs,
        anchorId:         sectionAnchor,
        trechoReferencia: null,
        section:          null,
        texto:            el.aiResult?.summary || 'Elemento não localizado no documento.',
        missingItems,
        missingRefs,
        humanReview:      el.humanReview?.comment || null,
      })
      continue
    }

    excerpts.forEach((ex, idx) => {
      const anchorId = findAnchorForExcerpt(ex.text, paragraphs)
        || findAnchorForSection(ex.section, paragraphs)

      observations.push({
        ...baseObs,
        anchorId,
        trechoReferencia: ex.text,
        section:          ex.section || null,
        texto:            idx === 0 ? (el.aiResult?.summary || '') : '',
        missingItems:     idx === 0 ? missingItems : [],
        missingRefs:      idx === 0 ? missingRefs : [],
        humanReview:      idx === 0 ? (el.humanReview?.comment || null) : null,
      })
    })
  }

  return observations.sort((a, b) => {
    const aIdx = paragraphs.findIndex(p => p.id === a.anchorId)
    const bIdx = paragraphs.findIndex(p => p.id === b.anchorId)
    const aPos = aIdx === -1 ? 999999 : aIdx
    const bPos = bIdx === -1 ? 999999 : bIdx
    if (aPos !== bPos) return aPos - bPos
    return (b.severidade || 0) - (a.severidade || 0)
  })
}

function tryFindSectionFromLabel(label, paragraphs) {
  if (!label) return null
  const terms = label.toLowerCase().split(/[\s—–-]+/).filter(t => t.length > 4)
  for (const term of terms) {
    const hit = paragraphs.find(p =>
      p.tag.startsWith('h') && p.text.toLowerCase().includes(term)
    )
    if (hit) return hit.id
  }
  return null
}

module.exports = { buildObservations }
