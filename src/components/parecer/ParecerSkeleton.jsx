// src/components/parecer/ParecerSkeleton.jsx

export default function ParecerSkeleton() {
  return (
    <div className="parecer-page">
      <div className="parecer-toolbar sk-toolbar">
        <div className="sk-block" style={{ width: 200, height: 20 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[120, 100, 110].map((w, i) => (
            <div key={i} className="sk-block" style={{ width: w, height: 32, borderRadius: 20 }} />
          ))}
        </div>
        <div className="sk-block" style={{ width: 120, height: 34 }} />
      </div>

      <div className="parecer-status">
        <div style={{ display: 'flex', gap: 12 }}>
          {[80, 100, 70].map((w, i) => (
            <div key={i} className="sk-block" style={{ width: w, height: 16 }} />
          ))}
        </div>
        <div className="sk-block" style={{ width: 140, height: 32 }} />
      </div>

      <div className="parecer-layout" style={{ overflow: 'hidden' }}>
        <div className="parecer-doc-col" style={{ background: '#f1f5f9' }}>
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sk-block" style={{ width: '60%', height: 28 }} />
            {[100, 95, 88, 100, 92, 80, 96, 100, 85].map((w, i) => (
              <div key={i} className="sk-block" style={{ width: `${w}%`, height: 14 }} />
            ))}
            <div className="sk-block" style={{ width: '45%', height: 22, marginTop: 8 }} />
            {[100, 93, 97, 100, 88].map((w, i) => (
              <div key={i} className="sk-block" style={{ width: `${w}%`, height: 14 }} />
            ))}
          </div>
        </div>

        <div className="parecer-cards-col" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '1rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="sk-block" style={{ height: 110, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
