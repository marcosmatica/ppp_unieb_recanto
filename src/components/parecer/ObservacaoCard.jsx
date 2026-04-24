// src/components/parecer/ObservacaoCard.jsx

import {
  AlertCircle, AlertTriangle, Info, CheckCircle2, BookOpen,
  Check, X, Pencil, Trash2, RotateCcw, Sparkles, User as UserIcon,
} from 'lucide-react'

const TIPO_CONFIG = {
  nao_conformidade: { label: 'Não conformidade', icon: AlertCircle,    color: 'critical'  },
  ajuste:           { label: 'Ajuste necessário', icon: AlertTriangle, color: 'attention' },
  observacao:       { label: 'Observação',        icon: Info,          color: 'implicit'  },
  conformidade:     { label: 'Conforme',          icon: CheckCircle2,  color: 'adequate'  },
  info:             { label: 'Informação',        icon: Info,          color: 'info'      },
}

const STATUS_BADGE = {
  auto:      { label: 'IA', icon: Sparkles, cls: 'status-auto' },
  confirmed: { label: 'Confirmada', icon: Check, cls: 'status-confirmed' },
  manual:    { label: 'Manual', icon: UserIcon, cls: 'status-manual' },
  rejected:  { label: 'Rejeitada', icon: X, cls: 'status-rejected' },
}

export default function ObservacaoCard({
  observation,
  position,
  isActive,
  readOnly,
  onHover, onLeave, onClick,
  onEdit, onAccept, onReject, onRestore, onDelete,
}) {
  const cfg      = TIPO_CONFIG[observation.tipo] || TIPO_CONFIG.info
  const Icon     = cfg.icon
  const statusCfg = STATUS_BADGE[observation.status] || STATUS_BADGE.auto
  const StatusIcon = statusCfg.icon
  const rejected = observation.status === 'rejected'

  const style = position
    ? { position: 'absolute', top: `${position.top}px`, left: 0, right: 0 }
    : { position: 'relative' }

  return (
    <article
      className={[
        'obs-card',
        `obs-${cfg.color}`,
        isActive ? 'is-active' : '',
        !position?.hasAnchor ? 'no-anchor' : '',
        rejected ? 'is-rejected' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <header className="obs-card-header" onClick={onClick}>
        <span className={`obs-badge obs-badge-${cfg.color}`}>
          <Icon size={12} /> {cfg.label}
        </span>
        <span className={`obs-status-pill ${statusCfg.cls}`} title={statusCfg.label}>
          <StatusIcon size={10} /> {statusCfg.label}
        </span>
        {observation.isNewIn2026 && <span className="obs-tag obs-tag-new">NOVO 2026</span>}
        {observation.isCritical && <span className="obs-tag obs-tag-crit">Crítico</span>}
      </header>

      <h4 className="obs-card-title" onClick={onClick}>{observation.label}</h4>

      {observation.section && (
        <p className="obs-card-section">📌 {observation.section}</p>
      )}

      {observation.texto && (
        <p className="obs-card-text">{observation.texto}</p>
      )}

      {observation.missingItems?.length > 0 && (
        <ul className="obs-card-missing">
          {observation.missingItems.slice(0, 4).map((m, i) => <li key={i}>{m}</li>)}
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

      {!readOnly && (
        <div className="obs-card-actions">
          {rejected ? (
            <>
              <button className="obs-action" onClick={onRestore} title="Restaurar">
                <RotateCcw size={13} /> Restaurar
              </button>
              {observation.status === 'rejected' && (
                <button className="obs-action obs-action-danger" onClick={onDelete} title="Excluir definitivamente">
                  <Trash2 size={13} /> Excluir
                </button>
              )}
            </>
          ) : (
            <>
              {observation.status === 'auto' && (
                <button className="obs-action obs-action-primary" onClick={onAccept} title="Aceitar como está">
                  <Check size={13} /> Aceitar
                </button>
              )}
              <button className="obs-action" onClick={onEdit} title="Editar texto">
                <Pencil size={13} /> Editar
              </button>
              <button className="obs-action obs-action-danger" onClick={onReject} title="Rejeitar">
                <X size={13} /> Rejeitar
              </button>
            </>
          )}
        </div>
      )}
    </article>
  )
}
