// src/components/parecer/ParecerToolbar.jsx

import { useMemo } from 'react'
import { AlertCircle, AlertTriangle, Info, Filter, Download, RefreshCw, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const TIPOS = [
  { key: 'nao_conformidade', label: 'Não conformidade', icon: AlertCircle,    color: 'critical'  },
  { key: 'ajuste',           label: 'Ajuste',           icon: AlertTriangle, color: 'attention' },
  { key: 'observacao',       label: 'Observação',       icon: Info,           color: 'implicit'  },
]

export default function ParecerToolbar({
  analysis,
  observations,
  filters,
  setFilters,
  onRegenerate,
  regenerating,
}) {
  const counts = useMemo(() => {
    const c = { nao_conformidade: 0, ajuste: 0, observacao: 0, total: observations.length }
    for (const o of observations) if (c[o.tipo] != null) c[o.tipo]++
    return c
  }, [observations])

  const blocks = useMemo(() => {
    const s = new Set()
    for (const o of observations) if (o.blockCode) s.add(o.blockCode)
    return [...s].sort()
  }, [observations])

  function toggleTipo(key) {
    setFilters(f => ({
      ...f,
      tipos: f.tipos.includes(key) ? f.tipos.filter(t => t !== key) : [...f.tipos, key],
    }))
  }

  return (
    <div className="parecer-toolbar">
      <div className="pt-left">
        <Link to={`/analyses/${analysis?.id || ''}`} className="pt-back">
          <ArrowLeft size={14} /> Análise
        </Link>
        <div className="pt-title">
          <h1>{analysis?.schoolName || '—'}</h1>
          <span>PPP {analysis?.year} · Parecer em rascunho</span>
        </div>
      </div>

      <div className="pt-filters">
        {TIPOS.map(t => {
          const Icon = t.icon
          const active = filters.tipos.includes(t.key)
          return (
            <button
              key={t.key}
              className={`pt-chip pt-chip-${t.color}${active ? ' is-active' : ''}`}
              onClick={() => toggleTipo(t.key)}
              title={active ? 'Ocultar' : 'Mostrar'}
            >
              <Icon size={13} />
              <span>{t.label}</span>
              <b>{counts[t.key]}</b>
            </button>
          )
        })}

        <select
          className="pt-select"
          value={filters.blockCode || ''}
          onChange={e => setFilters(f => ({ ...f, blockCode: e.target.value || null }))}
        >
          <option value="">Todos os blocos</option>
          {blocks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="pt-right">
        <button className="btn-ghost" onClick={onRegenerate} disabled={regenerating}>
          <RefreshCw size={13} className={regenerating ? 'is-spinning' : ''} />
          {regenerating ? 'Gerando…' : 'Regenerar'}
        </button>
        <button className="btn-primary" disabled>
          <Download size={13} /> Exportar PDF
        </button>
      </div>
    </div>
  )
}
