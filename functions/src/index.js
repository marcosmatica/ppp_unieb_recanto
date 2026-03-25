/**
 * functions/src/index.js
 * Ponto de entrada — exporta todas as Cloud Functions do projeto
 */

const { initializeApp } = require('firebase-admin/app')
initializeApp()

// Pipeline principal (Storage trigger)
const { onPPPUploaded } = require('./pipeline/index')

// Triggers Firestore + callable de revisão
const {
  onElementResultUpdated,
  submitHumanReview,
} = require('./pipeline/comparator')

// Geração do parecer final
const { generateReport } = require('./report/generateReport')

module.exports = {
  onPPPUploaded,
  onElementResultUpdated,
  submitHumanReview,
  generateReport,
}
