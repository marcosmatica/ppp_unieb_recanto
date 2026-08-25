import { useNavigate } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { CATEGORIAS } from '../../constants/feiraConstants'

export default function ProjetoCard({ projeto, tokenEscola }) {
  const navigate = useNavigate()
  const cat = CATEGORIAS.find(c => c.value === projeto.categoria)

  const isEnviado = projeto.status !== 'rascunho'
  const rota = isEnviado
    ? `/inscricao/${tokenEscola}/projeto/${projeto.id}/status`
    : `/inscricao/${tokenEscola}/projeto/${projeto.id}`

  return (
    <div
      onClick={() => navigate(rota)}
      style={{
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>{projeto.titulo || 'Sem título'}</strong>
        <StatusBadge status={projeto.status} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
        {cat ? cat.label : `Categoria ${projeto.categoria || '—'}`}
        {projeto.orientador?.nome && ` · ${projeto.orientador.nome}`}
      </div>
    </div>
  )
}
