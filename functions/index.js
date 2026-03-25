/**
 * Firebase Functions entrypoint
 * Compatível com firebase-functions v5+ / Node 20 / Gen2
 */
require('dotenv').config()
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

// limite global de instâncias
setGlobalOptions({
    maxInstances: 10,
});

// Exporta suas funções reais
module.exports = require("./src/index.js");