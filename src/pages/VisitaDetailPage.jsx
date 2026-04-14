// src/pages/VisitaDetailPage.jsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { visitasService, sessoesService } from '../services/visitasService'
import { METAS_EI } from '../services/indicadoresEI'
import NovaSessaoModal from '../components/visitas/NovaSessaoModal'
import './VisitaDetailPage.css'

export default function VisitaDetailPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()

  const [visita, setVisita] = useState(null)
  const [sessoes, setSessoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    Promise.all([
      visitasService.buscar(visitId),
      sessoesService.listar(visitId),
    ]).then(([v, s]) => {
      setVisita(v)
      setSessoes(s)
      setLoading(false)
    })
  }, [visitId])

  async function handleCriarSessao({ metasCodes, date }) {
    const sessionId = await sessoesService.criar({ visitId, metasCodes, date })
    setShowModal(false)
    navigate(`/visitas/${visitId}/sessoes/${sessionId}`)
  }

  async function handleEncerrar() {
    if (!confirm('Encerrar esta visita? Não será mais possível adicionar sessões.')) return
    await visitasService.encerrar(visitId)
    setVisita(v => ({ ...v, status: 'closed' }))
  }

  if (loading) return <div className="spinner" />

  const metasJaVerificadas = new Set(sessoes.flatMap(s => s.metasCodes ?? []))

  return (
    <div className="visita-detail">
      <div className="vd-header">
        <button className="btn-back" onClick={() => navigate('/visitas')}>← Visitas</button>
        <div className="vd-title">
          <h1>{visita.schoolName}</h1>
          <span className="vd-cre">{visita.cre}</span>
        </div>
        {visita.status === 'open' && (
          <div className="vd-actions">
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + Nova sessão
            </button>
            <button className="btn-danger-outline" onClick={handleEncerrar}>
              Encerrar visita
            </button>
          </div>
        )}
      </div>

      <div className="vd-progress">
        <h2>Cobertura das metas</h2>
        <div className="meta-coverage">
          {METAS_EI.map(meta => (
            <div
              key={meta.code}
              className={`meta-pill ${metasJaVerificadas.has(meta.code) ? 'verified' : 'pending'}`}
              title={meta.label}
            >
              {meta.code}
            </div>
          ))}
        </div>
        <p className="coverage-hint">
          {metasJaVerificadas.size} de {METAS_EI.length} metas verificadas
        </p>
      </div>

      <div className="vd-sessions">
        <h2>Sessões ({sessoes.length})</h2>
        {sessoes.length === 0 ? (
          <p className="empty-hint">Nenhuma sessão registrada.</p>
        ) : (
          sessoes.map(s => (
            <SessaoRow
              key={s.id}
              sessao={s}
              onClick={() => navigate(`/visitas/${visitId}/sessoes/${s.id}`)}
            />
          ))
        )}
      </div>

      {showModal && (
        <NovaSessaoModal
          metasJaVerificadas={metasJaVerificadas}
          onConfirm={handleCriarSessao}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function SessaoRow({ sessao, onClick }) {
  const data = sessao.date?.toDate?.()?.toLocaleDateString('pt-BR') ?? '—'
  const metas = (sessao.metasCodes ?? []).join(', ')
  return (
    <button className={`sessao-row status-${sessao.status}`} onClick={onClick}>
      <span className="sessao-row__date">{data}</span>
      <span className="sessao-row__metas">Metas: {metas}</span>
      <span className={`sessao-row__badge ${sessao.status}`}>
        {sessao.status === 'draft' ? 'Rascunho' : 'Submetida'}
      </span>
    </button>
  )
}
