import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraLinksService, feiraRascunhosService, feiraPublicaService, feiraEdicoesService, feiraInscricoesService } from '../../services/feiraService'
import WizardSteps, { STEPS } from '../../components/feira/WizardSteps'
import CategoriaSelect from '../../components/feira/CategoriaSelect'
import ChecklistDocumentosFeira, { CONFIRMACOES_PROJETO } from '../../components/feira/ChecklistDocumentosFeira'
import { DEBOUNCE_AUTOSAVE_MS, getLimites, normalizarOrientadores } from '../../constants/feiraConstants'

function emailPermitido(email) {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}
function matriculaValida(m) {
  const s = String(m || '').trim()
  return s.length >= 4 // regra branda; ajuste se quiser padrão SEDF específico
}
function orientadorVazio() {
  return { matricula_sedf: '', nome: '', email: '', telefone: '' }
}

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
  const [statusInscricao, setStatusInscricao] = useState(null)
  const [contagemPorMatricula, setContagemPorMatricula] = useState({}) // matricula -> nº projetos

  const [form, setForm] = useState({
    orientadores: [orientadorVazio()],
    estudantes: [{ nome: '', serie: '', turma: '' }, { nome: '', serie: '', turma: '' }],
    titulo: '',
    categoria: '',
    resumo: '',
    etapa_local_realizada: false,
    documentos: { projeto_pesquisa: null, termos_autorizacao: [] },
    confirmacoes_projeto: {},
  })

  const saveTimer = useRef(null)
  const limites = getLimites(edicao)

  useEffect(() => { iniciar() }, [tokenEscola, rascunhoId])

  async function iniciar() {
    try {
      const linkData = await feiraLinksService.getByToken(tokenEscola)
      if (!linkData) { setLoading(false); return }
      setLink(linkData)
      const ed = await feiraEdicoesService.getById(linkData.edicao_id)
      setEdicao(ed)
      const lim = getLimites(ed)

      if (rascunhoId) {
        const rasc = await feiraRascunhosService.getById(rascunhoId)
        if (rasc) {
          const orientadoresLidos = normalizarOrientadores(rasc).map(o => ({
            matricula_sedf: o.matricula_sedf || '',
            nome: o.nome || '',
            email: o.email || '',
            telefone: o.telefone || '',
          }))
          const orientadores = orientadoresLidos.length ? orientadoresLidos : [orientadorVazio()]
          const estudantes = rasc.estudantes?.length ? rasc.estudantes : form.estudantes
          setForm({
            orientadores,
            estudantes,
            titulo: rasc.titulo || '',
            categoria: rasc.categoria || '',
            resumo: rasc.resumo || '',
            etapa_local_realizada: rasc.etapa_local_realizada || false,
            documentos: {
              projeto_pesquisa: rasc.documentos?.projeto_pesquisa || null,
              termos_autorizacao: Array.isArray(rasc.documentos?.termos_autorizacao) ? rasc.documentos.termos_autorizacao : [],
              termo_autorizacao: rasc.documentos?.termo_autorizacao || null,
            },
            confirmacoes_projeto: rasc.confirmacoes_projeto || {},
          })
          if (rasc.ultima_secao_editada) setStep(rasc.ultima_secao_editada)
          setStatusInscricao(rasc.status || null)
        }
      } else {
        // Garante que o primeiro carregamento respeite estudantes_min da edição
        setForm(f => {
          const est = [...f.estudantes]
          while (est.length < lim.estudantes_min) est.push({ nome: '', serie: '', turma: '' })
          return { ...f, estudantes: est.slice(0, lim.estudantes_max) }
        })
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
        const matriculas = (dados.orientadores || []).map(o => String(o.matricula_sedf || '').trim()).filter(Boolean)
        const payload = {
          ...dados,
          orientadores_matriculas: matriculas,
          ultima_secao_editada: secao,
          link_escola_token: tokenEscola,
          edicao_id: link?.edicao_id,
          escola: { inep: link?.escola_inep, nome: link?.escola_nome, cre: link?.escola_cre },
        }
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

  // Orientadores
  function addOrientador() {
    if (form.orientadores.length >= limites.orientadores_max) return
    updateForm({ orientadores: [...form.orientadores, orientadorVazio()] })
  }
  function removeOrientador(i) {
    if (form.orientadores.length <= limites.orientadores_min) return
    updateForm({ orientadores: form.orientadores.filter((_, idx) => idx !== i) })
  }
  function setOrientadorField(i, field, value) {
    const arr = [...form.orientadores]
    arr[i] = { ...arr[i], [field]: value }
    updateForm({ orientadores: arr })
  }
  async function verificarMatricula(matricula) {
    const m = String(matricula || '').trim()
    if (!m || !edicao?.id || contagemPorMatricula[m] != null) return
    try {
      const n = await feiraInscricoesService.contarPorOrientadorMatricula(edicao.id, m, docId)
      setContagemPorMatricula(prev => ({ ...prev, [m]: n }))
    } catch (e) { console.warn('contarPorOrientadorMatricula', e) }
  }

  // Estudantes
  function addEstudante() {
    if (form.estudantes.length >= limites.estudantes_max) return
    updateForm({ estudantes: [...form.estudantes, { nome: '', serie: '', turma: '' }] })
  }
  function removeEstudante(i) {
    if (form.estudantes.length <= limites.estudantes_min) return
    const est = form.estudantes.filter((_, idx) => idx !== i)
    const termos = Array.isArray(form.documentos?.termos_autorizacao) ? form.documentos.termos_autorizacao.filter((_, idx) => idx !== i) : []
    updateForm({ estudantes: est, documentos: { ...form.documentos, termos_autorizacao: termos } })
  }

  async function enviar() {
    setEnviando(true)
    try {
      const matriculas = form.orientadores.map(o => String(o.matricula_sedf || '').trim()).filter(Boolean)
      const payload = {
        ...form,
        orientadores_matriculas: matriculas,
        link_escola_token: tokenEscola,
        edicao_id: link.edicao_id,
        escola: { inep: link.escola_inep, nome: link.escola_nome, cre: link.escola_cre },
      }
      const isReenvio = statusInscricao === 'devolvida'
      if (isReenvio) {
        await feiraPublicaService.reenviar(docId, payload)
      } else {
        await feiraPublicaService.enviar(docId, payload)
      }
      navigate(`/inscricao/${tokenEscola}`)
    } catch (e) {
      console.error(e)
      alert(e.message || 'Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <Shell><p>Carregando...</p></Shell>
  if (!link) return <Shell><p style={{ color: '#dc2626' }}>Link inválido.</p></Shell>

  const orientadoresValidos = form.orientadores.every(o =>
    o.nome && matriculaValida(o.matricula_sedf) && emailPermitido(o.email)
  )
  const qtdOrientadoresOk =
    form.orientadores.length >= limites.orientadores_min &&
    form.orientadores.length <= limites.orientadores_max

  const termosOk = form.estudantes.every((_, idx) => !!form.documentos?.termos_autorizacao?.[idx]?.url)

  const podeAvancar = (() => {
    if (step === 'orientador') {
      if (!qtdOrientadoresOk || !orientadoresValidos) return false
      return form.estudantes.length >= limites.estudantes_min &&
             form.estudantes.length <= limites.estudantes_max &&
             form.estudantes.every(e => e.nome)
    }
    if (step === 'projeto') return form.titulo && form.categoria
    if (step === 'documentos') {
      const docsOk = form.documentos?.projeto_pesquisa?.url && termosOk
      const confOk = CONFIRMACOES_PROJETO.every(c => form.confirmacoes_projeto?.[c.key])
      return docsOk && confOk
    }
    return aceiteRegulamento
  })()

  const stepIdx = STEPS.findIndex(s => s.key === step)

  return (
    <Shell>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>{rascunhoId ? 'Editar projeto' : 'Inscrever novo projeto'}</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{link.escola_nome}</p>
      </div>

      <WizardSteps current={step} onStep={setStep} allowAll={!!rascunhoId} />

      {step === 'orientador' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, margin: 0 }}>
              Professor(es)-orientador(es) ({form.orientadores.length}/{limites.orientadores_max})
            </h3>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
              Mínimo {limites.orientadores_min}, máximo {limites.orientadores_max}. Matrícula SEDF e e-mail são obrigatórios.
            </p>
          </div>

          {form.orientadores.map((o, i) => {
            const mat = String(o.matricula_sedf || '').trim()
            const jaCadastrados = contagemPorMatricula[mat]
            const estoura = mat && jaCadastrados != null && (jaCadastrados + 1) > limites.projetos_por_orientador_max
            return (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 13 }}>Orientador {i + 1}</strong>
                  {form.orientadores.length > limites.orientadores_min && (
                    <button type="button" onClick={() => removeOrientador(i)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    label="Matrícula SEDF *"
                    value={o.matricula_sedf}
                    onChange={v => setOrientadorField(i, 'matricula_sedf', v)}
                    onBlur={() => verificarMatricula(o.matricula_sedf)}
                    style={{ flex: 1 }}
                  />
                  <Input label="Telefone" value={o.telefone} onChange={v => setOrientadorField(i, 'telefone', v)} style={{ flex: 1 }} />
                </div>
                <Input label="Nome completo *" value={o.nome} onChange={v => setOrientadorField(i, 'nome', v)} />
                <Input label="E-mail *" type="email" value={o.email} onChange={v => setOrientadorField(i, 'email', v)} />
                {o.email && !emailPermitido(o.email) && (
                  <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>
                    Informe um e-mail válido.
                  </p>
                )}
                {mat && jaCadastrados != null && jaCadastrados > 0 && (
                  <p style={{ fontSize: 11, color: estoura ? '#dc2626' : '#b45309', margin: 0 }}>
                    Este orientador já participa de {jaCadastrados} projeto(s) nesta edição
                    (limite recomendado: {limites.projetos_por_orientador_max}).
                  </p>
                )}
              </div>
            )
          })}
          {form.orientadores.length < limites.orientadores_max && (
            <button type="button" onClick={addOrientador} style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Adicionar orientador</button>
          )}

          <h3 style={{ fontSize: 15, margin: '12px 0 0' }}>
            Estudantes ({form.estudantes.length}/{limites.estudantes_max})
          </h3>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '-8px 0 0' }}>
            Mínimo {limites.estudantes_min}, máximo {limites.estudantes_max}.
          </p>
          {form.estudantes.map((est, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Input label={`Estudante ${i + 1}`} value={est.nome} onChange={v => { const e = [...form.estudantes]; e[i] = { ...e[i], nome: v }; updateForm({ estudantes: e }) }} style={{ flex: 2 }} />
              <Input label="Série" value={est.serie} onChange={v => { const e = [...form.estudantes]; e[i] = { ...e[i], serie: v }; updateForm({ estudantes: e }) }} style={{ flex: 1 }} />
              <Input label="Turma" value={est.turma} onChange={v => { const e = [...form.estudantes]; e[i] = { ...e[i], turma: v }; updateForm({ estudantes: e }) }} style={{ width: 70 }} />
              {form.estudantes.length > limites.estudantes_min && (
                <button type="button" onClick={() => removeEstudante(i)} style={{ padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 13, marginBottom: 0 }}>×</button>
              )}
            </div>
          ))}
          {form.estudantes.length < limites.estudantes_max && (
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
          modeloAutorizacao={edicao?.modelo_autorizacao_imagem}
          confirmacoes={form.confirmacoes_projeto}
          onConfirmacoesChange={c => updateForm({ confirmacoes_projeto: c }, 'documentos')}
          onChange={docs => updateForm({ documentos: docs }, 'documentos')}
        />
      )}

      {step === 'revisao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>Revisão dos dados</h3>
          {form.orientadores.map((o, i) => (
            <ReviewSection key={i} label={`Orientador ${i + 1}`} items={[
              `Matrícula SEDF: ${o.matricula_sedf}`,
              o.nome,
              o.email,
              o.telefone,
            ].filter(Boolean)} />
          ))}
          <ReviewSection label="Estudantes" items={form.estudantes.map(e => `${e.nome} — ${e.serie} ${e.turma}`)} />
          <ReviewSection label="Projeto" items={[form.titulo, `Categoria: ${form.categoria}`, form.etapa_local_realizada ? 'Etapa local realizada' : 'Etapa local não realizada']} />
          <ReviewSection label="Documentos" items={[
            form.documentos?.projeto_pesquisa?.url ? '✓ Projeto de Pesquisa' : '✗ Projeto de Pesquisa',
            ...form.estudantes.map((est, idx) =>
              form.documentos?.termos_autorizacao?.[idx]?.url
                ? `✓ Termo de Autorização — ${est.nome || `Estudante ${idx + 1}`}`
                : `✗ Termo de Autorização — ${est.nome || `Estudante ${idx + 1}`}`
            ),
          ]} />
          <ReviewSection label="Conformidade do Projeto com o Regulamento" items={CONFIRMACOES_PROJETO.map(c =>
            `${form.confirmacoes_projeto?.[c.key] ? '✓' : '✗'} ${c.label}`
          )} />

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
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 24, letterSpacing: '.5px' }}>CCEP-DF · ETAPA REGIONAL</div>
        {children}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', multiline, style, onBlur, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div style={style}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>}
      <Tag
        type={!multiline ? type : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
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
