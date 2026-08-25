import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraRascunhosService, feiraLinksService } from '../../services/feiraService'
import StatusBadge from '../../components/feira/StatusBadge'
import DocPreview from '../../components/feira/DocPreview'
import { CATEGORIAS, normalizarOrientadores } from '../../constants/feiraConstants'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'

export default function ProjetoStatus() {
  const { tokenEscola, rascunhoId } = useParams()
  const navigate = useNavigate()
  const [projeto, setProjeto] = useState(null)
  const [inscricao, setInscricao] = useState(null)
  const [link, setLink] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [l, p] = await Promise.all([
          feiraLinksService.getByToken(tokenEscola),
          feiraRascunhosService.getById(rascunhoId),
        ])
        setLink(l)
        setProjeto(p)
        const q = query(collection(db, 'feira_inscricoes'), where('rascunho_id', '==', rascunhoId), limit(1))
        const snap = await getDocs(q)
        if (!snap.empty) setInscricao({ id: snap.docs[0].id, ...snap.docs[0].data() })
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
      <button onClick={() => navigate(`/inscricao/${tokenEscola}`)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>← Voltar ao portal</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{projeto.titulo || 'Sem título'}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {cat?.label || projeto.categoria} · {link?.escola_nome}
          </p>
        </div>
        <StatusBadge status={projeto.status} />
      </div>

      <Section label="Orientador(es)">
        {normalizarOrientadores(projeto).map((o, i) => (
          <p key={i}>
            {o.matricula_sedf ? <><strong>Mat. {o.matricula_sedf}</strong> — </> : null}
            {o.nome} — {o.email}
          </p>
        ))}
      </Section>

      <Section label="Estudantes">
        {projeto.estudantes?.map((e, i) => (
          <p key={i}>{e.nome} — {e.serie} {e.turma}</p>
        ))}
      </Section>

      <Section label="Documentos">
        {projeto.documentos?.projeto_pesquisa?.url ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <span>✓ Projeto de Pesquisa enviado</span>
            <DocPreview url={projeto.documentos.projeto_pesquisa.url} nome={projeto.documentos.projeto_pesquisa.nome} />
          </div>
        ) : <p>✗ Projeto de Pesquisa pendente</p>}
        {projeto.documentos?.termo_autorizacao?.url && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <span>✓ Termo de Autorização (formato legado — único)</span>
            <DocPreview url={projeto.documentos.termo_autorizacao.url} nome={projeto.documentos.termo_autorizacao.nome} />
          </div>
        )}
        {projeto.estudantes?.map((est, i) => {
          const t = projeto.documentos?.termos_autorizacao?.[i]
          return (
            <div key={`termo-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <span>{t?.url ? '✓' : '✗'} Termo — {est.nome || `Estudante ${i + 1}`}</span>
              {t?.url && <DocPreview url={t.url} nome={t.nome} />}
            </div>
          )
        })}
      </Section>

      {isDevolvido && (
        <div style={{ padding: '16px 20px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa', marginTop: 20 }}>
          <strong style={{ fontSize: 14, color: '#c2410c' }}>Inscrição devolvida para correções</strong>
          {(() => {
            const hist = inscricao?.devolucoes_hist || []
            const ultima = hist[hist.length - 1]
            if (!ultima?.mensagem) return <p style={{ fontSize: 13, marginTop: 8 }}>Acesse o formulário para corrigir os itens apontados pela comissão.</p>
            return (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #fed7aa' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9a3412', marginBottom: 4 }}>Mensagem da comissão{ultima.por_nome ? ` · ${ultima.por_nome}` : ''}</div>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{ultima.mensagem}</div>
              </div>
            )
          })()}
          <button
            onClick={() => navigate(`/inscricao/${tokenEscola}/projeto/${rascunhoId}`)}
            style={{ marginTop: 12, padding: '10px 22px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
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
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 24, letterSpacing: '.5px' }}>CCEP-DF · ETAPA REGIONAL</div>
        {children}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  )
}
