// src/components/parecer/ParecerLayout.jsx

import { useEffect, useRef, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ObservacaoCard from './ObservacaoCard'
import ObservacaoEditor from './ObservacaoEditor'
import { useAnchorSync } from '../../hooks/useAnchorSync'
import { parecerService } from '../../services/parecerService'
import { useAuth } from '../../contexts/AuthContext'

export default function ParecerLayout({
  analysisId,
  htmlUrl,
  observations,
  filters,
  readOnly,
  selectMode,
  onSelectModeHandled,
}) {
  const { user } = useAuth()
  const iframeRef = useRef(null)
  const {
    ready, positions, activeAnchor, pickedAnchor, clearPicked,
    highlight, hover, setSelectMode,
  } = useAnchorSync(iframeRef, observations)

  const [colHeight, setColHeight] = useState(2000)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (ready) setSelectMode(selectMode)
  }, [selectMode, ready, setSelectMode])

  useEffect(() => {
    if (pickedAnchor) {
      setEditing({
        anchorId:         pickedAnchor.anchorId,
        trechoReferencia: pickedAnchor.text,
        tipo:             'observacao',
        texto:            '',
        label:            'Observação manual',
      })
      clearPicked()
      onSelectModeHandled?.()
    }
  }, [pickedAnchor, clearPicked, onSelectModeHandled])

  const filtered = useMemo(() => {
    return observations.filter(o => {
      if (!filters.showRejected && o.status === 'rejected') return false
      if (filters.tipos.length > 0 && !filters.tipos.includes(o.tipo)) return false
      if (filters.blockCode && o.blockCode !== filters.blockCode) return false
      return true
    })
  }, [observations, filters])

  useEffect(() => {
    const tops = Object.values(positions).map(p => p.top)
    const max = tops.length ? Math.max(...tops) + 260 : 1000
    setColHeight(max)
  }, [positions])

  async function handleSave(data) {
    setSaving(true)
    try {
      if (editing.id) {
        await parecerService.updateObservation(analysisId, editing.id, data, user?.uid)
        toast.success('Observação atualizada')
      } else {
        await parecerService.createObservation(
          analysisId,
          { ...editing, ...data },
          user?.uid
        )
        toast.success('Observação criada')
      }
      setEditing(null)
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function accept(id) {
    try {
      await parecerService.acceptObservation(analysisId, id, user?.uid)
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  async function reject(id) {
    try {
      await parecerService.rejectObservation(analysisId, id, user?.uid)
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  async function restore(id) {
    try {
      await parecerService.restoreObservation(analysisId, id, user?.uid)
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Excluir definitivamente esta observação?')) return
    try {
      await parecerService.deleteObservation(analysisId, id)
      toast.success('Excluída')
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  return (
    <>
      <div className="parecer-layout">
        <div className="parecer-doc-col">
          {htmlUrl ? (
            <iframe
              ref={iframeRef}
              src={htmlUrl}
              title="Documento PPP"
              className="parecer-iframe"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="parecer-empty">Documento não disponível.</div>
          )}
        </div>

        <div
          className="parecer-cards-col"
          style={{ height: ready ? `${colHeight}px` : 'auto' }}
        >
          {!ready && (
            <div className="parecer-cards-loading">Posicionando observações…</div>
          )}

          {ready && filtered.length === 0 && (
            <div className="parecer-cards-empty">
              Nenhuma observação com os filtros atuais.
            </div>
          )}

          {ready && filtered.map(obs => (
            <ObservacaoCard
              key={obs.id}
              observation={obs}
              position={positions[obs.id]}
              isActive={activeAnchor === obs.anchorId}
              readOnly={readOnly}
              onHover={() => hover(obs.anchorId)}
              onLeave={() => hover(null)}
              onClick={() => highlight(obs.anchorId)}
              onEdit={() => setEditing(obs)}
              onAccept={() => accept(obs.id)}
              onReject={() => reject(obs.id)}
              onRestore={() => restore(obs.id)}
              onDelete={() => remove(obs.id)}
            />
          ))}
        </div>
      </div>

      {editing && (
        <ObservacaoEditor
          observation={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </>
  )
}
