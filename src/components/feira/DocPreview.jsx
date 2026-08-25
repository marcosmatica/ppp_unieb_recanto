import { useState } from 'react'

export default function DocPreview({ url, nome, label = 'Visualizar' }) {
  const [open, setOpen] = useState(false)
  if (!url) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          border: '1px solid #d1d5db', background: '#fff', color: '#2563eb',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, overflow: 'hidden',
              width: '100%', maxWidth: 960, height: '90vh',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', borderBottom: '1px solid #e5e7eb',
            }}>
              <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nome || 'Documento'}
              </strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>Abrir em nova aba</a>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}
                >×</button>
              </div>
            </div>
            <iframe
              src={url}
              title={nome || 'Documento'}
              style={{ flex: 1, width: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
