/**
 * functions/src/index.js
 * Ponto de entrada — exporta todas as Cloud Functions do projeto
 */

const { defineSecret } = require("firebase-functions/params")

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY")

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

const { triggerDeepReview } = require('./pipeline/deepReview')
module.exports = { onPPPUploaded, onElementResultUpdated, submitHumanReview, generateReport, triggerDeepReview }