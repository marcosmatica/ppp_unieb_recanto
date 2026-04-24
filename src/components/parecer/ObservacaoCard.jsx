// src/components/parecer/ObservacaoCard.jsx

import { AlertCircle, AlertTriangle, Info, CheckCircle2, BookOpen } from 'lucide-react'

const TIPO_CONFIG = {
  nao_conformidade: { label: 'Não conformidade', icon: AlertCircle,    color: 'critical'  },
  ajuste:           { label: 'Ajuste necessário', icon: AlertTriangle, color: 'attention' },
  observacao:       { label: 'Observação',        icon: Info,          color: 'implicit'  },
  conformidade:     { label: 'Conforme',          icon: CheckCircle2,  color: 'adequate'  },
  info:             { label: 'Informação',        icon: Info,          color: 'info'      },
}

export default function ObservacaoCard({
  observation,
  position,
  isActive,
  onHover,
  onLeave,
  onClick,
}) {
  const cfg  = TIPO_CONFIG[observation.tipo] || TIPO_CONFIG.info
  const Icon = cfg.icon

  const style = position
    ? { position: 'absolute', top: `${position.top}px`, left: 0, right: 0 }
    : { position: 'relative' }

  return (
    <article
      className={`obs-card obs-${cfg.color}${isActive ? ' is-active' : ''}${!position?.hasAnchor ? ' no-anchor' : ''}`}
      style={style}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <header className="obs-card-header">
        <span className={`obs-badge obs-badge-${cfg.color}`}>
          <Icon size={12} /> {cfg.label}
        </span>
        {observation.isNewIn2026 && (
          <span className="obs-tag obs-tag-new">NOVO 2026</span>
        )}
        {observation.isCritical && (
          <span className="obs-tag obs-tag-crit">Crítico</span>
        )}
      </header>

      <h4 className="obs-card-title">{observation.label}</h4>

      {observation.section && (
        <p className="obs-card-section">📌 {observation.section}</p>
      )}

      {observation.texto && (
        <p className="obs-card-text">{observation.texto}</p>
      )}

      {observation.missingItems?.length > 0 && (
        <ul className="obs-card-missing">
          {observation.missingItems.slice(0, 4).map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}

      {observation.missingRefs?.length > 0 && (
        <p className="obs-card-refs">
          <AlertCircle size={11} /> Ausente: {observation.missingRefs.join(', ')}
        </p>
      )}

      {observation.humanReview && (
        <p className="obs-card-human">
          <em>Analista:</em> {observation.humanReview}
        </p>
      )}

      {observation.normRef && (
        <footer className="obs-card-footer">
          <BookOpen size={11} /> {observation.normRef}
        </footer>
      )}
    </article>
  )
}
