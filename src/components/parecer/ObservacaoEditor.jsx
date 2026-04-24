// src/components/parecer/ObservacaoEditor.jsx

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'

const TIPOS = [
  { value: 'nao_conformidade', label: 'Não conformidade', severidade: 3 },
  { value: 'ajuste',           label: 'Ajuste necessário', severidade: 2 },
  { value: 'observacao',       label: 'Observação',        severidade: 1 },
  { value: 'conformidade',     label: 'Conforme',          severidade: 0 },
  { value: 'info',             label: 'Informação',        severidade: 0 },
]

export default function ObservacaoEditor({ observation, onSave, onClose, saving }) {
  const isNew = !observation.id

  const [tipo,  setTipo]  = useState(observation.tipo  || 'observacao')
  const [label, setLabel] = useState(observation.label || 'Observação manual')
  const [texto, setTexto] = useState(observation.texto || '')
  const [section, setSection] = useState(observation.section || '')
  const [normRef, setNormRef] = useState(observation.normRef || '')

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSave() {
    const cfg = TIPOS.find(t => t.value === tipo)
    onSave({
      tipo,
      severidade: cfg?.severidade ?? 1,
      label:      label.trim() || 'Observação',
      texto:      texto.trim(),
      section:    section.trim() || null,
      normRef:    normRef.trim() || null,
      status:     isNew ? 'manual' : (observation.status === 'auto' ? 'confirmed' : observation.status),
    })
  }

  return (
    <div className="obs-editor-overlay" onClick={onClose}>
      <div className="obs-editor" onClick={e => e.stopPropagation()}>
        <header className="obs-editor-header">
          <h3>{isNew ? 'Nova observação' : 'Editar observação'}</h3>
          <button className="obs-editor-close" onClick={onClose}><X size={16} /></button>
        </header>

        <div className="obs-editor-body">
          {observation.trechoReferencia && (
            <div className="obs-editor-field">
              <label>Trecho ancorado</label>
              <blockquote className="obs-editor-quote">
                "{observation.trechoReferencia}"
              </blockquote>
            </div>
          )}

          <div className="obs-editor-field">
            <label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="obs-editor-field">
            <label>Título</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex.: PDE/PPA ausentes nas referências"
              maxLength={120}
            />
          </div>

          <div className="obs-editor-field">
            <label>Observação</label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Descreva a adequação solicitada, apontando o que precisa ser alterado no PPP…"
              rows={5}
              autoFocus
            />
          </div>

          <div className="obs-editor-row">
            <div className="obs-editor-field">
              <label>Seção (opcional)</label>
              <input
                type="text"
                value={section}
                onChange={e => setSection(e.target.value)}
                placeholder="Ex.: Referências"
              />
            </div>
            <div className="obs-editor-field">
              <label>Fundamentação (opcional)</label>
              <input
                type="text"
                value={normRef}
                onChange={e => setNormRef(e.target.value)}
                placeholder="Ex.: Art. 9º, III, a — Portaria 139/2024"
              />
            </div>
          </div>
        </div>

        <footer className="obs-editor-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !texto.trim()}>
            <Save size={13} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
