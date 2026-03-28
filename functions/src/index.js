/**
 * functions/src/index.js
 * Ponto de entrada — exporta todas as Cloud Functions do projeto
 */

const { initializeApp } = require('firebase-admin/app')
initializeApp()

// Pipeline principal (Storage trigger — fase 1: Haiku)
const { onPPPUploaded } = require('./pipeline/index')

// Deep review (callable — fase 2: Sonnet, sob confirmação do usuário)
const { triggerDeepReview } = require('./pipeline/deepReview')

// Triggers Firestore + callable de revisão humana
const {
  onElementResultUpdated,
  submitHumanReview,
} = require('./pipeline/comparator')

// Feedback aggregator (scheduled — ajusta modos de interpretação semanalmente)
const { aggregateFeedback } = require('./pipeline/feedbackAggregator')

// Geração do parecer final (.docx)
const { generateReport } = require('./report/generateReport')
const { regenerateHighlightedHtml } = require('./report/regenerateHighlightedHtml')

const { getDocumentViewerUrl } = require('./report/getDocumentViewerUrl')
module.exports = {
  onPPPUploaded,
  triggerDeepReview,
  onElementResultUpdated,
  submitHumanReview,
  aggregateFeedback,
  generateReport,
  getDocumentViewerUrl,
  regenerateHighlightedHtml,
}
