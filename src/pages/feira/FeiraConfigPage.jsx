import { useState, useEffect } from 'react'
import { feiraEdicoesService, feiraPublicaService } from '../../services/feiraService'
import toast from 'react-hot-toast'

export default function FeiraConfigPage() {
  const [edicao, setEdicao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ ano: new Date().getFullYear(), tema: '', inscricoes_abertas: false })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      if (ed) {
        setEdicao(ed)
        setForm({ ano: ed.ano, tema: ed.tema, inscricoes_abertas: ed.inscricoes_abertas })
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

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={form.inscricoes_abertas} onChange={e => setForm(f => ({ ...f, inscricoes_abertas: e.target.checked }))} />
          Inscrições abertas
        </label>

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
