const STEPS = [
  { key: 'orientador', label: 'Orientador e Equipe' },
  { key: 'projeto', label: 'Projeto' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'revisao', label: 'Revisão' },
]

export default function WizardSteps({ current, onStep }) {
  const idx = STEPS.findIndex(s => s.key === current)
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
      {STEPS.map((step, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <button
            key={step.key}
            onClick={() => i <= idx && onStep?.(step.key)}
            disabled={i > idx}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderBottom: `3px solid ${active ? 'var(--primary, #2563eb)' : done ? 'var(--success, #16a34a)' : '#e5e7eb'}`,
              background: 'none',
              cursor: i <= idx ? 'pointer' : 'default',
              opacity: i > idx ? 0.4 : 1,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary, #2563eb)' : 'inherit',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 11, display: 'block', marginBottom: 2, color: done ? 'var(--success, #16a34a)' : undefined }}>
              {done ? '✓' : i + 1}
            </span>
            {step.label}
          </button>
        )
      })}
    </div>
  )
}

export { STEPS }
