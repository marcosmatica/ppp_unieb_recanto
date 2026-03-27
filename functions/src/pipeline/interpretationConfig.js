/**
 * pipeline/interpretationConfig.js
 *
 * Constantes e helpers do sistema de interpretação pedagógica em 4 camadas.
 * Importado por elementAnalyzer.js e feedbackAggregator.js.
 *
 * interpretationMode por elemento:
 *   'strict'   — verificação literal (elementos estruturais: capa, sumário)
 *   'moderate' — flexibilização parcial (conteúdo normativo com terminologia específica)
 *   'liberal'  — alta tolerância contextual (conteúdo pedagógico integrado)
 *
 * O modo pode ser ajustado automaticamente pelo feedbackAggregator
 * quando o threshold de discordâncias for atingido.
 */

'use strict'

// ─── Modos e seus parâmetros ──────────────────────────────────────────────────

const INTERPRETATION_MODES = {
  strict: {
    label:            'Verificação literal',
    presumePresent:   false,   // não presume presença — exige evidência explícita
    implicitAllowed:  false,   // adequate_implicit não é aceito
    scoreFloor:       0.7,     // score mínimo para "adequate" (acima → adequate, abaixo → attention)
    promptInstruction: `MODO ESTRITO: verifique se o elemento está EXPLICITAMENTE presente.
Não aceite presença implícita ou inferida. Exija a informação de forma direta e identificável.
Se ausente ou apenas mencionado superficialmente → "critical" ou "attention".`,
  },

  moderate: {
    label:            'Verificação moderada',
    presumePresent:   false,
    implicitAllowed:  true,    // adequate_implicit aceito
    scoreFloor:       0.5,
    promptInstruction: `MODO MODERADO: aceite tanto presença explícita quanto implícita.
Se o conteúdo estiver presente mas sem a terminologia exata das portarias → "adequate_implicit".
Exija que a intenção pedagógica seja identificável, mesmo que integrada a outras seções.`,
  },

  liberal: {
    label:            'Verificação contextual',
    presumePresent:   true,    // presume presença a menos que seja claramente ausente
    implicitAllowed:  true,
    scoreFloor:       0.35,    // score mais baixo ainda pode ser "adequate_implicit"
    promptInstruction: `MODO LIBERAL (conteúdo pedagógico integrado): PRESUMA que o elemento
está presente a menos que o texto seja completamente omisso ou contraditório.
Documentos pedagógicos tratam múltiplos elementos de forma integrada — aceite formulações
funcionalmente equivalentes, descrições de práticas sem nomenclatura técnica, e abordagens
distribuídas ao longo de seções diferentes.
Marque "critical" SOMENTE se não houver absolutamente nenhuma referência ao tema.`,
  },
}

// ─── Thresholds de feedback para ajuste automático de modo ───────────────────

// Se o analista discordar X% das vezes num elemento → modo migra para mais liberal
const FEEDBACK_THRESHOLDS = {
  disagreementRateToRelax:  0.4,   // 40% de discordâncias → modo fica 1 nível mais liberal
  disagreementRateToStrict: 0.05,  // <5% de discordâncias → pode endurecer
  minSamples:               5,     // mínimo de avaliações antes de ajustar
}

// ─── Progressão de modos ──────────────────────────────────────────────────────

const MODE_PROGRESSION = ['strict', 'moderate', 'liberal']

function relaxMode(currentMode) {
  const idx = MODE_PROGRESSION.indexOf(currentMode)
  return MODE_PROGRESSION[Math.min(idx + 1, MODE_PROGRESSION.length - 1)]
}

function strictenMode(currentMode) {
  const idx = MODE_PROGRESSION.indexOf(currentMode)
  return MODE_PROGRESSION[Math.max(idx - 1, 0)]
}

// ─── Resolve o modo efetivo de um elemento ───────────────────────────────────
// Considera: modo base do seed → ajuste do feedbackAggregator (override)

function resolveMode(el, overrides = {}) {
  const base     = el.interpretationMode || 'moderate'
  const override = overrides[el.elementId]
  if (!override) return base

  // Override só pode relaxar, nunca endurecer além do base
  const baseIdx     = MODE_PROGRESSION.indexOf(base)
  const overrideIdx = MODE_PROGRESSION.indexOf(override)
  return overrideIdx >= baseIdx ? override : base
}

function getModeConfig(mode) {
  return INTERPRETATION_MODES[mode] || INTERPRETATION_MODES.moderate
}

module.exports = {
  INTERPRETATION_MODES,
  FEEDBACK_THRESHOLDS,
  MODE_PROGRESSION,
  relaxMode,
  strictenMode,
  resolveMode,
  getModeConfig,
}
