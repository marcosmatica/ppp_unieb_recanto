/**
 * pipeline/elementAnalyzer.js  (v4 — interpretação pedagógica em 4 camadas)
 *
 * Novidades em relação à v3:
 *   - Camada 1: lê interpretationMode do elemento (seed.js / Firestore)
 *   - Camada 2: preScore TF-IDF antes de chamar a IA (boost de confiança contextual)
 *   - Camada 3: buildBatchPrompt adaptativo — instrução de rigor varia por modo
 *   - Camada 4: integra overrides do feedbackAggregator (modos ajustados por feedback)
 */

'use strict'

const { logger } = require('firebase-functions')
const { Timestamp } = require('firebase-admin/firestore')
const { resolveMode, getModeConfig } = require('./interpretationConfig')

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL_FAST        = 'claude-haiku-4-5-20251001'
const MODEL_DEEP        = 'claude-sonnet-4-6'
const MAX_TOKENS_BATCH  = 4096
const MAX_TOKENS_SINGLE = 1024
const CONTEXT_CHARS     = 10000
const DEEP_SCORE_THRESH = 0.5

// ─── Fase 1: Haiku — análise completa em lote ─────────────────────────────────

async function analyzeAllElements({ elements, sectionMap, fullText, school, analysisId, year, modeOverrides = {} }) {
  const blocks     = groupByBlock(elements)
  const blockCodes = Object.keys(blocks)
  let allResults   = []

  for (let i = 0; i < blockCodes.length; i += 2) {
    const slice = blockCodes.slice(i, i + 2)
    const batchResults = await Promise.all(
        slice.map(code => analyzeBlockWithRetry({ elements: blocks[code], sectionMap, fullText, school, year, modeOverrides }))
    )
    allResults.push(...batchResults.flat())
    logger.info(`Blocos Haiku: ${Math.min(i + 2, blockCodes.length)}/${blockCodes.length}`, { analysisId })

    if (i + 2 < blockCodes.length) await sleep(3000)
  }

  const deepCandidates = allResults
      .filter(r => r._el.isCritical && r.aiResult.score < DEEP_SCORE_THRESH && r.aiResult.status !== 'not_applicable')
      .map(r => r.elementId)

  const results = allResults.map(({ _el, ...rest }) => rest)
  return { results, deepCandidates }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function analyzeBlockWithRetry(opts, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await analyzeBlock(opts)
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('rate_limit')
      if (is429 && attempt < retries) {
        const wait = attempt * 15000
        logger.warn(`Rate limit bloco ${opts.elements[0]?.blockCode}, aguardando ${wait/1000}s (tentativa ${attempt}/${retries})`)
        await sleep(wait)
      } else {
        throw err
      }
    }
  }
}

// ─── Fase 2: Sonnet — re-análise dos candidatos ───────────────────────────────

async function runDeepReview({ elements, sectionMap, fullText, school, year, analysisId, modeOverrides = {} }) {
  logger.info(`Deep review Sonnet: ${elements.length} elemento(s)`, { analysisId })
  const results = await Promise.all(
    elements.map(el => analyzeElementDeep({ el, sectionMap, fullText, school, year, modeOverrides }))
  )
  return results
}

// ─── Análise de bloco (Haiku) ─────────────────────────────────────────────────

async function analyzeBlock({ elements, sectionMap, fullText, school, year, modeOverrides }) {
  const prompt = buildBatchPrompt(elements, sectionMap, fullText, school, year, modeOverrides)

  let aiResults
  try {
    aiResults = await callClaude(prompt, MODEL_FAST, MAX_TOKENS_BATCH)
    if (!Array.isArray(aiResults)) throw new Error('Resposta não é um array')
  } catch (err) {
    logger.error(`Falha no bloco ${elements[0]?.blockCode}`, { error: err.message })
    return elements.map(el => buildResultDocument(el, errorResult(err.message)))
  }

  return elements.map(el => {
    const aiResult = aiResults.find(r => r.elementId === el.elementId)
      || errorResult('Elemento não retornado pela IA')
    return buildResultDocument(el, aiResult)
  })
}

// ─── Análise individual (Sonnet) ──────────────────────────────────────────────

async function analyzeElementDeep({ el, sectionMap, fullText, school, year, modeOverrides }) {
  const context = buildContext(el, sectionMap, fullText)
  const prompt  = buildSinglePrompt(el, context, school, year, modeOverrides)

  let aiResult
  try {
    aiResult = await callClaude(prompt, MODEL_DEEP, MAX_TOKENS_SINGLE)
  } catch (err) {
    logger.error(`Falha Sonnet: ${el.elementId}`, { error: err.message })
    aiResult = errorResult(err.message)
  }

  return buildResultDocument(el, aiResult)
}

// ─── Camada 2: Pré-score TF-IDF ──────────────────────────────────────────────
//
// Calcula similaridade entre as searchKeywords do elemento e o texto da seção
// antes de chamar a IA. O score (0–1) é incluído no prompt como "evidência
// prévia" e também determina se o modo liberal pode ser ativado automaticamente.

function preScoreTFIDF(el, contextText) {
  if (!contextText || !el.searchKeywords?.length) return 0

  const text    = contextText.toLowerCase()
  const words   = text.split(/\W+/).filter(Boolean)
  const total   = words.length
  if (total === 0) return 0

  // TF para cada keyword
  const scores = el.searchKeywords.map(kw => {
    const kwLower  = kw.toLowerCase()
    const kwWords  = kwLower.split(/\W+/).filter(Boolean)

    // Conta ocorrências de cada palavra da keyword no texto
    const tf = kwWords.reduce((sum, w) => {
      const count = words.filter(t => t === w || t.startsWith(w.slice(0, -1))).length
      return sum + count / total
    }, 0) / kwWords.length

    // Bônus por ocorrência da frase completa
    const phraseBonus = text.includes(kwLower) ? 0.3 : 0

    return Math.min(tf * 10 + phraseBonus, 1)
  })

  // Média dos top-3 scores (evita que keywords irrelevantes contaminem)
  const topScores = scores.sort((a, b) => b - a).slice(0, 3)
  return topScores.reduce((a, b) => a + b, 0) / topScores.length
}

// ─── Prompt em lote — adaptativo por modo ────────────────────────────────────

function buildBatchPrompt(elements, sectionMap, fullText, school, year, modeOverrides) {
  const elementBlocks = elements.map(el => {
    const context     = buildContext(el, sectionMap, fullText)
    const tfidfScore  = preScoreTFIDF(el, context.text)
    const mode        = resolveMode(el, modeOverrides)
    const modeCfg     = getModeConfig(mode)

    // Modo pode ser promovido para liberal se tfidf já encontrou evidência forte
    const effectiveMode = (tfidfScore > 0.6 && mode === 'moderate') ? 'liberal' : mode
    const effectiveCfg  = getModeConfig(effectiveMode)

    const contextBlock = context.text
      ? `TRECHO (seção: "${context.sectionTitle || 'busca por keywords'}"):\n"""\n${context.text}\n"""`
      : 'TRECHO: [seção não localizada no documento]'

    const legalRequired = el.legalBasis
      ?.filter(l => l.required)
      .map(l => `${l.norm} (${l.alias})`)
      .join(', ') || 'nenhuma'

    const tfidfNote = tfidfScore > 0
      ? `\nEvidência prévia (similaridade textual): ${Math.round(tfidfScore * 100)}% — ${
          tfidfScore > 0.6 ? 'termos-chave bem representados no trecho'
          : tfidfScore > 0.3 ? 'termos parcialmente presentes'
          : 'poucos termos encontrados'
        }`
      : ''

    return `--- ELEMENTO: ${el.elementId} [modo: ${effectiveMode}] ---
Rótulo: ${el.label}
Normativa: ${el.normRef}
Refs legais obrigatórias: ${legalRequired}
Crítico: ${el.isCritical ? 'SIM' : 'NÃO'}${el.isNewIn2026 ? ' | ⚠️ NOVO EM 2026' : ''}${tfidfNote}

${effectiveCfg.promptInstruction}

${contextBlock}`
  }).join('\n\n')

  return `Você é um analista pedagógico especializado em PPPs da rede pública do Distrito Federal.

ESCOLA: ${school.name} | ANO: ${year} | BLOCO: ${elements[0]?.blockLabel}

PRINCÍPIO GERAL: este é um documento pedagógico elaborado por uma comunidade escolar.
Documentos pedagógicos frequentemente integram múltiplos temas, usam linguagem própria da
escola e descrevem práticas sem nomear explicitamente os elementos avaliados.
Cada elemento abaixo indica seu próprio MODO de verificação — respeite-o.

ELEMENTOS A ANALISAR:
${elementBlocks}

Responda SOMENTE com array JSON válido, sem texto adicional, sem markdown:
[
  {
    "elementId": "string",
    "status": "adequate" | "adequate_implicit" | "attention" | "critical" | "not_applicable",
    "score": 0.0,
    "summary": "até 1000 chars — cite evidência encontrada ou descreva a ausência",
    "excerpts": [
  { "text": "trecho 1 (máx 1000 chars)", "section": "seção" },
  { "text": "trecho 2 opcional", "section": "seção" }, { "text": "trecho 3 opcional", "section": "seção" }
], "section": "nome da seção" }],
    "legalRefs": { "required": [], "found": [], "missing": [] },
    "missingItems": []
  }
]

Critérios de status:
- "adequate": presente, desenvolvido, terminologicamente explícito
- "adequate_implicit": conteúdo válido de forma contextual (respeite o modo do elemento)
- "attention": presente mas superficial, sem desenvolvimento real
- "critical": genuinamente ausente — nenhuma referência ao tema
- "not_applicable": não se aplica a esta escola/etapa`
}

// ─── Prompt individual (Sonnet) ───────────────────────────────────────────────

function buildSinglePrompt(el, context, school, year, modeOverrides) {
  const mode    = resolveMode(el, modeOverrides)
  const modeCfg = getModeConfig(mode)

  const tfidfScore  = preScoreTFIDF(el, context.text)
  const tfidfNote   = tfidfScore > 0
    ? `\nAnálise prévia de similaridade textual: ${Math.round(tfidfScore * 100)}% — ${
        tfidfScore > 0.6 ? 'termos-chave bem representados'
        : tfidfScore > 0.3 ? 'termos parcialmente presentes'
        : 'poucos termos encontrados — verifique com atenção'
      }`
    : ''

  const legalRequired = el.legalBasis
    ?.filter(l => l.required)
    .map(l => `${l.norm} (${l.alias})`)
    .join(', ') || 'nenhuma'

  const contextBlock = context.text
    ? `TRECHO DO PPP (seção: "${context.sectionTitle || 'busca por keywords'}"):\n\`\`\`\n${context.text}\n\`\`\``
    : 'TRECHO DO PPP: [Seção não encontrada no documento]'

  return `Você é um analista pedagógico sênior especializado em PPPs da rede pública do Distrito Federal.

ESCOLA: ${school.name} | ANO: ${year}
ELEMENTO: ${el.label}
NORMATIVA: ${el.normRef}
REFS LEGAIS: ${legalRequired}
CRÍTICO: ${el.isCritical ? 'SIM' : 'NÃO'}
MODO DE ANÁLISE: ${modeCfg.label} (${mode})${tfidfNote}
${el.isNewIn2026 ? '⚠️ NOVO EM 2026 — exigido pela Portaria 174/2026' : ''}

${contextBlock}

${modeCfg.promptInstruction}

Responda SOMENTE com JSON válido, sem texto adicional, sem markdown:
{
  "elementId": "${el.elementId}",
  "status": "adequate" | "adequate_implicit" | "attention" | "critical" | "not_applicable",
  "score": 0.0,
  "summary": "até 280 chars",
  "excerpts": [{ "text": "trecho exato (máx 1000 chars)", "section": "nome da seção" }],
  "legalRefs": { "required": [], "found": [], "missing": [] },
  "missingItems": []
}`
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

function buildContext(el, sectionMap, fullText) {
  const sectionKeys = getSectionKeysForElement(el.elementId)
  for (const key of sectionKeys) {
    const section = sectionMap[key]
    if (section?.found && section.text.length > 50) {
      return { type: 'section', sectionTitle: section.title, text: section.text.slice(0, CONTEXT_CHARS) }
    }
  }
  const chunk = extractChunkByKeywords(fullText, el.searchKeywords || [], CONTEXT_CHARS)
  return { type: 'keyword_search', sectionTitle: null, text: chunk }
}

function extractChunkByKeywords(text, keywords, maxChars) {
  if (!keywords.length) return text.slice(0, maxChars)
  const lower = text.toLowerCase()
  let bestPos = -1
  for (const kw of keywords) {
    const pos = lower.indexOf(kw.toLowerCase())
    if (pos !== -1) { bestPos = pos; break }
  }
  if (bestPos === -1) return ''
  const start = Math.max(0, bestPos - 2000)
  const end   = Math.min(text.length, bestPos + maxChars - 2000)
  return text.slice(start, end)
}

const ELEMENT_TO_SECTION = {
  'B1_1_capa':                ['capa'],
  'B1_2_sumario':             ['sumario'],
  'B1_3_apresentacao':        ['apresentacao'],
  'B2_1_historico':           ['historico'],
  'B2_2_diagnostico':         ['diagnostico'],
  'B2_3_funcao_social':       ['funcao_social'],
  'B2_4_missao':              ['missao'],
  'B2_5_principios':          ['principios'],
  'B3_1_metas':               ['metas'],
  'B3_2_objetivos':           ['objetivos'],
  'B3_3_fundamentos':         ['fundamentos'],
  'B3_4_org_curricular':      ['org_curricular'],
  'B3_5_org_trabalho':        ['org_trabalho'],
  'B4_1_itinerario':          ['itinerario'],
  'B4_2_percursos':           ['itinerario'],
  'B4_3_ifi':                 ['ifi'],
  'B5_1_prog_institucionais': ['prog_institucionais'],
  'B5_2_proj_especificos':    ['proj_especificos'],
  'B5_2A_proj_etnorracial':   ['proj_etnorracial', 'proj_especificos'],
  'B5_2B_proj_maria_penha':   ['proj_maria_penha', 'proj_especificos'],
  'B5_3_parcerias':           ['proj_parcerias'],
  'B6_1_avaliacao':           ['avaliacao'],
  'B6_2_seaa':                ['seaa'],
  'B6_3_oe':                  ['oe'],
  'B6_4_aee':                 ['aee'],
  'B7_1_apoio_escolar':       ['apoio_escolar'],
  'B7_2_biblioteca':          ['biblioteca'],
  'B7_3_conselho_escolar':    ['conselho_escolar'],
  'B7_4_readaptados':         ['readaptados'],
  'B7_5_coord_pedagogica':    ['coord_pedagogica'],
  'B8_1_permanencia':         ['permanencia'],
  'B8_2_implementacao':       ['implementacao'],
  'B8_3_monitoramento':       ['monitoramento'],
  'B9_1_referencias':         ['referencias'],
  'B9_2_apendices':           ['apendices'],
  'B9_3_anexos':              ['anexos'],
}

function getSectionKeysForElement(elementId) {
  return ELEMENT_TO_SECTION[elementId] || []
}

function groupByBlock(elements) {
  return elements.reduce((acc, el) => {
    if (!acc[el.blockCode]) acc[el.blockCode] = []
    acc[el.blockCode].push(el)
    return acc
  }, {})
}

// ─── API Claude ───────────────────────────────────────────────────────────────

async function callClaude(prompt, model, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não definida')

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API ${response.status}: ${err}`)
  }

  const data  = await response.json()
  const text  = data.content?.find(b => b.type === 'text')?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ─── buildResultDocument ──────────────────────────────────────────────────────

function buildResultDocument(el, aiResult) {
  const VALID = new Set(['adequate', 'adequate_implicit', 'attention', 'critical', 'not_applicable'])
  const safe = {
    status:       VALID.has(aiResult.status) ? aiResult.status : 'critical',
    score:        typeof aiResult.score === 'number' ? aiResult.score : 0,
    summary:      aiResult.summary      || 'Análise não pôde ser concluída.',
    excerpts:     Array.isArray(aiResult.excerpts)     ? aiResult.excerpts     : [],
    legalRefs:    aiResult.legalRefs                   || { required: [], found: [], missing: [] },
    missingItems: Array.isArray(aiResult.missingItems) ? aiResult.missingItems : [],
  }

  return {
    elementId:       el.elementId,
    blockCode:       el.blockCode,
    blockLabel:      el.blockLabel,
    label:           el.label,
    normRef:         el.normRef,
    isCritical:      el.isCritical,
    isConditional:   el.isConditional,
    conditionKey:    el.conditionKey  || null,
    isNewIn2026:     el.isNewIn2026   || false,
    interpretationMode: el.interpretationMode || 'moderate',
    aiResult:        safe,
    humanReview:     { status: 'pending', decision: null, comment: null, reviewedAt: null, reviewedBy: null },
    effectiveStatus: safe.status,
    comparison2025:  { previousStatus: null, delta: null },
    createdAt:       Timestamp.now(),
    updatedAt:       Timestamp.now(),
    _el:             el,
  }
}

function errorResult(message) {
  return { status: 'critical', score: 0, summary: `Erro: ${message}`, excerpts: [], legalRefs: { required: [], found: [], missing: [] }, missingItems: [] }
}

module.exports = { analyzeAllElements, runDeepReview }
