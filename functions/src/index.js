// functions/src/index.js

const { initializeApp } = require('firebase-admin/app')
initializeApp({
  storageBucket: 'unieb-recanto.firebasestorage.app'
})

const { onPPPUploaded } = require('./pipeline/index')
const { triggerDeepReview } = require('./pipeline/deepReview')
const { onElementResultUpdated, submitHumanReview } = require('./pipeline/comparator')
const { aggregateFeedback } = require('./pipeline/feedbackAggregator')
const { generateReport } = require('./report/generateReport')
const { regenerateHighlightedHtml } = require('./report/regenerateHighlightedHtml')
const { getDocumentViewerUrl } = require('./report/getDocumentViewerUrl')
const { buildParecer } = require('./parecer/buildParecer')
const { finalizarParecer } = require('./parecer/finalizarParecer')
const { exportParecerPdf } = require('./parecer/exportParecerPdf')

module.exports = {
  onPPPUploaded,
  triggerDeepReview,
  onElementResultUpdated,
  submitHumanReview,
  aggregateFeedback,
  generateReport,
  getDocumentViewerUrl,
  regenerateHighlightedHtml,
  buildParecer,
  finalizarParecer,
  exportParecerPdf,
}
