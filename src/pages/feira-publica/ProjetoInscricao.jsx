import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { feiraLinksService, feiraRascunhosService, feiraPublicaService, feiraEdicoesService } from '../../services/feiraService'
import WizardSteps, { STEPS } from '../../components/feira/WizardSteps'
import CategoriaSelect from '../../components/feira/CategoriaSelect'
import ChecklistDocumentosFeira from '../../components/feira/ChecklistDocumentosFeira'
import { MIN_ESTUDANTES, MAX_ESTUDANTES, DEBOUNCE_AUTOSAVE_MS } from '../../constants/feiraConstants'

export default function ProjetoInscricao() {
  const { tokenEscola, rascunhoId } = useParams()
  const navigate = useNavigate()
  const [link, setLink] = useState(null)
  const [edicao, setEdicao] = useState(null)
  const [step, setStep] = useState('orientador')
  const [docId, setDocId] = useState(rascunhoId || null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [aceiteRegulamento, setAceiteRegulamento] = useState(false)

  const [form, setForm] = useState({
    orientador: { nome: '', email: '', telefone: '' },
    orientador2: null,
    estudantes: [{ nome: '', serie: '', turma: '' }, { nome: '', serie: '', turma: '' }],
    titulo: '',
    categoria: '',
    resumo: '',
    etapa_local_realizada: false,
    documentos: { projeto_pesquisa: null, termos_autorizacao: [] },
  })

  const saveTimer = useRef(null)

  useEffect(() => { iniciar() }, [tokenEscola, rascunhoId])

  async function iniciar() {
    try {
      if (!auth.currentUser) await signInAnonymously(auth)
      const linkData = await feiraLinksService.getByToken(tokenEscola)
      if (!linkData) { setLoading(false); return }
      setLink(linkData)
      const ed = await feiraEdicoesService.getById(linkData.edicao_id)
      setEdicao(ed)

      if (rascunhoId) {
        const rasc = await feiraRascunhosService.getById(rascunhoId)
        if (rasc) {
          setForm({
            orientador: rasc.orientador || form.orientador,
            orientador2: rasc.orientador2 || null,
            estudantes: rasc.estudantes?.length ? rasc.estudantes : form.estudantes,
            titulo: rasc.titulo || '',
            categoria: rasc.categoria || '',
            resumo: rasc.resumo || '',
            etapa_local_realizada: rasc.etapa_local_realizada || false,
            documentos: rasc.documentos || form.documentos,
          })
          if (rasc.ultima_secao_editada) setStep(rasc.ultima_secao_editada)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const autosave = useCallback((dados, secao) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const payload = { ...dados, ultima_secao_editada: secao, link_escola_token: tokenEscola, edicao_id: link?.edicao_id, escola: { inep: link?.escola_inep, nome: link?.escola_nome, cre: link?.escola_cre } }
        if (docId) {
          await feiraRascunhosService.salvar(docId, payload)
        } else {
          const id = await feiraRascunhosService.criar(payload)
          setDocId(id)
        }
      } catch (e) { console.error('autosave falhou:', e) }
    }, DEBOUNCE_AUTOSAVE_MS)
  }, [docId, tokenEscola, link])

  function updateForm(patch, secao) {
    const next = { ...form, ...patch }
    setForm(next)
    autosave(next, secao || step)
  }

  function addEstudante() {
    if (form.estudantes.length >= MAX_ESTUDANTES) return
    updateForm({ estudantes: [...form.estudantes, { nome: '', serie: '', turma: '' }] })
  }

  function removeEstudante(i) {
    if (form.estudantes.length <= MIN_ESTUDANTES) return
    updateForm({ estudantes: form.estudantes.filter((_, idx) => idx !== i) })
  }

  async function enviar() {
    setEnviando(true)
    try {
      const payload = { ...form, link_escola_token: tokenEscola, edicao_id: link.edicao_id, escola: { inep: link.escola_inep, nome: link.escola_nome, cre: link.escola_cre } }
      await feiraPublicaService.enviar(docId, payload)
      navigate(`/feira/${tokenEscola}`)
    } catch (e) {
      console.error(e)
      alert(e.message || 'Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <Shell><p>Carregando...</p></Shell>
  if (!link) return <Shell><p style={{ color: '#dc2626' }}>Link inválido.</p></Shell>

  const podeAvancar = (() => {
    if (step === 'orientador') return form.orientador.nome && form.orientador.email && form.estudantes.length >= MIN_ESTUDANTES && form.estudantes.every(e => e.nome)
    if (step === 'projeto') return form.titulo && form.categoria
    if (step === 'documentos') return form.documentos?.projeto_pesquisa?.url && form.estudantes.every((_, i) => form.documentos?.termos_autorizacao?.[i]?.url)
    return aceiteRegulamento
  })()

  const stepIdx = STEPS.findIndex(s => s.key === step)

  return (
    <Shell>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>{rascunhoId ? 'Editar projeto' : 'Inscrever novo projeto'}</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{link.escola_nome}</p>
      </div>

      <WizardSteps current={step} onStep={setStep} />

      {step === 'orientador' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>Professor-orientador</h3>
          <Input label="Nome completo" value={form.orientador.nome} onChange={v => updateForm({ orientador: { ...form.orientador, nome: v } })} />
          <Input label="E-mail" type="email" value={form.orientador.email} onChange={v => updateForm({ orientador: { ...form.orientador, email: v } })} />
          <Input label="Telefone" value={form.orientador.telefone} onChange={v => updateForm({ orientador: { ...form.orientador, telefone: v } })} />

          {form.orientador2 ? (
            <>
              <h3 style={{ fontSize: 15, margin: '8px 0 0' }}>2º Orientador</h3>
              <Input label="Nome" value={form.orientador2.nome} onChange={v => updateForm({ orientador2: { ...form.orientador2, nome: v } })} />
              <Input label="E-mail" value={form.orientador2.email} onChange={v => updateForm({ orientador2: { ...form.orientador2, email: v } })} />
              <button type="button" onClick={() => updateForm({ orientador2: null })} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>Remover 2º orientador</button>
            </>
          ) : (
            <button type="button" onClick={() => updateForm({ orientador2: { nome: '', email: '' } })} style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Adicionar 2º orientador</button>
          )}

          <h3 style={{ fontSize: 15, margin: '12px 0 0' }}>Estudantes ({form.estudantes.length})</h3>
          {form.estudantes.map((est, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Input label={`Estudante ${i + 1}`} value={est.nome} onChange={v => { const e = [...form.estudantes]; e[i] = { ...e[i], nome: v }; updateForm({ estudantes: e }) }} style={{ flex: 2 }} />
              <Input label="Série" value={est.serie} onChange={v => { const e = [...form.estudantes]; e[i] = { ...e[i], serie: v }; updateForm({ estudantes: e }) }} style={{ flex: 1 }} />
              <Input label="Turma" value={est.turma} onChange={v => { const e = [...form.estudantes]; e[i] = { ...e[i], turma: v }; updateForm({ estudantes: e }) }} style={{ width: 70 }} />
              {form.estudantes.length > MIN_ESTUDANTES && (
                <button type="button" onClick={() => removeEstudante(i)} style={{ padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 13, marginBottom: 0 }}>×</button>
              )}
            </div>
          ))}
          {form.estudantes.length < MAX_ESTUDANTES && (
            <button type="button" onClick={addEstudante} style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Adicionar estudante</button>
          )}
        </div>
      )}

      {step === 'projeto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Título do trabalho" value={form.titulo} onChange={v => updateForm({ titulo: v }, 'projeto')} />
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Categoria</label>
            <CategoriaSelect value={form.categoria} onChange={v => updateForm({ categoria: v }, 'projeto')} />
          </div>
          <Input label="Resumo curto (opcional)" value={form.resumo} onChange={v => updateForm({ resumo: v }, 'projeto')} multiline />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.etapa_local_realizada} onChange={e => updateForm({ etapa_local_realizada: e.target.checked }, 'projeto')} />
            Etapa local realizada
          </label>
        </div>
      )}

      {step === 'documentos' && (
        <ChecklistDocumentosFeira
          edicaoId={link.edicao_id}
          escolaInep={link.escola_inep}
          projetoId={docId || 'novo'}
          documentos={form.documentos}
          estudantes={form.estudantes}
          onChange={docs => updateForm({ documentos: docs }, 'documentos')}
        />
      )}

      {step === 'revisao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>Revisão dos dados</h3>
          <ReviewSection label="Orientador" items={[form.orientador.nome, form.orientador.email, form.orientador.telefone].filter(Boolean)} />
          {form.orientador2?.nome && <ReviewSection label="2º Orientador" items={[form.orientador2.nome, form.orientador2.email].filter(Boolean)} />}
          <ReviewSection label="Estudantes" items={form.estudantes.map(e => `${e.nome} — ${e.serie} ${e.turma}`)} />
          <ReviewSection label="Projeto" items={[form.titulo, `Categoria: ${form.categoria}`, form.etapa_local_realizada ? 'Etapa local realizada' : 'Etapa local não realizada']} />
          <ReviewSection label="Documentos" items={[
            form.documentos?.projeto_pesquisa?.url ? '✓ Projeto de Pesquisa' : '✗ Projeto de Pesquisa',
            ...form.estudantes.map((e, i) => form.documentos?.termos_autorizacao?.[i]?.url ? `✓ Termo — ${e.nome}` : `✗ Termo — ${e.nome}`)
          ]} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginTop: 8 }}>
            <input type="checkbox" checked={aceiteRegulamento} onChange={e => setAceiteRegulamento(e.target.checked)} style={{ marginTop: 2 }} />
            Li e concordo com o regulamento do 15º CCEP-DF.
          </label>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
        {stepIdx > 0 ? (
          <button onClick={() => setStep(STEPS[stepIdx - 1].key)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Voltar</button>
        ) : <div />}

        {step === 'revisao' ? (
          <button onClick={enviar} disabled={!podeAvancar || enviando} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: podeAvancar ? '#16a34a' : '#d1d5db', color: '#fff', fontSize: 14, fontWeight: 600, cursor: podeAvancar ? 'pointer' : 'default' }}>
            {enviando ? 'Enviando...' : 'Enviar inscrição'}
          </button>
        ) : (
          <button onClick={() => setStep(STEPS[stepIdx + 1].key)} disabled={!podeAvancar} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: podeAvancar ? '#2563eb' : '#d1d5db', color: '#fff', fontSize: 14, fontWeight: 600, cursor: podeAvancar ? 'pointer' : 'default' }}>
            Avançar
          </button>
        )}
      </div>
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

function Input({ label, value, onChange, type = 'text', multiline, style, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div style={style}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>}
      <Tag
        type={!multiline ? type : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={multiline ? 3 : undefined}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', resize: multiline ? 'vertical' : undefined, boxSizing: 'border-box' }}
        {...props}
      />
    </div>
  )
}

function ReviewSection({ label, items }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {items.map((it, i) => <div key={i} style={{ fontSize: 13 }}>{it}</div>)}
    </div>
  )
}
