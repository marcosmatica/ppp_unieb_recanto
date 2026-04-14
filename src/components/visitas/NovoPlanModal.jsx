// src/components/visitas/NovoPlanModal.jsx

import { useState } from 'react'
import { METAS_EI, DESCRIPTOR_LABELS } from '../../services/indicadoresEI'
//import './NovoPlanModal.css'

const STATUS_LABELS = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
  done:        'Concluído',
}

export default function NovoPlanModal({
  visitId, schoolId, schoolName, cre,
  prefill, initialData, onSalvar, onClose,
}) {
  const base = prefill ?? initialData ?? {}

  const [indicatorCode,  setIndicatorCode]  = useState(base.indicatorCode  ?? '')
  const [indicatorLabel, setIndicatorLabel] = useState(base.indicatorLabel ?? '')
  const [metaCode,       setMetaCode]       = useState(base.metaCode       ?? '')
  const [descriptorLevel,setDescriptorLevel]= useState(base.descriptorLevel ?? '')
  const [goal,           setGoal]           = useState(base.goal           ?? '')
  const [deadline,       setDeadline]       = useState(base.deadline       ?? '')
  const [responsibleSchool, setRespSchool]  = useState(base.responsibleSchool ?? '')
  const [responsibleCI,  setRespCI]         = useState(base.responsibleCI  ?? '')
  const [observation,    setObservation]    = useState(base.observation    ?? '')
  const [status,         setStatus]         = useState(base.status         ?? 'pending')
  const [saving,         setSaving]         = useState(false)

  // Quando seleciona indicador, preenche label e meta automaticamente
  function handleIndicadorSelect(e) {
    const code = e.target.value
    setIndicatorCode(code)
    if (!code) { setIndicatorLabel(''); setMetaCode(''); return }
    for (const meta of METAS_EI) {
      const ind = meta.indicadores.find(i => i.code === code)
      if (ind) { setIndicatorLabel(ind.label); setMetaCode(meta.code); break }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await onSalvar({
      schoolId, schoolName, cre,
      indicatorCode, indicatorLabel, metaCode,
      descriptorLevel: Number(descriptorLevel) || null,
      goal, deadline, responsibleSchool, responsibleCI,
      observation, status,
    })
  }

  const isEdit = !!initialData && !prefill

  return (
    <div className="npm-overlay" onClick={onClose}>
      <div className="npm-sheet" onClick={e => e.stopPropagation()}>
        <div className="npm-handle" />

        <div className="npm-header">
          <h2>{isEdit ? 'Editar plano' : 'Novo plano de ação'}</h2>
          <button className="npm-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <form className="npm-form" onSubmit={handleSubmit}>

          <div className="npm-field">
            <label>Indicador</label>
            <select
              value={indicatorCode}
              onChange={handleIndicadorSelect}
              required
              disabled={!!prefill}
            >
              <option value="">Selecione…</option>
              {METAS_EI.map(meta => (
                <optgroup key={meta.code} label={`${meta.code} — ${meta.label}`}>
                  {meta.indicadores.map(ind => (
                    <option key={ind.code} value={ind.code}>
                      {ind.code} — {ind.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="npm-field">
            <label>Nível observado</label>
            <div className="npm-level-row">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`npm-level-btn level-${n} ${Number(descriptorLevel) === n ? 'sel' : ''}`}
                  onClick={() => setDescriptorLevel(n)}
                >
                  <span className="npm-level-btn__num">{n}</span>
                  <span className="npm-level-btn__lbl">{DESCRIPTOR_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="npm-field">
            <label htmlFor="npm-goal">Meta / ação a atingir</label>
            <textarea
              id="npm-goal"
              rows={3}
              required
              placeholder="Descreva o que deve ser alcançado…"
              value={goal}
              onChange={e => setGoal(e.target.value)}
            />
          </div>

          <div className="npm-field">
            <label htmlFor="npm-deadline">Prazo</label>
            <input
              id="npm-deadline"
              type="date"
              required
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>

          <div className="npm-field">
            <label htmlFor="npm-resp-school">Responsável na unidade</label>
            <input
              id="npm-resp-school"
              type="text"
              required
              placeholder="Nome ou cargo"
              value={responsibleSchool}
              onChange={e => setRespSchool(e.target.value)}
            />
          </div>

          <div className="npm-field">
            <label htmlFor="npm-resp-ci">Responsável no CI</label>
            <input
              id="npm-resp-ci"
              type="text"
              placeholder="Nome do coordenador intermediário"
              value={responsibleCI}
              onChange={e => setRespCI(e.target.value)}
            />
          </div>

          <div className="npm-field">
            <label htmlFor="npm-obs">Observações</label>
            <textarea
              id="npm-obs"
              rows={3}
              placeholder="Contexto, recursos necessários, riscos…"
              value={observation}
              onChange={e => setObservation(e.target.value)}
            />
          </div>

          {isEdit && (
            <div className="npm-field">
              <label>Status</label>
              <div className="npm-status-row">
                {['pending', 'in_progress', 'done'].map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`npm-status-btn status-${s} ${status === s ? 'sel' : ''}`}
                    onClick={() => setStatus(s)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="npm-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="spinner-sm" /> : isEdit ? 'Salvar' : 'Criar plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
