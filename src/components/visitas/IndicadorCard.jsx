// src/components/visitas/IndicadorCard.jsx

import { useMemo } from 'react'
import { DESCRIPTOR_LABELS } from '../../services/indicadoresEI'
import GaleriaEvidencias from './GaleriaEvidencias'
import './IndicadorCard.css'

const LEVEL_COLORS = ['', 'danger', 'warning', 'warning', 'success', 'success']
const LEVEL_EMOJI  = ['', '😟', '😕', '🙂', '😊', '🌟']

function levelToColor(n) {
  return LEVEL_COLORS[n] || ''
}

function computeSuggestedLevel(paramLevels, total) {
  const values = Object.values(paramLevels).filter(v => typeof v === 'number')
  if (values.length < total) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.round(avg)
}

export default function IndicadorCard({
  indicador, resposta, onChange,
  visitId, sessionId, readOnly = false,
}) {
  const paramLevels = resposta.paramLevels ?? {}
  const nivel = resposta.descriptorLevel ?? null
  const totalParams = indicador.parametros.length

  const preenchidosParams = Object.values(paramLevels).filter(v => typeof v === 'number').length
  const progressoParams = totalParams > 0 ? preenchidosParams / totalParams : 0
  const sugerido = computeSuggestedLevel(paramLevels, totalParams)
  const usouSugestao = sugerido !== null && nivel === sugerido

  const { xp, streak } = useMemo(() => {
    let xp = preenchidosParams * 10
    if (nivel !== null) xp += 20
    if ((resposta.observation ?? '').trim().length >= 20) xp += 15
    if ((resposta.evidenceUrls ?? []).length > 0) xp += 25
    let streak = 0
    const ordered = indicador.parametros.map((_, i) => paramLevels[i])
    for (const v of ordered) {
      if (typeof v === 'number') streak++
      else break
    }
    return { xp, streak }
  }, [paramLevels, nivel, resposta.observation, resposta.evidenceUrls, indicador.parametros, preenchidosParams])

  const badges = []
  if (progressoParams >= 0.25) badges.push({ icon: '🌱', label: 'Início' })
  if (progressoParams >= 0.5)  badges.push({ icon: '🚀', label: 'Metade' })
  if (progressoParams === 1)   badges.push({ icon: '🏆', label: 'Completo' })
  if (streak >= 3)             badges.push({ icon: '🔥', label: `Sequência x${streak}` })
  if ((resposta.evidenceUrls ?? []).length >= 3) badges.push({ icon: '📸', label: 'Documentado' })

  function handleParamLevel(idx, n) {
    if (readOnly) return
    const next = { ...paramLevels }
    if (next[idx] === n) delete next[idx]
    else next[idx] = n
    onChange('paramLevels', next)
  }

  function handleIndicadorLevel(n) {
    if (readOnly) return
    onChange('descriptorLevel', nivel === n ? null : n)
  }

  function aplicarSugestao() {
    if (readOnly || sugerido === null) return
    onChange('descriptorLevel', sugerido)
  }

  return (
    <div className="ic-root">
      <div className="ic-header">
        <span className="ic-code">{indicador.code}</span>
        <h2 className="ic-title">{indicador.label}</h2>
      </div>

      <div className="ic-gamify">
        <div className="ic-gamify__progress">
          <div className="ic-gamify__bar-wrap">
            <div
              className="ic-gamify__bar"
              style={{ width: `${progressoParams * 100}%` }}
            />
          </div>
          <span className="ic-gamify__count">
            {preenchidosParams}/{totalParams}
          </span>
        </div>
        <div className="ic-gamify__xp">
          <span className="ic-gamify__xp-value">+{xp}</span>
          <span className="ic-gamify__xp-label">XP</span>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="ic-badges">
          {badges.map((b, i) => (
            <span key={i} className="ic-badge" title={b.label}>
              <span className="ic-badge__icon">{b.icon}</span>
              <span className="ic-badge__label">{b.label}</span>
            </span>
          ))}
        </div>
      )}

      <div className="ic-resultado">
        <span className="ic-resultado__label">Resultado esperado</span>
        <p className="ic-resultado__text">{indicador.resultadoEsperado}</p>
      </div>

      <div className="ic-parametros">
        <div className="ic-parametros__head">
          <span className="ic-section-label">Parâmetros de aferição</span>
          <span className="ic-parametros__hint">Avalie cada um</span>
        </div>

        <ol className="ic-parametros__list">
          {indicador.parametros.map((p, i) => {
            const v = paramLevels[i]
            const avaliado = typeof v === 'number'
            return (
              <li
                key={i}
                className={`ic-param ${avaliado ? `rated color-${levelToColor(v)}` : ''}`}
              >
                <div className="ic-param__head">
                  <span className="ic-param__num">{i + 1}</span>
                  <span className="ic-param__text">{p}</span>
                  {avaliado && (
                    <span className={`ic-param__chip color-${levelToColor(v)}`}>
                      <span className="ic-param__chip-emoji">{LEVEL_EMOJI[v]}</span>
                      N{v}
                    </span>
                  )}
                </div>
                <div className="ic-param__scale" role="radiogroup" aria-label={`Nível do parâmetro ${i + 1}`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={v === n}
                      className={`ic-param__dot color-${levelToColor(n)} ${v === n ? 'selected' : ''}`}
                      onClick={() => handleParamLevel(i, n)}
                      disabled={readOnly}
                      aria-label={`Nível ${n} — ${DESCRIPTOR_LABELS[n]}`}
                      title={`${n} — ${DESCRIPTOR_LABELS[n]}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="ic-nivel">
        <div className="ic-nivel__head">
          <span className="ic-section-label">Nível geral do indicador</span>
          {sugerido !== null && !usouSugestao && !readOnly && (
            <button
              type="button"
              className="ic-nivel__suggest"
              onClick={aplicarSugestao}
            >
              Usar sugestão: N{sugerido}
            </button>
          )}
          {usouSugestao && (
            <span className="ic-nivel__tag-auto">✓ baseado nos parâmetros</span>
          )}
        </div>
        <div className="ic-nivel__scale">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              className={`ic-nivel__btn color-${LEVEL_COLORS[n]} ${nivel === n ? 'selected' : ''} ${sugerido === n && nivel === null ? 'suggested' : ''}`}
              onClick={() => handleIndicadorLevel(n)}
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
