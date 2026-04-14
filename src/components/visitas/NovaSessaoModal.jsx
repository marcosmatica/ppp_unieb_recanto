// src/components/visitas/NovaSessaoModal.jsx

import { useState } from 'react'
import { METAS_EI } from '../../services/indicadoresEI'
import './VisitasModals.css'

export default function NovaSessaoModal({ metasJaVerificadas, onConfirm, onClose }) {
  const [selected, setSelected] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  function toggle(code) {
    setSelected(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (selected.length === 0) return
    setSaving(true)
    await onConfirm({ metasCodes: selected, date })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={e => e.stopPropagation()}>
        <h2>Nova sessão de verificação</h2>
        <p className="modal-hint">
          Selecione as metas que serão verificadas nesta visita presencial.
          Metas já verificadas em outras sessões aparecem marcadas.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Data da visita
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>

          <fieldset className="metas-fieldset">
            <legend>Metas a verificar</legend>
            <div className="metas-grid">
              {METAS_EI.map(meta => {
                const jaVerificada = metasJaVerificadas.has(meta.code)
                const marcada = selected.includes(meta.code)
                return (
                  <label
                    key={meta.code}
                    className={`meta-check ${marcada ? 'selected' : ''} ${jaVerificada ? 'already' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => toggle(meta.code)}
                    />
                    <span className="meta-check__code">{meta.code}</span>
                    <span className="meta-check__label">{meta.label}</span>
                    {jaVerificada && (
                      <span className="meta-check__tag">já verificada</span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || selected.length === 0}
            >
              {saving ? <span className="spinner-sm" /> : `Iniciar sessão (${selected.length} meta${selected.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
