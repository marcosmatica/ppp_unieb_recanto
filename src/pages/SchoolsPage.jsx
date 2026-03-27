// src/pages/SchoolsPage.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { schoolsService } from '../services/firebase'
import toast from 'react-hot-toast'
import { Plus, School, ChevronDown, ChevronUp, Save, X } from 'lucide-react'
import './SchoolsPage.css'
import { REGIONALS } from '../constants/regionals'

const STAGES_CONFIG = [
  { key: 'educacaoInfantil',       label: 'Educação Infantil' },
  { key: 'ensFundamental1',        label: 'Ens. Fundamental — Anos Iniciais' },
  { key: 'ensFundamental2',        label: 'Ens. Fundamental — Anos Finais' },
  { key: 'ensMedio',               label: 'Ensino Médio',           note: 'ativa Bloco 4' },
  { key: 'ensMedioTempoIntegral',  label: 'Ens. Médio — Tempo Integral', note: 'ativa IFI' },
  { key: 'eja',                    label: 'EJA' },
  { key: 'educacaoEspecial',       label: 'Educação Especial' },
  { key: 'socioeducacao',          label: 'Socioeducação',          note: 'ativa elemento Art. 4º, XI' },
]

const EMPTY_FORM = {
  name: '', inep: '', cre: '', address: '',
  stages: Object.fromEntries(STAGES_CONFIG.map(s => [s.key, false])),
  ensMedioConfig: { tempoIntegral: false, itinerarios: [] },
}

export default function SchoolsPage() {
  const { profile } = useAuth()
  const [schools,     setSchools]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editingId,   setEditingId]   = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [expandedId,  setExpandedId]  = useState(null)

  useEffect(() => {
    if (!profile?.cre) return
    const fetch = async () => {
      const data = await schoolsService.getByCRE(profile.cre)
      setSchools(data)
      setLoading(false)
    }
    fetch()
  }, [profile])

  function openNew() {
    setForm({ ...EMPTY_FORM, cre: profile?.cre || '', stages: Object.fromEntries(STAGES_CONFIG.map(s=>[s.key,false])) })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(school) {
    setForm({
      name:    school.name,
      inep:    school.inep,
      cre:     school.cre,
      address: school.address || '',
      stages:  { ...Object.fromEntries(STAGES_CONFIG.map(s=>[s.key,false])), ...school.stages },
      ensMedioConfig: school.ensMedioConfig || { tempoIntegral: false, itinerarios: [] },
    })
    setEditingId(school.id)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditingId(null) }

  function setStage(key, val) {
    setForm(f => ({ ...f, stages: { ...f.stages, [key]: val } }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.inep.trim()) return toast.error('Nome e INEP são obrigatórios')
    setSaving(true)
    try {
      await schoolsService.create({ ...form, inep: form.inep.trim() })
      toast.success(editingId ? 'Escola atualizada' : 'Escola cadastrada')
      const data = await schoolsService.getByCRE(profile.cre)
      setSchools(data)
      closeForm()
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const activeStages = (school) =>
    STAGES_CONFIG.filter(s => school.stages?.[s.key]).map(s => s.label)

  if (loading) return <div className="page-loader"><div className="spinner"/></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Escolas</h1>
          <p className="page-sub">{schools.length} unidade{schools.length!==1?'s':''} cadastrada{schools.length!==1?'s':''} · {profile?.cre}</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16}/> Cadastrar escola
        </button>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="school-form-card animate-fade-in">
          <div className="sfc-header">
            <h2 className="sfc-title">{editingId ? 'Editar escola' : 'Nova escola'}</h2>
            <button className="btn-ghost" onClick={closeForm}><X size={16}/></button>
          </div>

          <div className="sfc-grid">
            <div className="form-group">
              <label className="form-label">Nome da escola <span className="required">*</span></label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f=>({...f,name:e.target.value}))}
                placeholder="Ex: CEF 01 do Recanto das Emas"/>
            </div>
            <div className="form-group">
              <label className="form-label">Código INEP <span className="required">*</span></label>
              <input className="form-input" value={form.inep}
                onChange={e => setForm(f=>({...f,inep:e.target.value}))}
                placeholder="8 dígitos"/>
            </div>
            // No formulário, substitua o input de CRE por um select:
            <div className="form-group">
              <label className="form-label">CRE</label>
              <select
                  className="form-select"
                  value={form.cre}
                  onChange={e => setForm(f => ({...f, cre: e.target.value}))}
                  required
              >
                <option value="">Selecione uma CRE...</option>
                {REGIONALS.map(regional => (
                    <option key={regional.id} value={regional.code}>
                      {regional.name}
                    </option>
                ))}
              </select>
            </div>
            {/*}
            <div className="form-group">
              <label className="form-label">Endereço</label>
              <input className="form-input" value={form.address}
                onChange={e => setForm(f=>({...f,address:e.target.value}))}
                placeholder="Endereço completo"/>
            </div> */}
          </div>

          {/* Stages */}
          <div className="form-group" style={{marginTop:4}}>
            <label className="form-label">
              Modalidades e etapas ofertadas
              <span className="form-label-hint"> — determina quais elementos do checklist se aplicam</span>
            </label>
            <div className="stages-grid">
              {STAGES_CONFIG.map(s => (
                <label key={s.key} className={`stage-toggle ${form.stages[s.key] ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.stages[s.key]}
                    onChange={e => setStage(s.key, e.target.checked)}
                  />
                  <span className="stage-label">{s.label}</span>
                  {s.note && <span className="stage-note">{s.note}</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="sfc-actions">
            <button className="btn-secondary" onClick={closeForm} disabled={saving}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><div className="spinner-sm"/> Salvando…</> : <><Save size={15}/> Salvar escola</>}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="schools-list">
        {schools.length === 0 && (
          <div className="empty-state">
            <School size={32} className="empty-icon"/>
            <p>Nenhuma escola cadastrada ainda.</p>
            <button className="btn-primary small" onClick={openNew}>
              <Plus size={14}/> Cadastrar primeira escola
            </button>
          </div>
        )}

        {schools.map(school => {
          const stages   = activeStages(school)
          const expanded = expandedId === school.id
          return (
            <div key={school.id} className="school-card animate-fade-in">
              <div className="school-card-main" onClick={() => setExpandedId(expanded ? null : school.id)}>
                <div className="school-card-info">
                  <p className="school-card-name">{school.name}</p>
                  <p className="school-card-meta">INEP {school.inep} · {school.cre}</p>
                </div>
                <div className="school-card-stages">
                  {stages.slice(0,3).map(s => (
                    <span key={s} className="stage-badge">{s}</span>
                  ))}
                  {stages.length > 3 && (
                    <span className="stage-badge more">+{stages.length-3}</span>
                  )}
                </div>
                <div className="school-card-actions">
                  <button className="btn-ghost small" onClick={e => { e.stopPropagation(); openEdit(school) }}>
                    Editar
                  </button>
                  {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </div>
              </div>

              {expanded && (
                <div className="school-card-detail animate-fade-in">
                  {school.address && <p className="detail-address">{school.address}</p>}
                  <p className="detail-label">Modalidades/etapas:</p>
                  <div className="detail-stages">
                    {stages.length > 0
                      ? stages.map(s => <span key={s} className="stage-badge full">{s}</span>)
                      : <span style={{fontSize:12,color:'var(--gray-400)'}}>Nenhuma configurada</span>
                    }
                  </div>
                  <p className="detail-hint">
                    Elementos aplicáveis no checklist: {
                      STAGES_CONFIG.filter(s => school.stages?.[s.key] && s.note).map(s=>s.note).join(' · ') || 'configuração padrão'
                    }
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
