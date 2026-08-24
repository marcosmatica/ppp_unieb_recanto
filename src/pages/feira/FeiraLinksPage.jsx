import { useState, useEffect } from 'react'
import { feiraEdicoesService, feiraLinksService } from '../../services/feiraService'
import toast from 'react-hot-toast'

export default function FeiraLinksPage() {
  const [edicao, setEdicao] = useState(null)
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      if (!ed) { setLoading(false); return }
      setEdicao(ed)
      const l = await feiraLinksService.listarPorEdicao(ed.id)
      setLinks(l)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function gerarLinks() {
    if (!edicao) return
    setGerando(true)
    try {
      await feiraLinksService.gerarLinks(edicao.id)
      toast.success('Links gerados!')
      await carregar()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao gerar links')
    } finally {
      setGerando(false)
    }
  }

  function copiarLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/feira/${token}`)
    toast.success('Link copiado!')
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>
  if (!edicao) return <div style={{ padding: 32 }}>Nenhuma edição ativa. Crie uma em Configurações.</div>

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Links por Escola</h1>
        <button onClick={gerarLinks} disabled={gerando} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {gerando ? 'Gerando...' : 'Gerar links para todas as escolas'}
        </button>
      </div>

      {links.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhum link gerado ainda.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>Escola</th>
              <th style={thStyle}>INEP</th>
              <th style={thStyle}>Projetos</th>
              <th style={thStyle}>Link</th>
            </tr>
          </thead>
          <tbody>
            {links.map(l => (
              <tr key={l.token} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{l.escola_nome}</td>
                <td style={tdStyle}>{l.escola_inep}</td>
                <td style={tdStyle}>{l.projetos_count || 0}</td>
                <td style={tdStyle}>
                  <button onClick={() => copiarLink(l.token)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12 }}>
                    Copiar link
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 }
const tdStyle = { padding: '8px 12px' }
