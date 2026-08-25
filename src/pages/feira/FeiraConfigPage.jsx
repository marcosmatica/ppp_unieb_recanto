import { useState, useEffect } from 'react'
import { feiraEdicoesService, feiraPublicaService } from '../../services/feiraService'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../../services/firebase'
import { MAX_FILE_SIZE, getLimites } from '../../constants/feiraConstants'
import DocPreview from '../../components/feira/DocPreview'
import toast from 'react-hot-toast'

export default function FeiraConfigPage() {
  const [edicao, setEdicao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    ano: new Date().getFullYear(),
    tema: '',
    inscricoes_abertas: false,
    max_projetos_por_escola: 5,
    data_encerramento: '',
    data_inicio: '',
    permitir_reenvio: true,
    modelo_autorizacao_imagem: null,
    limites: getLimites(null),
  })
  const [uploadPct, setUploadPct] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      if (ed) {
        setEdicao(ed)
        setForm({
          ano: ed.ano,
          tema: ed.tema || '',
          inscricoes_abertas: !!ed.inscricoes_abertas,
          max_projetos_por_escola: ed.max_projetos_por_escola ?? 5,
          data_encerramento: ed.data_encerramento || '',
          data_inicio: ed.data_inicio || '',
          permitir_reenvio: ed.permitir_reenvio !== false,
          modelo_autorizacao_imagem: ed.modelo_autorizacao_imagem || null,
          limites: getLimites(ed),
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    try {
      if (edicao) {
        await feiraEdicoesService.atualizar(edicao.id, form)
        toast.success('Edição atualizada')
      } else {
        const id = await feiraEdicoesService.criar(form)
        setEdicao({ id, ...form })
        toast.success('Edição criada')
      }
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function uploadModelo(file) {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) return toast.error('Arquivo excede 15 MB.')
    const okTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!okTypes.includes(file.type)) return toast.error('Envie PDF ou DOC/DOCX.')
    const ano = edicao?.ano || form.ano
    const path = `feira/edicoes/${ano}/modelo_autorizacao/${Date.now()}_${file.name}`
    const storageRef = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)
    setUploadPct(0)
    task.on('state_changed',
      snap => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => { setUploadPct(null); toast.error('Falha no upload.') },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        const info = { url, path, nome: file.name, tamanho: file.size, tipo: file.type, enviado_em: new Date().toISOString() }
        setForm(f => ({ ...f, modelo_autorizacao_imagem: info }))
        setUploadPct(null)
        toast.success('Modelo enviado. Clique em "Salvar" para publicar.')
      }
    )
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Configuração da Feira de Ciências</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Ano">
          <input type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: +e.target.value }))} style={inputStyle} />
        </Field>

        <Field label="Tema">
          <input value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} style={inputStyle} placeholder="Ex: Elas na Ciência..." />
        </Field>

        <Field label="Máximo de projetos por escola">
          <input
            type="number"
            min={1}
            value={form.max_projetos_por_escola}
            onChange={e => setForm(f => ({ ...f, max_projetos_por_escola: Math.max(1, +e.target.value || 1) }))}
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Cada unidade escolar poderá inscrever até esta quantidade de projetos.</p>
        </Field>

        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Data de início das inscrições">
            <input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Data final de envio">
            <input type="date" value={form.data_encerramento} onChange={e => setForm(f => ({ ...f, data_encerramento: e.target.value }))} style={inputStyle} />
          </Field>
        </div>

        <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
          <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Limites da inscrição</legend>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 10px' }}>
            Vale para novas inscrições desta edição. Chave do orientador = matrícula SEDF.
          </p>
          <LimitesGrid limites={form.limites} onChange={l => setForm(f => ({ ...f, limites: l }))} />
        </fieldset>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={form.inscricoes_abertas} onChange={e => setForm(f => ({ ...f, inscricoes_abertas: e.target.checked }))} />
          Inscrições abertas
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={form.permitir_reenvio} onChange={e => setForm(f => ({ ...f, permitir_reenvio: e.target.checked }))} />
          Permitir reenvio de projetos devolvidos
        </label>

        <Field label="Modelo do Termo de Autorização de Uso de Imagem e Voz (Anexo VIII)">
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>
            Documento único por projeto que o professor-orientador preenche listando todos os estudantes.
            Escolas baixam este modelo, assinam e enviam junto à inscrição (PDF ou foto). Aceita PDF/DOC/DOCX.
          </p>
          {form.modelo_autorizacao_imagem?.url ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ✓ {form.modelo_autorizacao_imagem.nome}
              </span>
              <DocPreview url={form.modelo_autorizacao_imagem.url} nome={form.modelo_autorizacao_imagem.nome} />
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, modelo_autorizacao_imagem: null }))}
                style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
              >Remover</button>
            </div>
          ) : null}
          {uploadPct != null && <div style={{ fontSize: 11, color: '#2563eb', marginBottom: 6 }}>Enviando... {uploadPct}%</div>}
          <label style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid #d1d5db', cursor: 'pointer', color: '#2563eb' }}>
            {form.modelo_autorizacao_imagem?.url ? 'Substituir modelo' : 'Enviar modelo'}
            <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadModelo(e.target.files[0]); e.target.value = '' }} />
          </label>
        </Field>

        <button onClick={salvar} disabled={salvando} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start' }}>
          {salvando ? 'Salvando...' : edicao ? 'Salvar alterações' : 'Criar edição'}
        </button>

        {edicao && (
          <>
            <p style={{ fontSize: 12, color: '#6b7280' }}>ID da edição: {edicao.id}</p>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Certificados</h3>
              <button
                onClick={async () => {
                  setSalvando(true)
                  try {
                    const res = await feiraPublicaService.gerarCertificados(edicao.id)
                    toast.success(`${res.data.total} certificados gerados`)
                  } catch (e) {
                    console.error(e)
                    toast.error('Erro ao gerar certificados')
                  } finally {
                    setSalvando(false)
                  }
                }}
                disabled={salvando}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {salvando ? 'Gerando...' : 'Gerar certificados em lote'}
              </button>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Gera PDFs para todos os participantes com resultado final.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }

function LimitesGrid({ limites, onChange }) {
  const set = (k, v) => onChange({ ...limites, [k]: Math.max(0, Number(v) || 0) })
  const rows = [
    { label: 'Orientadores por projeto', min: 'orientadores_min', max: 'orientadores_max' },
    { label: 'Estudantes por projeto', min: 'estudantes_min', max: 'estudantes_max' },
    { label: 'Projetos por orientador (na edição)', min: 'projetos_por_orientador_min', max: 'projetos_por_orientador_max' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: '8px 12px', alignItems: 'center' }}>
      <div />
      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Mín.</div>
      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Máx.</div>
      {rows.map(r => (
        <div key={r.min} style={{ display: 'contents' }}>
          <div style={{ fontSize: 13 }}>{r.label}</div>
          <input type="number" min={0} value={limites[r.min]} onChange={e => set(r.min, e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
          <input type="number" min={0} value={limites[r.max]} onChange={e => set(r.max, e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
        </div>
      ))}
    </div>
  )
}
