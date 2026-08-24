import { CATEGORIAS } from '../../constants/feiraConstants'

export default function CategoriaSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid var(--border, #d1d5db)',
        fontSize: 14,
        background: 'var(--bg, #fff)',
        color: 'inherit',
      }}
    >
      <option value="">Selecione a categoria</option>
      {CATEGORIAS.map(c => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  )
}
