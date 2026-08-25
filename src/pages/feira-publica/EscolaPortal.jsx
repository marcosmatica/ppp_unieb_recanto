import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraLinksService, feiraRascunhosService, feiraEdicoesService } from '../../services/feiraService'
import ProjetoCard from '../../components/feira/ProjetoCard'

export default function EscolaPortal() {
  const { tokenEscola } = useParams()
  const navigate = useNavigate()
  const [link, setLink] = useState(null)
  const [edicao, setEdicao] = useState(null)
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    iniciar()
  }, [tokenEscola])

  async function iniciar() {
    try {
      const linkData = await feiraLinksService.getByToken(tokenEscola)
      if (!linkData) { setErro('Link inválido ou expirado.'); setLoading(false); return }
      setLink(linkData)

      const ed = await feiraEdicoesService.getById(linkData.edicao_id)
      setEdicao(ed)

      const lista = await feiraRascunhosService.listarPorEscola(tokenEscola)
      setProjetos(lista)
    } catch (e) {
      console.error(e)
      setErro('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageShell><p>Carregando...</p></PageShell>
  if (erro) return <PageShell><p style={{ color: '#dc2626' }}>{erro}</p></PageShell>

  const inscricoesAbertas = edicao?.inscricoes_abertas

  return (
    <PageShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{link.escola_nome}</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          INEP {link.escola_inep} · CRE {link.escola_cre}
        </p>
      </div>

      {edicao && (
        <div style={{ padding: '16px 20px', borderRadius: 12, background: '#f0f9ff', marginBottom: 24, fontSize: 13 }}>
          <strong>{edicao.tema}</strong>
          <div style={{ marginTop: 4 }}>
            {inscricoesAbertas
              ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Inscrições abertas</span>
              : <span style={{ color: '#dc2626', fontWeight: 600 }}>Inscrições encerradas</span>
            }
            {' · '} Ano {edicao.ano}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Projetos inscritos ({projetos.length})</h2>
        {inscricoesAbertas && (
          <button
            onClick={() => navigate(`/inscricao/${tokenEscola}/novo`)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Inscrever novo projeto
          </button>
        )}
      </div>

      {projetos.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Nenhum projeto inscrito ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projetos.map(p => <ProjetoCard key={p.id} projeto={p} tokenEscola={tokenEscola} />)}
        </div>
      )}
    </PageShell>
  )
}

function PageShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-page, #f9fafb)',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#2563eb',
          marginBottom: 24, letterSpacing: '.5px',
        }}>
          CCEP-DF · ETAPA REGIONAL
        </div>
        {children}
      </div>
    </div>
  )
}
