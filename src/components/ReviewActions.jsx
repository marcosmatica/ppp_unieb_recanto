// src/components/ReviewActions.jsx
//
// Painel de ações de revisão contextual.
// Os botões mudam dinamicamente de acordo com o status da IA,
// para que "discordar" sempre faça sentido semântico.
//
// Lógica:
//   critical  → confirmar crítico | marcar atenção | marcar adequado
//   attention → confirmar atenção | marcar crítico | marcar adequado
//   adequate / adequate_implicit → confirmar adequado | marcar atenção | marcar crítico
//   not_applicable → confirmar N/A | marcar adequado

import { useState } from 'react'
import {
  ThumbsUp, ThumbsDown, SkipForward, MessageSquare,
  AlertCircle, AlertTriangle, CheckCircle2, MinusCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import './ReviewActions.css'

// ─── Configuração contextual por status da IA ─────────────────────────────────

const OVERRIDE_OPTIONS = {
  critical: [
    {
      status:    'attention',
      label:     'Marcar como Atenção',
      sublabel:  'Presente, mas insuficiente',
      icon:      AlertTriangle,
      colorClass: 'override-attention',
    },
    {
      status:    'adequate',
      label:     'Marcar como Adequado',
      sublabel:  'Elemento satisfatório',
      icon:      CheckCircle2,
      colorClass: 'override-adequate',
    },
  ],
  attention: [
    {
      status:    'adequate',
      label:     'Marcar como Adequado',
      sublabel:  'Elemento satisfatório',
      icon:      CheckCircle2,
      colorClass: 'override-adequate',
    },
    {
      status:    'critical',
      label:     'Marcar como Crítico',
      sublabel:  'Ausente ou muito insuficiente',
      icon:      AlertCircle,
      colorClass: 'override-critical',
    },
  ],
  adequate: [
    {
      status:    'attention',
      label:     'Marcar como Atenção',
      sublabel:  'Presente, mas insuficiente',
      icon:      AlertTriangle,
      colorClass: 'override-attention',
    },
    {
      status:    'critical',
      label:     'Marcar como Crítico',
      sublabel:  'Ausente ou muito insuficiente',
      icon:      AlertCircle,
      colorClass: 'override-critical',
    },
  ],
  adequate_implicit: [
    {
      status:    'attention',
      label:     'Marcar como Atenção',
      sublabel:  'Contextual não é suficiente',
      icon:      AlertTriangle,
      colorClass: 'override-attention',
    },
    {
      status:    'critical',
      label:     'Marcar como Crítico',
      sublabel:  'Ausente ou muito insuficiente',
      icon:      AlertCircle,
      colorClass: 'override-critical',
    },
  ],
  not_applicable: [
    {
      status:    'adequate',
      label:     'Marcar como Adequado',
      sublabel:  'Aplica-se a esta escola',
      icon:      CheckCircle2,
      colorClass: 'override-adequate',
    },
  ],
}

const AI_STATUS_LABEL = {
  critical:          { label: 'Crítico',             color: 'critical' },
  attention:         { label: 'Atenção',              color: 'attention' },
  adequate:          { label: 'Adequado',             color: 'adequate' },
  adequate_implicit: { label: 'Adequado (implícito)', color: 'adequate' },
  not_applicable:    { label: 'N/A',                  color: 'gray' },
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReviewActions({
  aiStatus,           // string: status da IA
  submitting,         // boolean
  comment,
  setComment,
  showComment,
  setShowComment,
  onAgree,            // () => void
  onOverride,         // (overrideStatus: string) => void
  onSkip,             // () => void
}) {
  const [showOverrides, setShowOverrides] = useState(false)

  const overrideOptions = OVERRIDE_OPTIONS[aiStatus] || OVERRIDE_OPTIONS.adequate
  const aiLabel         = AI_STATUS_LABEL[aiStatus]  || AI_STATUS_LABEL.adequate

  const handleOverride = (status) => {
    setShowOverrides(false)
    onOverride(status)
  }

  return (
    <div className="review-actions">

      {/* ── Botão primário: confirmar análise da IA ────────────────── */}
      <button
        className={`ra-btn ra-btn--confirm ra-btn--${aiLabel.color}`}
        onClick={onAgree}
        disabled={submitting}
      >
        <ThumbsUp size={14} />
        <span>Confirmar: <strong>{aiLabel.label}</strong></span>
      </button>

      {/* ── Botão de discordância — abre opções contextuais ────────── */}
      <div className="ra-override-wrap">
        <button
          className="ra-btn ra-btn--override-trigger"
          onClick={() => setShowOverrides(v => !v)}
          disabled={submitting}
        >
          <ThumbsDown size={14} />
          <span>Discordar da IA</span>
          {showOverrides
            ? <ChevronUp size={13} className="ra-chevron" />
            : <ChevronDown size={13} className="ra-chevron" />
          }
        </button>

        {/* Opções de override expandidas */}
        {showOverrides && (
          <div className="ra-override-list">
            <p className="ra-override-hint">Qual o status correto para este elemento?</p>
            {overrideOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.status}
                  className={`ra-override-option ${opt.colorClass}`}
                  onClick={() => handleOverride(opt.status)}
                  disabled={submitting}
                >
                  <div className="ra-override-icon"><Icon size={15} /></div>
                  <div className="ra-override-text">
                    <span className="ra-override-label">{opt.label}</span>
                    <span className="ra-override-sub">{opt.sublabel}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Ações secundárias: comentário + pular ─────────────────── */}
      <div className="ra-secondary">
        {!showComment ? (
          <button
            className="ra-btn-ghost"
            onClick={() => setShowComment(true)}
            disabled={submitting}
          >
            <MessageSquare size={13} /> Adicionar observação
          </button>
        ) : (
          <div className="ra-comment-box">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Observação para o parecer (opcional)…"
              rows={3}
              autoFocus
            />
          </div>
        )}

        <button
          className="ra-btn-ghost ra-btn-skip"
          onClick={onSkip}
          disabled={submitting}
        >
          <SkipForward size={13} /> Pular
        </button>
      </div>
    </div>
  )
}
