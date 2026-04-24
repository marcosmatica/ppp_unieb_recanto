// functions/src/parecer/anchorMatcher.js

'use strict'

function findAnchorForExcerpt(excerptText, paragraphs) {
  if (!excerptText || !paragraphs?.length) return null

  const needle = normalize(excerptText)
  if (needle.length < 8) return null

  const needleShort = needle.slice(0, 80)

  for (const p of paragraphs) {
    const hay = normalize(p.text)
    if (hay.includes(needleShort)) return p.id
  }

  const needleStart = firstWords(needle, 6)
  const needleEnd   = lastWords(needle, 6)

  for (const p of paragraphs) {
    const hay = normalize(p.text)
    if (hay.includes(needleStart) || hay.includes(needleEnd)) return p.id
  }

  const needleTokens = new Set(tokenize(needle).filter(t => t.length > 3))
  if (needleTokens.size === 0) return null

  let best = null
  let bestScore = 0

  for (const p of paragraphs) {
    const pTokens = new Set(tokenize(normalize(p.text)).filter(t => t.length > 3))
    if (pTokens.size === 0) continue

    let shared = 0
    for (const t of needleTokens) if (pTokens.has(t)) shared++
    const score = shared / Math.max(needleTokens.size, pTokens.size)

    if (score > bestScore) { bestScore = score; best = p.id }
  }

  return bestScore >= 0.35 ? best : null
}

function findAnchorForSection(sectionName, paragraphs) {
  if (!sectionName) return null
  const target = normalize(sectionName)

  for (const p of paragraphs) {
    if (p.tag.startsWith('h') && normalize(p.text).includes(target)) return p.id
  }
  return null
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(str) {
  return str.split(/\s+/).filter(Boolean)
}

function firstWords(str, n) {
  return tokenize(str).slice(0, n).join(' ')
}

function lastWords(str, n) {
  const t = tokenize(str)
  return t.slice(Math.max(0, t.length - n)).join(' ')
}

module.exports = { findAnchorForExcerpt, findAnchorForSection }
