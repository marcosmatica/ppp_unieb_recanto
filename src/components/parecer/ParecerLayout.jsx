// src/components/parecer/ParecerLayout.jsx

import { useEffect, useRef, useMemo, useState } from 'react'
import ObservacaoCard from './ObservacaoCard'
import { useAnchorSync } from '../../hooks/useAnchorSync'

export default function ParecerLayout({ htmlUrl, observations, filters }) {
  const iframeRef = useRef(null)
  const { ready, positions, iframeScrollY, activeAnchor, highlight, hover } =
    useAnchorSync(iframeRef, observations)

  const [colHeight, setColHeight] = useState(2000)

  const filtered = useMemo(() => {
    return observations.filter(o => {
      if (filters.tipos.length > 0 && !filters.tipos.includes(o.tipo)) return false
      if (filters.blockCode && o.blockCode !== filters.blockCode) return false
      return true
    })
  }, [observations, filters])

  useEffect(() => {
    const tops = Object.values(positions).map(p => p.top)
    const max = tops.length ? Math.max(...tops) + 240 : 1000
    setColHeight(max)
  }, [positions])

  return (
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
            onHover={() => hover(obs.anchorId)}
            onLeave={() => hover(null)}
            onClick={() => highlight(obs.anchorId)}
          />
        ))}
      </div>
    </div>
  )
}
