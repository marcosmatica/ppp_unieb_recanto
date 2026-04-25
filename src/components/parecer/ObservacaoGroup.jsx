// src/components/parecer/ObservacaoGroup.jsx

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ObservacaoCard from './ObservacaoCard'

const TIPO_PRIORITY = { nao_conformidade: 0, ajuste: 1, observacao: 2, conformidade: 3, info: 4 }

const TIPO_COLOR = {
  nao_conformidade: 'critical',
  ajuste:           'attention',
  observacao:       'implicit',
  conformidade:     'adequate',
  info:             'info',
}

export default function ObservacaoGroup({
  label, items, positions, activeAnchor, readOnly,
  onHover, onLeave, onClick, onEdit, onAccept, onReject, onRestore, onDelete,
}) {
  const hasActive  = items.some(o => activeAnchor === o.anchorId)
  const hasPending = items.some(o => o.status === 'auto' || o.status === 'manual')

  const worstTipo = [...items].sort(
    (a, b) => (TIPO_PRIORITY[a.tipo] ?? 5) - (TIPO_PRIORITY[b.tipo] ?? 5)
  )[0].tipo

  const color = TIPO_COLOR[worstTipo] || 'info'

  const [open, setOpen] = useState(false)
  useEffect(() => { if (hasActive) setOpen(true) }, [hasActive])

  return (
    <div className={`obs-group obs-group--${color}${open ? ' is-open' : ''}`}>
      <button className="obs-group-header" onClick={() => setOpen(o => !o)}>
        <span className={`obs-group-dot obs-group-dot--${color}`} />
        <span className="obs-group-label">{label}</span>
        <span className="obs-group-count">{items.length}</span>
        {hasPending && <span className="obs-group-pending">{items.filter(o => o.status === 'auto').length} pendente(s)</span>}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="obs-group-items">
          {items.map(obs => (
            <ObservacaoCard
              key={obs.id}
              observation={obs}
              position={{ hasAnchor: positions[obs.id]?.hasAnchor }}
              isActive={activeAnchor === obs.anchorId}
              readOnly={readOnly}
              onHover={() => onHover(obs.anchorId)}
              onLeave={onLeave}
              onClick={() => onClick(obs.anchorId)}
              onEdit={() => onEdit(obs)}
              onAccept={() => onAccept(obs.id)}
              onReject={() => onReject(obs.id)}
              onRestore={() => onRestore(obs.id)}
              onDelete={() => onDelete(obs.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
