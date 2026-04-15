// src/pages/VisitasPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { visitasService } from '../services/visitasService'
import { schoolsService } from '../services/firebase'
import NovaVisitaModal from '../components/visitas/NovaVisitaModal'
import './VisitasPage.css'

export default function VisitasPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [visitas, setVisitas]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    visitasService.listarPorCI(user.uid)
      .then(data => setVisitas(data))
      .catch(err => console.error('listarPorCI:', err))
      .finally(() => setLoading(false))
  }, [user?.uid])

  async function handleCriarVisita({ schoolId, schoolName, cre }) {
    const visitId = await visitasService.criar({
      schoolId,
      schoolName,
      cre,
      ciId:   user.uid,
      ciName: profile?.name ?? user.displayName,
    })
    setShowModal(false)
    navigate(`/visitas/${visitId}`)
  }

  const abertas  = visitas.filter(v => v.status === 'open')
  const fechadas = visitas.filter(v => v.status === 'closed')

  return (
    <div className="visitas-page">
      <div className="visitas-header">
        <h1>Visitas — Educação Infantil</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Nova visita
        </button>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <section>
            <h2>Em andamento ({abertas.length})</h2>
            {abertas.length === 0 ? (
              <p className="empty-hint">Nenhuma visita aberta.</p>
            ) : (
              <div className="visitas-grid">
                {abertas.map(v => (
                  <VisitaCard key={v.id} visita={v} onClick={() => navigate(`/visitas/${v.id}`)} />
                ))}
              </div>
            )}
          </section>

          {fechadas.length > 0 && (
            <section>
              <h2>Encerradas ({fechadas.length})</h2>
              <div className="visitas-grid">
                {fechadas.map(v => (
                  <VisitaCard key={v.id} visita={v} onClick={() => navigate(`/visitas/${v.id}`)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {showModal && (
        <NovaVisitaModal
          onConfirm={handleCriarVisita}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function VisitaCard({ visita, onClick }) {
  const data = visita.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') ?? '—'
  return (
    <button className={`visita-card status-${visita.status}`} onClick={onClick}>
      <span className="visita-card__school">{visita.schoolName}</span>
      <span className="visita-card__cre">{visita.cre}</span>
      <span className="visita-card__date">{data}</span>
      <span className={`visita-card__badge ${visita.status}`}>
        {visita.status === 'open' ? 'Em andamento' : 'Encerrada'}
      </span>
    </button>
  )
}
