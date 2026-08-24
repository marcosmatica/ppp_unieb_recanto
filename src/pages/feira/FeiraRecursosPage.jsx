import { useState, useEffect } from 'react'
import { feiraEdicoesService, feiraRecursosService, feiraPublicaService } from '../../services/feiraService'
import { useAuth } from '../../contexts/AuthContext'
import { CRITERIOS_AVALIACAO, VALORES_NOTA } from '../../constants/feiraConstants'
import toast from 'react-hot-toast'

export default function FeiraRecursosPage() {
  const { user, profile } = useAuth()
  const [recursos, setRecursos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      if (!ed) { setLoading(false); return }
      const lista = await feiraRecursosService.listarPorEdicao(ed.id)
      setRecursos(lista)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function decidir(recursoId, status, parecer, notasRevisadas) {
    try {
      await feiraRecursosService.atualizar(recursoId, {
        status,
        parecer_comissao: parecer,
        decidido_em: new Date().toISOString(),
        decidido_por: { uid: user.uid, nome: profile?.name },
      })
      if (status === 'deferido' && notasRevisadas && Object.keys(notasRevisadas).length > 0) {
        await feiraPublicaService.recalcularRecurso(recursoId, notasRevisadas)
        toast.success('Recurso deferido e nota recalculada')
      } else {
        toast.success(`Recurso ${status}`)
      }
      await carregar()
    } catch (e) {
      console.error(e)
      toast.error('Erro')
    }
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>

  return (
    <div style={{ padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Recursos</h1>

      {recursos.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhum recurso registrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recursos.map(r => (
            <RecursoCard key={r.id} recurso={r} onDecidir={decidir} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecursoCard({ recurso, onDecidir }) {
  const [parecer, setParecer] = useState(recurso.parecer_comissao || '')
  const [notasRevisadas, setNotasRevisadas] = useState({})
  const statusCor = { pendente: '#eab308', deferido: '#16a34a', indeferido: '#dc2626' }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Inscrição: {recurso.inscricao_id}</strong>
        <span style={{ fontSize: 12, fontWeight: 600, color: statusCor[recurso.status] || '#6b7280' }}>
          {recurso.status?.toUpperCase()}
        </span>
      </div>

      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <strong>Itens contestados:</strong> {recurso.itens_contestados?.join(', ')}
      </div>

      {recurso.justificativas && Object.entries(recurso.justificativas).map(([k, v]) => (
        <div key={k} style={{ fontSize: 12, marginBottom: 4 }}>
          <strong>{k}:</strong> {v}
        </div>
      ))}

      {recurso.status === 'pendente' && (
        <>
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Notas revisadas (para deferimento):</strong>
            {(recurso.itens_contestados || []).map(key => {
              const criterio = CRITERIOS_AVALIACAO.find(c => c.key === key)
              if (!criterio) return null
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{criterio.label}</span>
                  <select
                    value={notasRevisadas[key] ?? ''}
                    onChange={e => setNotasRevisadas(n => ({ ...n, [key]: parseFloat(e.target.value) }))}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
                  >
                    <option value="">—</option>
                    {VALORES_NOTA.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                  </select>
                </div>
              )
            })}
          </div>

          <textarea value={parecer} onChange={e => setParecer(e.target.value)} rows={2} placeholder="Parecer da comissão..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => onDecidir(recurso.id, 'deferido', parecer, notasRevisadas)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Deferir</button>
            <button onClick={() => onDecidir(recurso.id, 'indeferido', parecer)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Indeferir</button>
          </div>
        </>
      )}

      {recurso.status === 'deferido' && recurso.nota_recalculada != null && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          Nota recalculada: {recurso.nota_recalculada.toFixed(1)}
        </div>
      )}
    </div>
  )
}
