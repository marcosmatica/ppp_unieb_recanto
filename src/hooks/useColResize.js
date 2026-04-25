// src/hooks/useColResize.js
import { useState, useRef, useCallback } from 'react'

export function useColResize(colKey, defaultWidth, min, max) {
  const [width, setWidth]           = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = width
    setIsDragging(true)
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      const delta = colKey === 'card'
        ? startX.current - ev.clientX
        : ev.clientX - startX.current
      setWidth(Math.min(max, Math.max(min, startW.current + delta)))
    }
    const onUp = () => {
      setIsDragging(false)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, colKey, min, max])

  return [width, onMouseDown, isDragging]
}
