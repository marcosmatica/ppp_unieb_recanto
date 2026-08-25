import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraInscricoesService, feiraAvaliadorService, feiraAvaliacoesService } from '../../services/feiraService'
import StatusBadge from '../../components/feira/StatusBadge'
import DocPreview from '../../components/feira/DocPreview'
import { CATEGORIAS } from '../../constants/feiraConstants'
import toast from 'react-hot-toast'

export default function FeiraInscricaoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [inscricao, setInscricao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [avaliadores, setAvaliadores] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [avaliacoes, setAvaliacoes] = useState([])
  const [salvandoAval, setSalvandoAval] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const i = await feiraInscricoesService.getById(id)
        setInscricao(i)
        if (i) {
          setSelecionados(i.avaliadores || [])
          try {
            const avs = await feiraAvaliadorService.listarAvaliadores()
            setAvaliadores(avs)
          } catch (e) { console.error('Falha ao listar avaliadores:', e) }
          try {
            const avalList = await feiraAvaliacoesService.listarPorInscricao(id)
            setAvaliacoes(avalList)
          } catch (e) { console.error('Falha ao listar avaliações:', e) }
        }
      } catch (e) {
        console.error('Falha ao carregar inscrição:', e)
        toast.error('Erro ao carregar inscrição')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [id])

  async function salvarAvaliadores() {
    if (selecionados.length !== 3) { toast.error('Selecione exatamente 3 avaliadores'); return }
    setSalvandoAval(true)
    try {
      await feiraAvaliadorService.designarAvaliadores(id, selecionados)
      toast.success('Avaliadores designados')
      setInscricao(prev => ({ ...prev, avaliadores: selecionados }))
    } catch (e) {
      console.error(e)
      toast.error('Erro ao designar avaliadores')
    } finally {
      setSalvandoAval(false)
    }
  }

  function toggleAvaliador(uid) {
    setSelecionados(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : prev.length < 3 ? [...prev, uid] : prev
    )
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>
  if (!inscricao) return <div style={{ padding: 32 }}>Inscrição não encontrada.</div>

  const cat = CATEGORIAS.find(c => c.value === inscricao.categoria)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <button onClick={() => navigate('/feira')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>← Voltar</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{inscricao.titulo}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{cat?.label} · {inscricao.escola?.nome}</p>
        </div>
        <StatusBadge status={inscricao.status} />
      </div>

      <Section label="Orientador">
        <p>{inscricao.orientador?.nome} — {inscricao.orientador?.email} — {inscricao.orientador?.telefone}</p>
        {inscricao.orientador2?.nome && <p>2º: {inscricao.orientador2.nome} — {inscricao.orientador2.email}</p>}
      </Section>

      <Section label="Estudantes">
        {inscricao.estudantes?.map((e, i) => <p key={i}>{e.nome} — {e.serie} {e.turma}</p>)}
      </Section>

      <Section label="Documentos">
        {inscricao.documentos?.projeto_pesquisa?.url && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <span>Projeto de Pesquisa</span>
            <DocPreview url={inscricao.documentos.projeto_pesquisa.url} nome={inscricao.documentos.projeto_pesquisa.nome} />
          </div>
        )}
        {inscricao.documentos?.termo_autorizacao?.url && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <span>Termo de Autorização de Imagem e Voz</span>
            <DocPreview url={inscricao.documentos.termo_autorizacao.url} nome={inscricao.documentos.termo_autorizacao.nome} />
          </div>
        )}
        {inscricao.documentos?.termos_autorizacao?.map((t, i) => (
          t?.url && (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <span>Termo (legado) — {t.estudante_nome || `Estudante ${i + 1}`}</span>
              <DocPreview url={t.url} nome={t.nome} />
            </div>
          )
        ))}
      </Section>

      <Section label="Info">
        <p>Etapa local: {inscricao.etapa_local_realizada ? 'Sim' : 'Não'}</p>
        <p>Envio nº {inscricao.envio_num || 1} · Devoluções: {inscricao.devolucoes_num || 0}</p>
      </Section>

      {['enviada', 'reenviada', 'em_analise', 'em_reanalise', 'devolvida'].includes(inscricao.status) && (
        <button onClick={() => navigate(`/feira/inscricao/${id}/analise`)} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {['reenviada', 'em_reanalise'].includes(inscricao.status)
            ? 'Reanalisar (nova versão enviada)'
            : inscricao.status === 'devolvida'
              ? 'Revisar análise devolvida'
              : (inscricao.analise_checklist ? 'Continuar análise' : 'Iniciar análise')}
        </button>
      )}

      {inscricao.status === 'aprovada' && (
        <Section label="Designar Avaliadores (selecione 3)">
          {avaliadores.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Nenhum avaliador cadastrado no sistema.</p>
          ) : (
            <>
              {avaliadores.map(av => (
                <label key={av.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={selecionados.includes(av.uid)}
                    onChange={() => toggleAvaliador(av.uid)}
                    disabled={!selecionados.includes(av.uid) && selecionados.length >= 3}
                  />
                  {av.name || av.email} {av.cre ? `(${av.cre})` : ''}
                </label>
              ))}
              <button onClick={salvarAvaliadores} disabled={salvandoAval || selecionados.length !== 3} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, border: 'none', background: selecionados.length === 3 ? '#2563eb' : '#d1d5db', color: '#fff', fontWeight: 600, fontSize: 13, cursor: selecionados.length === 3 ? 'pointer' : 'default' }}>
                Designar avaliadores
              </button>
            </>
          )}
        </Section>
      )}

      {inscricao.avaliadores?.length > 0 && (
        <Section label={`Avaliações (${avaliacoes.filter(a => a.status === 'concluida').length}/${inscricao.avaliadores.length})`}>
          {inscricao.avaliadores.map(uid => {
            const av = avaliadores.find(a => a.uid === uid)
            const aval = avaliacoes.find(a => a.avaliador_uid === uid)
            return (
              <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{av?.name || uid}</span>
                <span style={{ fontWeight: 600, color: aval?.status === 'concluida' ? '#16a34a' : '#eab308' }}>
                  {aval?.status === 'concluida' ? `${aval.total?.toFixed(1)} pts` : 'Pendente'}
                </span>
              </div>
            )
          })}
          {inscricao.nota_final != null && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 14, fontWeight: 700 }}>
              Nota final: {(inscricao.nota_com_bonus ?? inscricao.nota_final).toFixed(1)} / 100
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  )
}
