// src/components/ResizeBorder.jsx
export default function ResizeBorder({ onMouseDown, isDragging, side = 'right' }) {
  return (
    <div
      className={`resize-border resize-border--${side}${isDragging ? ' resize-border--active' : ''}`}
      onMouseDown={onMouseDown}
    />
  )
}
