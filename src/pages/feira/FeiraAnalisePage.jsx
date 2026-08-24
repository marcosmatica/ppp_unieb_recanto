import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraInscricoesService } from '../../services/feiraService'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/feira/StatusBadge'
import toast from 'react-hot-toast'

export default function FeiraAnalisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [inscricao, setInscricao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [checklist, setChecklist] = useState({
    categoria_ok: false, qtd_estudantes_ok: false,
    orientador_limite_ok: false, projeto_formato_ok: false,
  })
  const [docAnalise, setDocAnalise] = useState({ projeto: '', termos: [] })
  const [observacoes, setObservacoes] = useState('')
  const [msgDevolucao, setMsgDevolucao] = useState('')

  useEffect(() => {
    feiraInscricoesService.getById(id).then(i => {
      if (i) {
        setInscricao(i)
        if (i.analise_checklist) setChecklist(i.analise_checklist)
        if (i.analise_documentos) setDocAnalise(i.analise_documentos)
        if (i.analise_observacoes) setObservacoes(i.analise_observacoes)
      }
      setLoading(false)
    })
  }, [id])

  async function salvarAnalise(novoStatus) {
    setSalvando(true)
    try {
      const dados = {
        status: novoStatus,
        analise_checklist: checklist,
        analise_documentos: docAnalise,
        analise_observacoes: observacoes,
      }
      if (novoStatus === 'devolvida') {
        dados.devolucoes_num = (inscricao.devolucoes_num || 0) + 1
        dados.devolucoes_hist = [...(inscricao.devolucoes_hist || []), {
          em: new Date().toISOString(),
          mensagem: msgDevolucao,
          por_uid: user.uid,
          por_nome: profile?.name,
        }]
      }
      if (novoStatus === 'aprovada' || novoStatus === 'indeferida') {
        dados.decidido_em = new Date().toISOString()
        dados.decidido_por = { uid: user.uid, nome: profile?.name }
      }
      await feiraInscricoesService.atualizar(id, dados)
      toast.success(`Inscrição ${novoStatus === 'aprovada' ? 'aprovada' : novoStatus === 'indeferida' ? 'indeferida' : 'devolvida'}`)
      navigate('/feira')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>
  if (!inscricao) return <div style={{ padding: 32 }}>Inscrição não encontrada.</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <button onClick={() => navigate(`/feira/inscricao/${id}`)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16 }}>← Voltar</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Análise: {inscricao.titulo}</h1>
        <StatusBadge status={inscricao.status} />
      </div>

      <h3 style={{ fontSize: 15 }}>Checklist de conformidade</h3>
      {Object.entries({ categoria_ok: 'Categoria coerente com etapa', qtd_estudantes_ok: 'Quantidade de estudantes correta', orientador_limite_ok: 'Orientador dentro do limite', projeto_formato_ok: 'Projeto no formato correto' }).map(([k, label]) => (
        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
          <input type="checkbox" checked={checklist[k]} onChange={e => setChecklist(c => ({ ...c, [k]: e.target.checked }))} />
          {label}
        </label>
      ))}

      <h3 style={{ fontSize: 15, marginTop: 20 }}>Documentos</h3>
      {inscricao.documentos?.projeto_pesquisa?.url && (
        <div style={{ marginBottom: 8 }}>
          <a href={inscricao.documentos.projeto_pesquisa.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Ver Projeto de Pesquisa</a>
          <select value={docAnalise.projeto || ''} onChange={e => setDocAnalise(d => ({ ...d, projeto: e.target.value }))} style={{ marginLeft: 12, fontSize: 12 }}>
            <option value="">—</option>
            <option value="valido">Válido</option>
            <option value="invalido">Inválido</option>
            <option value="ilegivel">Ilegível</option>
          </select>
        </div>
      )}

      <h3 style={{ fontSize: 15, marginTop: 20 }}>Observações</h3>
      <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />

      <h3 style={{ fontSize: 15, marginTop: 20 }}>Mensagem de devolução (se aplicável)</h3>
      <textarea value={msgDevolucao} onChange={e => setMsgDevolucao(e.target.value)} rows={3} placeholder="Descreva as pendências..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button onClick={() => salvarAnalise('aprovada')} disabled={salvando} style={btnStyle('#16a34a')}>Aprovar</button>
        <button onClick={() => salvarAnalise('devolvida')} disabled={salvando || !msgDevolucao} style={btnStyle('#ea580c')}>Devolver</button>
        <button onClick={() => salvarAnalise('indeferida')} disabled={salvando} style={btnStyle('#dc2626')}>Indeferir</button>
      </div>
    </div>
  )
}

const btnStyle = (bg) => ({ padding: '10px 20px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' })
