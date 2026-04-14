// src/components/visitas/NovaVisitaModal.jsx

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { schoolsService } from '../../services/schoolsService'
import './VisitasModals.css'

export default function NovaVisitaModal({ onConfirm, onClose }) {
  const { profile } = useAuth()
  const [escolas, setEscolas] = useState([])
  const [schoolId, setSchoolId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fn = profile?.role === 'admin'
      ? schoolsService.getAll()
      : schoolsService.getByCRE(profile.cre)
    fn.then(data => {
      const ei = data.filter(s => s.stages?.educacaoInfantil)
      setEscolas(ei)
      setLoading(false)
    })
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!schoolId) return
    setSaving(true)
    const escola = escolas.find(s => s.id === schoolId)
    await onConfirm({ schoolId: escola.id, schoolName: escola.name, cre: escola.cre })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>Nova visita</h2>

        {loading ? (
          <div className="spinner" />
        ) : escolas.length === 0 ? (
          <p className="empty-hint">
            Nenhuma unidade com Educação Infantil encontrada na sua CRE.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Unidade escolar
              <select value={schoolId} onChange={e => setSchoolId(e.target.value)} required>
                <option value="">Selecione…</option>
                {escolas.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving || !schoolId}>
                {saving ? <span className="spinner-sm" /> : 'Criar visita'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
