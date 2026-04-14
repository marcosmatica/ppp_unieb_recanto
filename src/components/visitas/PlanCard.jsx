// src/components/visitas/PlanCard.jsx

import { DESCRIPTOR_LABELS } from '../../services/indicadoresEI'
import './PlanCard.css'

const STATUS_NEXT = {
  pending:     'in_progress',
  in_progress: 'done',
  done:        null,
}
const STATUS_NEXT_LABEL = {
  pending:     'Iniciar',
  in_progress: 'Concluir',
  done:        null,
}
const STATUS_LABELS = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
  done:        'Concluído',
}

export default function PlanCard({ plan, onStatusChange, onEdit }) {
  const prazo      = plan.deadline ? new Date(plan.deadline + 'T00:00') : null
  const hoje       = new Date(); hoje.setHours(0, 0, 0, 0)
  const atrasado   = prazo && prazo < hoje && plan.status !== 'done'
  const prazoLabel = prazo?.toLocaleDateString('pt-BR') ?? '—'

  const nextStatus = STATUS_NEXT[plan.status]

  return (
    <div className={`pc-root status-${plan.status} ${atrasado ? 'late' : ''}`}>
      <div className="pc-top">
        <div className="pc-codes">
          <span className="pc-indicator">{plan.indicatorCode}</span>
          {plan.descriptorLevel && (
            <span className={`pc-level level-${plan.descriptorLevel}`}>
              N{plan.descriptorLevel} — {DESCRIPTOR_LABELS[plan.descriptorLevel]}
            </span>
          )}
        </div>
        <button className="pc-edit" onClick={onEdit} aria-label="Editar">✎</button>
      </div>

      <p className="pc-indicator-label">{plan.indicatorLabel}</p>

      <p className="pc-goal">{plan.goal}</p>

      <div className="pc-meta">
        <span className={`pc-deadline ${atrasado ? 'late' : ''}`}>
          {atrasado ? '⚠ ' : ''}Prazo: {prazoLabel}
        </span>
        <span className="pc-resp">{plan.responsibleSchool}</span>
      </div>

      {plan.observation && (
        <p className="pc-obs">{plan.observation}</p>
      )}

      <div className="pc-footer">
        <span className={`pc-status-badge status-${plan.status}`}>
          {STATUS_LABELS[plan.status]}
        </span>
        {nextStatus && (
          <button
            className={`pc-next-btn next-${nextStatus}`}
            onClick={() => onStatusChange(nextStatus)}
          >
            {STATUS_NEXT_LABEL[plan.status]}
          </button>
        )}
      </div>
    </div>
  )
}
