import { useState } from 'react'

const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_BASE_URL
  || 'https://southamerica-east1-unieb-recanto.cloudfunctions.net'

function emailPermitido(email) {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export default function FeiraPortal() {
  const [step, setStep] = useState('inep')
  const [inep, setInep] = useState('')
  const [email, setEmail] = useState('')
  const [escola, setEscola] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(false)

  async function buscarEscola(e) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const resp = await fetch(`${FUNCTIONS_BASE}/feiraLookupEscola`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inep: inep.trim() }),
      })
      const data = await resp.json()
      if (!resp.ok) { setErro(data.error); setLoading(false); return }
      setEscola(data)
      setStep('email')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function enviarLink(e) {
    e.preventDefault()
    setErro(null)
    if (!emailPermitido(email)) {
      setErro('Informe um e-mail válido.')
      return
    }
    setLoading(true)
    try {
      const resp = await fetch(`${FUNCTIONS_BASE}/feiraEnviarLinkEmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inep: inep.trim(), email: email.trim() }),
      })
      const data = await resp.json()
      if (!resp.ok) { setErro(data.error); setLoading(false); return }
      setSucesso(true)
      setStep('sucesso')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: 'DM Sans, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 480, width: '100%', padding: '40px 28px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#2563eb',
          marginBottom: 8, letterSpacing: '.5px', textAlign: 'center',
        }}>
          CCEP-DF · ETAPA REGIONAL
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          margin: '0 0 8px', color: '#111827',
        }}>
          Portal de Inscrição
        </h1>
        <p style={{
          fontSize: 14, color: '#6b7280', textAlign: 'center',
          margin: '0 0 32px',
        }}>
          15º Circuito de Ciências das Escolas Públicas do DF
        </p>

        <div style={{
          background: '#fff', borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,.1)',
          padding: 28,
        }}>
          {step === 'inep' && (
            <form onSubmit={buscarEscola}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Código INEP da escola
              </label>
              <input
                type="text"
                value={inep}
                onChange={e => setInep(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 00000000"
                maxLength={8}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 15, marginBottom: 16,
                  outline: 'none',
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
                Digite o código INEP de 8 dígitos da sua escola para localizar o link de inscrição.
              </p>
              {erro && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{erro}</p>}
              <button
                type="submit"
                disabled={loading || inep.length < 4}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
                  background: loading || inep.length < 4 ? '#93c5fd' : '#2563eb',
                  color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading ? 'Buscando...' : 'Buscar escola'}
              </button>
            </form>
          )}

          {step === 'email' && escola && (
            <form onSubmit={enviarLink}>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#166534' }}>
                  {escola.escola_nome}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  INEP {escola.escola_inep} · CRE {escola.escola_cre}
                </div>
                {escola.edicao_tema && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {escola.edicao_tema} — {escola.edicao_ano}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {escola.inscricoes_abertas
                    ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Inscrições abertas</span>
                    : <span style={{ color: '#dc2626', fontWeight: 600 }}>Inscrições encerradas</span>
                  }
                </div>
              </div>

              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Seu email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 15, marginBottom: 6,
                  outline: 'none',
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
                O link de inscrição da sua escola será enviado para este email.
              </p>
              {erro && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{erro}</p>}
              <button
                type="submit"
                disabled={loading || !emailPermitido(email)}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
                  background: loading || !emailPermitido(email) ? '#93c5fd' : '#2563eb',
                  color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                  marginBottom: 10,
                }}
              >
                {loading ? 'Enviando...' : 'Enviar link por email'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('inep'); setEscola(null); setErro(null) }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8,
                  border: '1px solid #d1d5db', background: 'transparent',
                  color: '#6b7280', fontSize: 13, cursor: 'pointer',
                }}
              >
                Voltar
              </button>
            </form>
          )}

          {step === 'sucesso' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
                Link enviado!
              </h2>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                O link de inscrição foi enviado para <strong>{email}</strong>.
              </p>
              <div style={{
                background: '#fef3c7', border: '1px solid #fcd34d',
                color: '#92400e', borderRadius: 8, padding: '10px 12px',
                fontSize: 13, marginBottom: 20, textAlign: 'left',
              }}>
                ⚠️ <strong>Atenção:</strong> é possível que o e-mail esteja na
                <strong> caixa de spam</strong> ou lixo eletrônico. Verifique também
                essas pastas caso não encontre na caixa de entrada.
              </div>
              <button
                onClick={() => { setStep('inep'); setInep(''); setEmail(''); setEscola(null); setSucesso(false); setErro(null) }}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  border: '1px solid #d1d5db', background: 'transparent',
                  color: '#374151', fontSize: 13, cursor: 'pointer',
                }}
              >
                Buscar outra escola
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
