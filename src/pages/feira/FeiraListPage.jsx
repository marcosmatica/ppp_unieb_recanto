import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { feiraEdicoesService, feiraInscricoesService } from '../../services/feiraService'
import StatusBadge from '../../components/feira/StatusBadge'
import { CATEGORIAS } from '../../constants/feiraConstants'
import toast from 'react-hot-toast'

export default function FeiraListPage() {
  const navigate = useNavigate()
  const [inscricoes, setInscricoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      if (!ed) { setLoading(false); return }
      const lista = await feiraInscricoesService.listarPorEdicao(ed.id)
      setInscricoes(lista)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtradas = inscricoes.filter(i => {
    if (filtroStatus && i.status !== filtroStatus) return false
    if (filtroCategoria && i.categoria !== filtroCategoria) return false
    return true
  })

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>

  return (
    <div style={{ padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Inscrições da Feira</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
          <option value="">Todos os status</option>
          {['enviada','em_analise','devolvida','reenviada','em_reanalise','aprovada','indeferida','avaliada'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhuma inscrição encontrada.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>Título</th>
              <th style={thStyle}>Escola</th>
              <th style={thStyle}>Cat.</th>
              <th style={thStyle}>Orientador</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Link público</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(i => (
              <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                <td style={tdStyle} onClick={() => navigate(`/feira/inscricao/${i.id}`)}>{i.titulo}</td>
                <td style={tdStyle} onClick={() => navigate(`/feira/inscricao/${i.id}`)}>{i.escola?.nome}</td>
                <td style={tdStyle} onClick={() => navigate(`/feira/inscricao/${i.id}`)}>{i.categoria}</td>
                <td style={tdStyle} onClick={() => navigate(`/feira/inscricao/${i.id}`)}>{i.orientador?.nome}</td>
                <td style={tdStyle} onClick={() => navigate(`/feira/inscricao/${i.id}`)}><StatusBadge status={i.status} /></td>
                <td style={tdStyle}>
                  {i.link_escola_token && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/feira/${i.link_escola_token}`); toast.success('Link copiado!') }}
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 4, color: '#2563eb', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
                    >
                      Copiar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const selectStyle = { padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }
const thStyle = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 }
const tdStyle = { padding: '8px 12px' }
