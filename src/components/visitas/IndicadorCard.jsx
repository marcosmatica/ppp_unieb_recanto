// src/components/visitas/IndicadorCard.jsx

import { DESCRIPTOR_LABELS } from '../../services/indicadoresEI'
import GaleriaEvidencias from './GaleriaEvidencias'
import './IndicadorCard.css'

const LEVEL_COLORS = ['', 'danger', 'warning', 'warning', 'success', 'success']

export default function IndicadorCard({
  indicador, resposta, onChange,
  visitId, sessionId, readOnly = false,
}) {
  const nivel = resposta.descriptorLevel ?? null

  return (
    <div className="ic-root">
      <div className="ic-header">
        <span className="ic-code">{indicador.code}</span>
        <h2 className="ic-title">{indicador.label}</h2>
      </div>

      <div className="ic-resultado">
        <span className="ic-resultado__label">Resultado esperado</span>
        <p className="ic-resultado__text">{indicador.resultadoEsperado}</p>
      </div>

      <div className="ic-parametros">
        <span className="ic-section-label">Parâmetros de aferição</span>
        <ol className="ic-parametros__list">
          {indicador.parametros.map((p, i) => (
            <li
              key={i}
              className={`ic-param ${nivel !== null && nivel >= i + 1 ? 'met' : ''}`}
            >
              <span className="ic-param__num">{i + 1}</span>
              <span className="ic-param__text">{p}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="ic-nivel">
        <span className="ic-section-label">Nível observado</span>
        <div className="ic-nivel__scale">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              className={`ic-nivel__btn color-${LEVEL_COLORS[n]} ${nivel === n ? 'selected' : ''}`}
              onClick={() => !readOnly && onChange('descriptorLevel', nivel === n ? null : n)}
              disabled={readOnly}
            >
              <span className="ic-nivel__num">{n}</span>
              <span className="ic-nivel__label">{DESCRIPTOR_LABELS[n]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ic-obs">
        <label className="ic-section-label" htmlFor={`obs-${indicador.code}`}>
          Observações
        </label>
        <textarea
          id={`obs-${indicador.code}`}
          className="ic-obs__input"
          rows={4}
          placeholder="Descreva o que foi observado durante a visita…"
          value={resposta.observation ?? ''}
          onChange={e => !readOnly && onChange('observation', e.target.value)}
          readOnly={readOnly}
        />
      </div>

      <div className="ic-galeria">
        <span className="ic-section-label">Evidências fotográficas</span>
        <GaleriaEvidencias
          visitId={visitId}
          sessionId={sessionId}
          indicatorCode={indicador.code}
          urls={resposta.evidenceUrls ?? []}
          onChange={urls => onChange('evidenceUrls', urls)}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
