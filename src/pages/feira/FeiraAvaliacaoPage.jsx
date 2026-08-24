import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraInscricoesService, feiraAvaliacoesService } from '../../services/feiraService'
import { useAuth } from '../../contexts/AuthContext'
import { CRITERIOS_AVALIACAO, ITENS_AVALIACAO, VALORES_NOTA } from '../../constants/feiraConstants'
import toast from 'react-hot-toast'

export default function FeiraAvaliacaoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [inscricao, setInscricao] = useState(null)
  const [notas, setNotas] = useState({})
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    try {
      const insc = await feiraInscricoesService.getById(id)
      setInscricao(insc)

      const avalId = `${id}_${user.uid}`
      const aval = await feiraAvaliacoesService.getById(avalId)
      if (aval) {
        setNotas(aval.notas || {})
        setObservacoes(aval.observacoes || '')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function calcularTotal() {
    return CRITERIOS_AVALIACAO.reduce((sum, c) => sum + (notas[c.key] || 0), 0)
  }

  function calcularPorItem(item) {
    return CRITERIOS_AVALIACAO.filter(c => c.item === item).reduce((sum, c) => sum + (notas[c.key] || 0), 0)
  }

  async function salvar(concluir) {
    setSalvando(true)
    try {
      const avalId = `${id}_${user.uid}`
      const dados = {
        inscricao_id: id,
        edicao_id: inscricao.edicao_id,
        avaliador_uid: user.uid,
        avaliador_nome: profile?.name,
        status: concluir ? 'concluida' : 'pendente',
        notas,
        total_projeto: calcularPorItem('I'),
        total_diario: calcularPorItem('II'),
        total_oral: calcularPorItem('III'),
        total: calcularTotal(),
        observacoes,
      }
      if (concluir) dados.concluido_em = new Date().toISOString()
      await feiraAvaliacoesService.salvar(avalId, dados)
      toast.success(concluir ? 'Avaliação concluída!' : 'Rascunho salvo')
      if (concluir) navigate('/feira')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>
  if (!inscricao) return <div style={{ padding: 32 }}>Inscrição não encontrada.</div>

  const todosCriteriosPreenchidos = CRITERIOS_AVALIACAO.every(c => notas[c.key] != null)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <button onClick={() => navigate('/feira')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16 }}>← Voltar</button>

      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Avaliação: {inscricao.titulo}</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>{inscricao.escola?.nome} · Categoria {inscricao.categoria}</p>

      {ITENS_AVALIACAO.map(item => (
        <div key={item.key} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Item {item.key} — {item.label} (max {item.maxPts} pts)</h3>
          {CRITERIOS_AVALIACAO.filter(c => c.item === item.key).map(criterio => (
            <div key={criterio.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{criterio.label}</span>
              <select
                value={notas[criterio.key] ?? ''}
                onChange={e => setNotas(n => ({ ...n, [criterio.key]: parseFloat(e.target.value) }))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value="">—</option>
                {VALORES_NOTA.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
              </select>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>Subtotal: {calcularPorItem(item.key).toFixed(1)} / {item.maxPts}</div>
        </div>
      ))}

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'right' }}>
        Total: {calcularTotal().toFixed(1)} / 100
      </div>

      <h3 style={{ fontSize: 15 }}>Observações</h3>
      <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => salvar(false)} disabled={salvando} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Salvar rascunho</button>
        <button onClick={() => salvar(true)} disabled={salvando || !todosCriteriosPreenchidos} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: todosCriteriosPreenchidos ? '#16a34a' : '#d1d5db', color: '#fff', fontWeight: 600, fontSize: 13, cursor: todosCriteriosPreenchidos ? 'pointer' : 'default' }}>Concluir avaliação</button>
      </div>
    </div>
  )
}
