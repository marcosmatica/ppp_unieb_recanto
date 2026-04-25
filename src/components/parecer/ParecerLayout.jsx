// src/components/parecer/ParecerLayout.jsx

import { useEffect, useRef, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ObservacaoCard from './ObservacaoCard'
import ObservacaoGroup from './ObservacaoGroup'
import ObservacaoEditor from './ObservacaoEditor'
import ResizeBorder from '../ResizeBorder'
import { useAnchorSync } from '../../hooks/useAnchorSync'
import { useColResize } from '../../hooks/useColResize'
import { parecerService } from '../../services/parecerService'
import { useAuth } from '../../contexts/AuthContext'

const TIPO_PRIORITY = { nao_conformidade: 0, ajuste: 1, observacao: 2, conformidade: 3, info: 4 }

function sortObs(list) {
  return [...list].sort((a, b) => {
    const sa = (a.status === 'auto' || a.status === 'manual') ? 0 : 1
    const sb = (b.status === 'auto' || b.status === 'manual') ? 0 : 1
    if (sa !== sb) return sa - sb
    return (TIPO_PRIORITY[a.tipo] ?? 5) - (TIPO_PRIORITY[b.tipo] ?? 5)
  })
}

export default function ParecerLayout({
  analysisId, htmlUrl, observations, filters, readOnly, selectMode, onSelectModeHandled,
}) {
  const { user } = useAuth()
  const iframeRef   = useRef(null)
  const cardsColRef = useRef(null)

  const { ready, positions, activeAnchor, pickedAnchor, clearPicked, highlight, hover, setSelectMode }
    = useAnchorSync(iframeRef, observations)

  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [cardsWidth, onResizeMouseDown, isResizing] = useColResize('card', 380, 180, 720)

  useEffect(() => { if (ready) setSelectMode(selectMode) }, [selectMode, ready, setSelectMode])

  useEffect(() => {
    if (!pickedAnchor) return
    setEditing({ anchorId: pickedAnchor.anchorId, trechoReferencia: pickedAnchor.text, tipo: 'observacao', texto: '', label: 'Observação manual' })
    clearPicked()
    onSelectModeHandled?.()
  }, [pickedAnchor, clearPicked, onSelectModeHandled])

  const filtered = useMemo(() => observations.filter(o => {
    if (!filters.showRejected && o.status === 'rejected') return false
    if (filters.tipos.length > 0 && !filters.tipos.includes(o.tipo)) return false
    if (filters.blockCode && o.blockCode !== filters.blockCode) return false
    return true
  }), [observations, filters])

  // Agrupar por label, ordenar grupos por prioridade
  const renderItems = useMemo(() => {
    const map = new Map()
    for (const obs of sortObs(filtered)) {
      if (!map.has(obs.label)) map.set(obs.label, [])
      map.get(obs.label).push(obs)
    }

    const groups = [...map.entries()].map(([label, items]) => ({ label, items }))

    // Ordenar grupos: pendentes primeiro, depois por pior tipo
    groups.sort((a, b) => {
      const aHasPending = a.items.some(o => o.status === 'auto' || o.status === 'manual') ? 0 : 1
      const bHasPending = b.items.some(o => o.status === 'auto' || o.status === 'manual') ? 0 : 1
      if (aHasPending !== bHasPending) return aHasPending - bHasPending
      const aWorst = Math.min(...a.items.map(o => TIPO_PRIORITY[o.tipo] ?? 5))
      const bWorst = Math.min(...b.items.map(o => TIPO_PRIORITY[o.tipo] ?? 5))
      return aWorst - bWorst
    })

    return groups
  }, [filtered])

  useEffect(() => {
    cardsColRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [filters])

  async function handleSave(data) {
    setSaving(true)
    try {
      if (editing.id) {
        await parecerService.updateObservation(analysisId, editing.id, data, user?.uid)
        toast.success('Observação atualizada')
      } else {
        await parecerService.createObservation(analysisId, { ...editing, ...data }, user?.uid)
        toast.success('Observação criada')
      }
      setEditing(null)
    } catch (e) { toast.error('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  async function accept(id)  { try { await parecerService.acceptObservation(analysisId, id, user?.uid)  } catch (e) { toast.error(e.message) } }
  async function reject(id)  { try { await parecerService.rejectObservation(analysisId, id, user?.uid)  } catch (e) { toast.error(e.message) } }
  async function restore(id) { try { await parecerService.restoreObservation(analysisId, id, user?.uid) } catch (e) { toast.error(e.message) } }
  async function remove(id)  {
    if (!confirm('Excluir definitivamente esta observação?')) return
    try { await parecerService.deleteObservation(analysisId, id); toast.success('Excluída') }
    catch (e) { toast.error(e.message) }
  }

  const handlers = {
    onHover:   (anchorId) => hover(anchorId),
    onLeave:   () => hover(null),
    onClick:   (anchorId) => highlight(anchorId),
    onEdit:    (obs) => setEditing(obs),
    onAccept:  (id) => accept(id),
    onReject:  (id) => reject(id),
    onRestore: (id) => restore(id),
    onDelete:  (id) => remove(id),
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
              style={isResizing ? { pointerEvents: 'none' } : undefined}
            />
          ) : (
            <div className="parecer-empty">Documento não disponível.</div>
          )}
        </div>

        <div
          ref={cardsColRef}
          className={`parecer-cards-col${isResizing ? ' col--dragging' : ''}`}
          style={{ width: `${cardsWidth}px` }}
        >
          <ResizeBorder onMouseDown={onResizeMouseDown} isDragging={isResizing} side="left" />

          {!ready && <div className="parecer-cards-loading">Carregando observações…</div>}

          {ready && renderItems.length === 0 && (
            <div className="parecer-cards-empty">Nenhuma observação com os filtros atuais.</div>
          )}

          {ready && renderItems.map(({ label, items }) =>
            items.length === 1 ? (
              <ObservacaoCard
                key={items[0].id}
                observation={items[0]}
                position={{ hasAnchor: positions[items[0].id]?.hasAnchor }}
                isActive={activeAnchor === items[0].anchorId}
                readOnly={readOnly}
                onHover={() => handlers.onHover(items[0].anchorId)}
                onLeave={handlers.onLeave}
                onClick={() => handlers.onClick(items[0].anchorId)}
                onEdit={() => handlers.onEdit(items[0])}
                onAccept={() => handlers.onAccept(items[0].id)}
                onReject={() => handlers.onReject(items[0].id)}
                onRestore={() => handlers.onRestore(items[0].id)}
                onDelete={() => handlers.onDelete(items[0].id)}
              />
            ) : (
              <ObservacaoGroup
                key={label}
                label={label}
                items={items}
                positions={positions}
                activeAnchor={activeAnchor}
                readOnly={readOnly}
                {...handlers}
              />
            )
          )}
        </div>
      </div>

      {editing && (
        <ObservacaoEditor observation={editing} onSave={handleSave} onClose={() => setEditing(null)} saving={saving} />
      )}
    </>
  )
}
