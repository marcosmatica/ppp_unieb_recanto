import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { feiraRascunhosService, feiraLinksService } from '../../services/feiraService'
import StatusBadge from '../../components/feira/StatusBadge'
import { CATEGORIAS } from '../../constants/feiraConstants'

export default function ProjetoStatus() {
  const { tokenEscola, rascunhoId } = useParams()
  const navigate = useNavigate()
  const [projeto, setProjeto] = useState(null)
  const [link, setLink] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth)
        const [l, p] = await Promise.all([
          feiraLinksService.getByToken(tokenEscola),
          feiraRascunhosService.getById(rascunhoId),
        ])
        setLink(l)
        setProjeto(p)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [tokenEscola, rascunhoId])

  if (loading) return <Shell><p>Carregando...</p></Shell>
  if (!projeto) return <Shell><p style={{ color: '#dc2626' }}>Projeto não encontrado.</p></Shell>

  const cat = CATEGORIAS.find(c => c.value === projeto.categoria)
  const isDevolvido = projeto.status === 'devolvida'

  return (
    <Shell>
      <button onClick={() => navigate(`/feira/${tokenEscola}`)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>← Voltar ao portal</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{projeto.titulo || 'Sem título'}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {cat?.label || projeto.categoria} · {link?.escola_nome}
          </p>
        </div>
        <StatusBadge status={projeto.status} />
      </div>

      <Section label="Orientador">
        <p>{projeto.orientador?.nome} — {projeto.orientador?.email}</p>
        {projeto.orientador2?.nome && <p>2º: {projeto.orientador2.nome} — {projeto.orientador2.email}</p>}
      </Section>

      <Section label="Estudantes">
        {projeto.estudantes?.map((e, i) => (
          <p key={i}>{e.nome} — {e.serie} {e.turma}</p>
        ))}
      </Section>

      <Section label="Documentos">
        <p>{projeto.documentos?.projeto_pesquisa?.url ? '✓ Projeto de Pesquisa enviado' : '✗ Projeto de Pesquisa pendente'}</p>
        {projeto.estudantes?.map((e, i) => (
          <p key={i}>{projeto.documentos?.termos_autorizacao?.[i]?.url ? '✓' : '✗'} Termo — {e.nome}</p>
        ))}
      </Section>

      {isDevolvido && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', marginTop: 16 }}>
          <strong style={{ fontSize: 14, color: '#c2410c' }}>Inscrição devolvida para correções</strong>
          <p style={{ fontSize: 13, marginTop: 6 }}>Acesse o formulário para corrigir os itens apontados pela comissão.</p>
          <button
            onClick={() => navigate(`/feira/${tokenEscola}/projeto/${rascunhoId}`)}
            style={{ marginTop: 8, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Corrigir e reenviar
          </button>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 24, letterSpacing: '.5px' }}>CCEP-DF · ETAPA REGIONAL</div>
        {children}
      </div>
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
