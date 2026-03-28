/**
 * src/components/ExcerptCards.jsx
 * Prop nova: onExcerptClick(index) — ao clicar no card, localiza o trecho no documento
 */

import { useState } from 'react'

const STATUS_COLORS = {
  adequate:          { bg: '#f0fdf4', border: '#16a34a', text: '#14532d', badge: '#dcfce7' },
  adequate_implicit: { bg: '#f0fdfa', border: '#0d9488', text: '#134e4a', badge: '#ccfbf1' },
  attention:         { bg: '#fefce8', border: '#ca8a04', text: '#713f12', badge: '#fef9c3' },
  critical:          { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d', badge: '#fee2e2' },
}

export default function ExcerptCards({ excerpts = [], keywords = [], status = 'attention', onExcerptClick }) {
  if (excerpts.length === 0) return null
  const colors = STATUS_COLORS[status] || STATUS_COLORS.attention

  return (
    <div className="excerpt-cards">
      {excerpts.map((ex, i) => (
        <ExcerptCard
          key={i}
          excerpt={ex}
          keywords={keywords}
          colors={colors}
          index={i}
          total={excerpts.length}
          onExcerptClick={onExcerptClick}
        />
      ))}
    </div>
  )
}

function ExcerptCard({ excerpt, keywords, colors, index, total, onExcerptClick }) {
  const [expanded, setExpanded] = useState(false)
  const [active,   setActive]   = useState(false)

  const text    = excerpt.text || ''
  const section = excerpt.section || null
  const isLong  = text.length > 220
  const displayText    = (!expanded && isLong) ? text.slice(0, 220) + '…' : text
  const isClickable    = !!onExcerptClick

  const handleClick = (e) => {
    if (e.target.closest('.ec-expand')) return
    if (!isClickable) return
    setActive(true)
    setTimeout(() => setActive(false), 800)
    onExcerptClick(index)
  }

  return (
    <div
      className={`excerpt-card${active ? ' excerpt-card--active' : ''}`}
      style={{
        borderLeftColor: colors.border,
        background: colors.bg,
        cursor: isClickable ? 'pointer' : 'default',
      }}
      onClick={handleClick}
      title={isClickable ? 'Clique para localizar no documento' : undefined}
    >
      <div className="ec-meta">
        {section && (
          <span className="ec-section" style={{ background: colors.badge, color: colors.text }}>
            {section}
          </span>
        )}
        <span className="ec-counter" style={{ color: colors.text, marginLeft: section ? undefined : 0 }}>
          {total > 1 ? `${index + 1}/${total}` : ''}
        </span>
        {isClickable && (
          <span className="ec-locate" style={{ color: colors.border }}>
            ↗ ver no doc
          </span>
        )}
      </div>

      <blockquote className="ec-text" style={{ color: colors.text }}>
        {highlightKeywords(displayText, keywords)}
      </blockquote>

      {isLong && (
        <button
          className="ec-expand"
          style={{ color: colors.border }}
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
        >
          {expanded ? 'Ver menos ↑' : 'Ver trecho completo ↓'}
        </button>
      )}
    </div>
  )
}

function highlightKeywords(text, keywords) {
  if (!keywords?.length) return text
  const escaped = keywords
    .filter(k => k && k.length > 2)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escaped.length) return text
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="kw-highlight">{part}</mark>
      : <span key={i}>{part}</span>
  )
}
