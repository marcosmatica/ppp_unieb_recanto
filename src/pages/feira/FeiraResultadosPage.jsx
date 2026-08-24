import { useState, useEffect } from 'react'
import { feiraEdicoesService, feiraInscricoesService, feiraPublicaService } from '../../services/feiraService'
import { CATEGORIAS } from '../../constants/feiraConstants'
import { usePermissoes } from '../../hooks/usePermissoes'
import StatusBadge from '../../components/feira/StatusBadge'
import toast from 'react-hot-toast'

export default function FeiraResultadosPage() {
  const [inscricoes, setInscricoes] = useState([])
  const [edicao, setEdicao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState('')
  const [processando, setProcessando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const { isAdmin } = usePermissoes()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const ed = await feiraEdicoesService.getAtiva()
      if (!ed) { setLoading(false); return }
      setEdicao(ed)
      const lista = await feiraInscricoesService.listarPorEdicao(ed.id)
      setInscricoes(lista.filter(i => i.nota_com_bonus != null || i.nota_final != null || i.status === 'avaliada'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function calcularResultados() {
    if (!categoria || !edicao) { toast.error('Selecione uma categoria'); return }
    setProcessando(true)
    try {
      const res = await feiraPublicaService.calcularResultados(edicao.id, categoria)
      toast.success(`Ranking calculado: ${res.data.ranking?.length || 0} projetos`)
      await carregar()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao calcular resultados')
    } finally {
      setProcessando(false)
    }
  }

  async function exportarSEI() {
    if (!edicao) return
    setExportando(true)
    try {
      const res = await feiraPublicaService.gerarRelatorioSEI(edicao.id, categoria || null)
      const { downloadUrl, fileName } = res.data
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('Relatório SEI gerado com sucesso')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao gerar relatório SEI')
    } finally {
      setExportando(false)
    }
  }

  async function publicarFinal() {
    if (!edicao) return
    setProcessando(true)
    try {
      const res = await feiraPublicaService.publicarResultadoFinal(edicao.id)
      toast.success(`Resultado final publicado: ${res.data.total} inscrições`)
      await carregar()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao publicar resultado final')
    } finally {
      setProcessando(false)
    }
  }

  const filtradas = inscricoes
    .filter(i => !categoria || i.categoria === categoria)
    .sort((a, b) => (b.nota_com_bonus ?? b.nota_final ?? 0) - (a.nota_com_bonus ?? a.nota_final ?? 0))

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>

  return (
    <div style={{ padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Resultados</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {isAdmin && categoria && (
          <button onClick={calcularResultados} disabled={processando} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Calcular ranking ({categoria})
          </button>
        )}

        {isAdmin && edicao && filtradas.length > 0 && (
          <button onClick={exportarSEI} disabled={exportando} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {exportando ? 'Gerando...' : `Exportar relatório SEI${categoria ? ` (${categoria})` : ''}`}
          </button>
        )}

        {isAdmin && edicao && !edicao.resultado_final_publicado && (
          <button onClick={publicarFinal} disabled={processando} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Publicar resultado final
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhum resultado disponível.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Título</th>
              <th style={thStyle}>Escola</th>
              <th style={thStyle}>Cat.</th>
              <th style={thStyle}>Nota</th>
              <th style={thStyle}>Distrital</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((i, idx) => (
              <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{idx + 1}</td>
                <td style={tdStyle}>{i.titulo}</td>
                <td style={tdStyle}>{i.escola?.nome}</td>
                <td style={tdStyle}>{i.categoria}</td>
                <td style={tdStyle}><strong>{(i.nota_com_bonus ?? i.nota_final ?? 0).toFixed(1)}</strong></td>
                <td style={tdStyle}>{i.classificacao?.classificada_distrital ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Sim</span> : '—'}</td>
                <td style={tdStyle}><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 }
const tdStyle = { padding: '8px 12px' }
