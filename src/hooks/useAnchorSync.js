// src/hooks/useAnchorSync.js

import { useEffect, useRef, useState, useCallback } from 'react'

export function useAnchorSync(iframeRef, observations) {
  const [paragraphs, setParagraphs] = useState([])
  const [ready, setReady] = useState(false)
  const [iframeScrollY, setIframeScrollY] = useState(0)
  const [activeAnchor, setActiveAnchor] = useState(null)

  useEffect(() => {
    function onMessage(event) {
      const { type } = event.data || {}

      if (type === 'PARECER_IFRAME_READY') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'PARECER_INIT' }, '*')
        return
      }

      if (type === 'PARECER_READY') {
        setParagraphs(event.data.paragraphs || [])
        setReady(true)
        return
      }

      if (type === 'PARECER_SCROLL') {
        setIframeScrollY(event.data.scrollY || 0)
        return
      }

      if (type === 'PARECER_PARAGRAPH_CLICKED') {
        setActiveAnchor(event.data.anchorId)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeRef])

  const highlight = useCallback((anchorId) => {
    setActiveAnchor(anchorId)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PARECER_HIGHLIGHT', anchorId },
      '*'
    )
  }, [iframeRef])

  const hover = useCallback((anchorId) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PARECER_HOVER', anchorId },
      '*'
    )
  }, [iframeRef])

  const positions = computePositions(observations, paragraphs)

  return { ready, paragraphs, positions, iframeScrollY, activeAnchor, highlight, hover }
}

function computePositions(observations, paragraphs) {
  if (!paragraphs.length) return []

  const pMap = {}
  for (const p of paragraphs) pMap[p.id] = p

  const CARD_MIN_GAP = 12
  const CARD_ESTIMATED_H = 120

  const sorted = [...observations]
    .map(obs => {
      const p = pMap[obs.anchorId]
      return { obs, top: p ? p.top : 9e9, hasAnchor: !!p }
    })
    .sort((a, b) => a.top - b.top)

  let cursor = 0
  const withTop = sorted.map(({ obs, top, hasAnchor }) => {
    const desired = hasAnchor ? top : cursor
    const finalTop = Math.max(desired, cursor)
    cursor = finalTop + CARD_ESTIMATED_H + CARD_MIN_GAP
    return { id: obs.id, top: finalTop, hasAnchor }
  })

  const byId = {}
  for (const r of withTop) byId[r.id] = r
  return byId
}
