/**
 * pipeline/feedbackAggregator.js
 * Camada 4 do sistema de interpretação pedagógica.
 *
 * Duas funções:
 *   recordDisagreement  — chamada por comparator.submitHumanReview quando
 *                         decision === 'disagree', acumula no Firestore
 *   aggregateFeedback   — Cloud Function scheduled (1x/semana) que lê os
 *                         acúmulos e ajusta modeOverrides na coleção
 *                         /interpretation_overrides/{elementId}
 *
 * O pipeline lê /interpretation_overrides antes de cada análise e passa
 * os overrides para analyzeAllElements via modeOverrides.
 */

'use strict'

const { onSchedule }    = require('firebase-functions/v2/scheduler')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { logger }        = require('firebase-functions')
const {
  FEEDBACK_THRESHOLDS,
  relaxMode,
  strictenMode,
  MODE_PROGRESSION,
} = require('./interpretationConfig')

const db = getFirestore()

// ─── Registra uma discordância individual ─────────────────────────────────────
// Chamada por comparator.submitHumanReview quando decision === 'disagree'

async function recordDisagreement({ elementId, analysisId, schoolId, aiStatus, year }) {
  const ref = db.collection('feedback_log').doc()
  await ref.set({
    elementId,
    analysisId,
    schoolId,
    aiStatus,       // status que a IA deu (critical/attention) antes da discordância
    year,
    type: 'disagree',
    createdAt: Timestamp.now(),
  })
  logger.info(`Discordância registrada`, { elementId, aiStatus })
}

// ─── Aggregator agendado ──────────────────────────────────────────────────────
// Roda toda segunda-feira às 06:00 (horário de Brasília)

exports.aggregateFeedback = onSchedule(
  {
    schedule:  'every monday 06:00',
    timeZone:  'America/Sao_Paulo',
    region:    'southamerica-east1',
    memory:    '256MiB',
  },
  async () => {
    logger.info('Iniciando aggregação de feedback')

    // 1. Carrega todos os registros de feedback dos últimos 12 meses
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)

    const logSnap = await db.collection('feedback_log')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .get()

    // 2. Agrupa por elementId
    const byElement = {}
    logSnap.docs.forEach(d => {
      const { elementId, type } = d.data()
      if (!byElement[elementId]) byElement[elementId] = { total: 0, disagree: 0 }
      byElement[elementId].total++
      if (type === 'disagree') byElement[elementId].disagree++
    })

    // 3. Carrega definições do checklist para saber o modo base de cada elemento
    const checklistSnap = await db.collection('checklist_definitions')
      .where('active', '==', true)
      .get()
    const baseModesMap = {}
    checklistSnap.docs.forEach(d => {
      baseModesMap[d.id] = d.data().interpretationMode || 'moderate'
    })

    // 4. Carrega overrides atuais
    const overridesSnap = await db.collection('interpretation_overrides').get()
    const currentOverrides = {}
    overridesSnap.docs.forEach(d => { currentOverrides[d.id] = d.data().mode })

    // 5. Calcula novos overrides
    const batch = db.batch()
    const report = { relaxed: [], strictened: [], unchanged: [], insufficient: [] }

    for (const [elementId, counts] of Object.entries(byElement)) {
      if (counts.total < FEEDBACK_THRESHOLDS.minSamples) {
        report.insufficient.push({ elementId, samples: counts.total })
        continue
      }

      const disagreeRate  = counts.disagree / counts.total
      const baseMode      = baseModesMap[elementId] || 'moderate'
      const currentMode   = currentOverrides[elementId] || baseMode
      const overrideRef   = db.collection('interpretation_overrides').doc(elementId)

      let newMode = currentMode

      if (disagreeRate >= FEEDBACK_THRESHOLDS.disagreementRateToRelax) {
        // Muitas discordâncias → IA está sendo muito rígida → relaxar
        newMode = relaxMode(currentMode)
        if (newMode !== currentMode) {
          report.relaxed.push({ elementId, from: currentMode, to: newMode, disagreeRate: Math.round(disagreeRate * 100) })
        }
      } else if (disagreeRate <= FEEDBACK_THRESHOLDS.disagreementRateToStrict && currentMode !== baseMode) {
        // Poucas discordâncias e modo estava relaxado → pode voltar ao base
        newMode = strictenMode(currentMode)
        // Nunca vai além do modo base definido no seed
        const baseIdx = MODE_PROGRESSION.indexOf(baseMode)
        const newIdx  = MODE_PROGRESSION.indexOf(newMode)
        if (newIdx < baseIdx) newMode = baseMode
        if (newMode !== currentMode) {
          report.strictened.push({ elementId, from: currentMode, to: newMode, disagreeRate: Math.round(disagreeRate * 100) })
        }
      } else {
        report.unchanged.push(elementId)
      }

      batch.set(overrideRef, {
        elementId,
        mode:          newMode,
        baseMode,
        disagreeRate:  Math.round(disagreeRate * 100),
        sampleCount:   counts.total,
        updatedAt:     Timestamp.now(),
      }, { merge: true })
    }

    await batch.commit()

    // 6. Grava relatório de aggregação
    await db.collection('feedback_aggregation_log').add({
      ranAt:       Timestamp.now(),
      elementsAnalyzed: Object.keys(byElement).length,
      relaxed:     report.relaxed,
      strictened:  report.strictened,
      insufficient: report.insufficient.length,
    })

    logger.info('Aggregação concluída', {
      relaxed:    report.relaxed.length,
      strictened: report.strictened.length,
      unchanged:  report.unchanged.length,
    })
  }
)

// ─── Carrega overrides para uso no pipeline ───────────────────────────────────
// Chamada em pipeline/index.js antes de analyzeAllElements

async function loadModeOverrides() {
  try {
    const snap = await db.collection('interpretation_overrides').get()
    const overrides = {}
    snap.docs.forEach(d => { overrides[d.id] = d.data().mode })
    return overrides
  } catch (err) {
    logger.warn('Falha ao carregar modeOverrides — usando modos base', { error: err.message })
    return {}
  }
}

module.exports = { recordDisagreement, loadModeOverrides }
