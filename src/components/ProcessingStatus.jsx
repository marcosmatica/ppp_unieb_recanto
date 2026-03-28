const PROCESSING_STEPS = [
    { key: 'pending',    label: 'Aguardando início…',           done: false },
    { key: 'extracting', label: 'Extraindo texto do documento…', done: false },
    { key: 'analyzing',  label: 'Analisando com IA (Haiku)…',   done: false },
]

function ProcessingStatus({ status, schoolName }) {
    const currentIdx = PROCESSING_STEPS.findIndex(s => s.key === status)

    return (
        <div className="ps-wrapper">
            <div className="ps-card">
                <div className="ps-icon-wrap">
                    <Loader2 size={32} className="ps-spinner" />
                </div>
                <h2 className="ps-title">Analisando documento</h2>
                {schoolName && <p className="ps-school">{schoolName}</p>}
                <p className="ps-subtitle">
                    A IA está verificando o PPP contra os critérios da Portaria SEEDF nº 139/2024.
                    Isso costuma levar entre 1 e 3 minutos.
                </p>

                <div className="ps-steps">
                    {PROCESSING_STEPS.map((step, i) => {
                        const isDone    = i < currentIdx
                        const isCurrent = i === currentIdx
                        return (
                            <div
                                key={step.key}
                                className={`ps-step ${isDone ? 'ps-step--done' : ''} ${isCurrent ? 'ps-step--active' : ''}`}
                            >
                                <div className="ps-step-dot">
                                    {isDone ? <CheckCircle2 size={14} /> : isCurrent ? <Loader2 size={14} className="ps-spin-sm" /> : null}
                                </div>
                                <span className="ps-step-label">{step.label}</span>
                            </div>
                        )
                    })}
                </div>

                <p className="ps-hint">
                    A página será atualizada automaticamente quando a análise for concluída.
                </p>
            </div>
        </div>
    )
}