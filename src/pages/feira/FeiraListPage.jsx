import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { feiraEdicoesService, feiraInscricoesService, feiraLinksService } from '../../services/feiraService'
import StatusBadge from '../../components/feira/StatusBadge'
import { CATEGORIAS } from '../../constants/feiraConstants'
import toast from 'react-hot-toast'

export default function FeiraListPage() {
  const navigate = useNavigate()
  const [edicao, setEdicao] = useState(null)
  const [inscricoes, setInscricoes] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [mostrarLinks, setMostrarLinks] = useState(false)
  const [sort, setSort] = useState({ col: 'titulo', dir: 'asc' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      setEdicao(ed)
      if (!ed) { setLoading(false); return }
      const [lista, linksEscolas] = await Promise.all([
        feiraInscricoesService.listarPorEdicao(ed.id),
        feiraLinksService.listarPorEdicao(ed.id),
      ])
      setInscricoes(lista)
      setLinks(linksEscolas)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function copiarLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/inscricao/${token}`)
    toast.success('Link copiado!')
  }

  function copiarLinkUnificado(e) {
    e?.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/inscricao`)
    toast.success('Link unificado copiado!')
  }

  const emailPorEscola = useMemo(() => {
    const m = new Map()
    for (const l of links) {
      if (l.escola_inep) m.set(String(l.escola_inep), l.ultimo_email_enviado || '')
      if (l.token) m.set(`t:${l.token}`, l.ultimo_email_enviado || '')
    }
    return m
  }, [links])

  const emailDaEscola = (i) =>
    emailPorEscola.get(`t:${i.link_escola_token}`) ||
    emailPorEscola.get(String(i.escola?.inep || '')) ||
    ''

  const filtradas = useMemo(() => {
    const arr = inscricoes.filter(i => {
      if (filtroStatus && i.status !== filtroStatus) return false
      if (filtroCategoria && i.categoria !== filtroCategoria) return false
      return true
    })
    const getVal = (i, col) => {
      if (col === 'escola') return i.escola?.nome || ''
      if (col === 'orientador') return i.orientador?.nome || ''
      if (col === 'email') return emailDaEscola(i)
      return i[col] || ''
    }
    arr.sort((a, b) => {
      const va = String(getVal(a, sort.col)).toLowerCase()
      const vb = String(getVal(b, sort.col)).toLowerCase()
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [inscricoes, filtroStatus, filtroCategoria, sort])

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>

  const cols = [
    { key: 'titulo', label: 'Título' },
    { key: 'escola', label: 'Escola' },
    { key: 'categoria', label: 'Cat.' },
    { key: 'orientador', label: 'Orientador' },
    { key: 'email', label: 'E-mail' },
    { key: 'status', label: 'Status' },
  ]

  return (
    <div style={{ padding: '28px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Inscrições da Feira</h1>
        <button
          onClick={() => navigate('/feira/config')}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          ⚙ Configurar edição
        </button>
      </div>

      {!edicao && (
        <div style={{ marginBottom: 20, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
          Nenhuma edição ativa. <span onClick={() => navigate('/feira/config')} style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}>Crie uma edição</span> para começar.
        </div>
      )}

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
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {cols.map(c => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}>
                    {c.label}
                    {sort.col === c.key && (
                      <span style={{ marginLeft: 4, color: '#2563eb' }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((i, idx) => (
                <tr
                  key={i.id}
                  onClick={() => navigate(`/feira/inscricao/${i.id}`)}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc'}
                >
                  <td style={tdStyle}>{i.titulo}</td>
                  <td style={tdStyle}>{i.escola?.nome}</td>
                  <td style={tdStyle}>{i.categoria}</td>
                  <td style={tdStyle}>{i.orientador?.nome}</td>
                  <td style={tdStyle}>{emailDaEscola(i) || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td style={tdStyle}><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edicao && (
        <div style={{ marginTop: 32, background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '14px 18px' }}>
          <div
            onClick={() => setMostrarLinks(v => !v)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12, flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e3a8a' }}>
              Links públicos de inscrição
              {links.length > 0 ? ` (${links.length} escola${links.length !== 1 ? 's' : ''})` : ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ fontSize: 11, color: '#374151', background: '#fff', padding: '3px 8px', borderRadius: 4, border: '1px solid #c7d2fe' }}>
                {`${window.location.origin}/inscricao`}
              </code>
              <button
                onClick={copiarLinkUnificado}
                style={{ background: '#2563eb', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '4px 10px', fontWeight: 600 }}
              >
                Copiar link unificado
              </button>
              <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                {mostrarLinks ? '▲ Ocultar' : '▼ Ver links'}
              </span>
            </div>
          </div>

          {mostrarLinks && (
            links.length === 0 ? (
              <p style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                Nenhum link gerado. <span onClick={() => navigate('/feira/links')} style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}>Gere os links</span> para as escolas.
              </p>
            ) : (
              <div style={{ marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #c7d2fe' }}>
                      <th style={{ ...thStyle, fontSize: 11, padding: '6px 10px' }}>Escola</th>
                      <th style={{ ...thStyle, fontSize: 11, padding: '6px 10px' }}>INEP</th>
                      <th style={{ ...thStyle, fontSize: 11, padding: '6px 10px' }}>Projetos</th>
                      <th style={{ ...thStyle, fontSize: 11, padding: '6px 10px' }}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((l, idx) => (
                      <tr key={l.token} style={{ borderBottom: '1px solid #e0e7ff', background: idx % 2 === 0 ? 'transparent' : '#f5f7ff' }}>
                        <td style={{ padding: '6px 10px' }}>{l.escola_nome}</td>
                        <td style={{ padding: '6px 10px' }}>{l.escola_inep}</td>
                        <td style={{ padding: '6px 10px' }}>{l.projetos_count || 0}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <button
                            onClick={() => copiarLink(l.token)}
                            style={{ background: '#2563eb', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '3px 10px', fontWeight: 600 }}
                          >
                            Copiar link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

const selectStyle = { padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }
const thStyle = { textAlign: 'left', padding: '10px 14px', fontWeight: 600 }
const tdStyle = { padding: '10px 14px' }
