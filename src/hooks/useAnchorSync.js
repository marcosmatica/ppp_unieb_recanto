// src/hooks/useAnchorSync.js

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

export function useAnchorSync(iframeRef, observations) {
  const [paragraphs, setParagraphs]   = useState([])
  const [ready, setReady]             = useState(false)
  const [iframeScrollY, setScrollY]   = useState(0)
  const [activeAnchor, setActive]     = useState(null)
  const [pickedAnchor, setPicked]     = useState(null)
  const selectModeRef = useRef(false)

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
        setScrollY(event.data.scrollY || 0)
        return
      }
      if (type === 'PARECER_PARAGRAPH_CLICKED') {
        setActive(event.data.anchorId)
        return
      }
      if (type === 'PARECER_ANCHOR_PICKED') {
        setPicked({ anchorId: event.data.anchorId, text: event.data.text })
        setSelectMode(false)
        return
      }
      if (type === 'PARECER_SELECT_CANCELLED') {
        setSelectMode(false)
        setPicked(null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeRef])

  const counts = useMemo(() => {
    const map = {}
    for (const o of observations) {
      if (!o.anchorId || o.status === 'rejected') continue
      map[o.anchorId] = (map[o.anchorId] || 0) + 1
    }
    return map
  }, [observations])

  useEffect(() => {
    if (!ready) return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PARECER_OBS_COUNTS', counts }, '*'
    )
  }, [counts, ready, iframeRef])

  const highlight = useCallback((anchorId) => {
    setActive(anchorId)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PARECER_HIGHLIGHT', anchorId }, '*'
    )
  }, [iframeRef])

  const hover = useCallback((anchorId) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PARECER_HOVER', anchorId }, '*'
    )
  }, [iframeRef])

  const setSelectMode = useCallback((enabled) => {
    selectModeRef.current = enabled
    if (enabled) setPicked(null)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PARECER_SELECT_MODE', enabled }, '*'
    )
  }, [iframeRef])

  const clearPicked = useCallback(() => setPicked(null), [])

  const positions = computePositions(observations, paragraphs)

  return {
    ready, paragraphs, positions, iframeScrollY, activeAnchor,
    pickedAnchor, clearPicked,
    highlight, hover, setSelectMode,
  }
}

function computePositions(observations, paragraphs) {
  if (!paragraphs.length) return {}

  const pMap = {}
  for (const p of paragraphs) pMap[p.id] = p

  const CARD_MIN_GAP   = 12
  const CARD_H_PENDING  = 160
  const CARD_H_CONFIRM  = 50

  const visible = observations.filter(o => o.status !== 'rejected')

  const sorted = [...visible]
      .map(obs => {
        const p = pMap[obs.anchorId]
        return { obs, top: p ? p.top : 9e9, hasAnchor: !!p }
      })
      .sort((a, b) => a.top - b.top)

  let cursor = 0
  const byId = {}
  for (const { obs, top, hasAnchor } of sorted) {
    const desired  = hasAnchor ? top : cursor
    const finalTop = Math.max(desired, cursor)
    byId[obs.id]   = { top: finalTop, hasAnchor }
    const h = obs.status === 'confirmed' ? CARD_H_CONFIRM : CARD_H_PENDING
    cursor  = finalTop + h + CARD_MIN_GAP
  }
  return byId
}
