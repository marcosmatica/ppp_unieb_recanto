/**
 * pipeline/elementAnalyzer.js
 *
 * Exporta duas funções:
 *   analyzeAllElements — fase 1 (Haiku, lote por bloco)
 *   runDeepReview      — fase 2 (Sonnet, elementos críticos confirmados pelo usuário)
 */

const { logger } = require('firebase-functions')
const { Timestamp } = require('firebase-admin/firestore')

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const MODEL_FAST        = 'claude-haiku-4-5-20251001'
const MODEL_DEEP        = 'claude-sonnet-4-6'
const MAX_TOKENS_BATCH  = 4096
const MAX_TOKENS_SINGLE = 1024
const CONTEXT_CHARS     = 4000
const DEEP_SCORE_THRESH = 0.5   // candidatos à re-análise: críticos com score abaixo disto

// ─── Fase 1: Haiku — análise completa em lote ─────────────────────────────────

async function analyzeAllElements({ elements, sectionMap, fullText, school, analysisId, year }) {
  const blocks = groupByBlock(elements)
  const blockCodes = Object.keys(blocks)
  const BLOCK_CONCURRENCY = 4
  let allResults = []

  for (let i = 0; i < blockCodes.length; i += BLOCK_CONCURRENCY) {
    const slice = blockCodes.slice(i, i + BLOCK_CONCURRENCY)
    const batchResults = await Promise.all(
      slice.map(code => analyzeBlock({ elements: blocks[code], sectionMap, fullText, school, year }))
    )
    allResults.push(...batchResults.flat())
    logger.info(`Blocos Haiku: ${Math.min(i + BLOCK_CONCURRENCY, blockCodes.length)}/${blockCodes.length}`, { analysisId })
  }

  // Identifica candidatos à re-análise (retorna junto para o pipeline gravar no Firestore)
  const deepCandidates = allResults
    .filter(r => r._el.isCritical && r.aiResult.score < DEEP_SCORE_THRESH && r.aiResult.status !== 'not_applicable')
    .map(r => r.elementId)

  // Remove campo interno antes de retornar
  const results = allResults.map(({ _el, ...rest }) => rest)

  return { results, deepCandidates }
}

// ─── Fase 2: Sonnet — re-análise dos candidatos confirmados ──────────────────

/**
 * Chamada pelo pipeline/deepReview.js após confirmação do usuário.
 * Recebe apenas os elementos candidatos (já filtrados pelo pipeline).
 */
async function runDeepReview({ elements, sectionMap, fullText, school, year, analysisId }) {
  logger.info(`Deep review Sonnet: ${elements.length} elemento(s)`, { analysisId })

  const results = await Promise.all(
    elements.map(el => analyzeElementDeep({ el, sectionMap, fullText, school, year }))
  )

  return results
}

// ─── Análise de bloco (Haiku) ─────────────────────────────────────────────────

async function analyzeBlock({ elements, sectionMap, fullText, school, year }) {
  const prompt = buildBatchPrompt(elements, sectionMap, fullText, school, year)

  let aiResults
  try {
    aiResults = await callClaude(prompt, MODEL_FAST, MAX_TOKENS_BATCH)
    if (!Array.isArray(aiResults)) throw new Error('Resposta não é um array')
  } catch (err) {
    logger.error(`Falha no bloco ${elements[0]?.blockCode}`, { error: err.message })
    return elements.map(el => buildResultDocument(el, errorResult(err.message)))
  }

  return elements.map(el => {
    const aiResult = aiResults.find(r => r.elementId === el.elementId) || errorResult('Elemento não retornado pela IA')
    return buildResultDocument(el, aiResult)
  })
}

// ─── Análise individual (Sonnet) ──────────────────────────────────────────────

async function analyzeElementDeep({ el, sectionMap, fullText, school, year }) {
  const context = buildContext(el, sectionMap, fullText)
  const prompt  = buildSinglePrompt(el, context, school, year)

  let aiResult
  try {
    aiResult = await callClaude(prompt, MODEL_DEEP, MAX_TOKENS_SINGLE)
  } catch (err) {
    logger.error(`Falha Sonnet no elemento ${el.elementId}`, { error: err.message })
    aiResult = errorResult(err.message)
  }

  return buildResultDocument(el, aiResult)
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildBatchPrompt(elements, sectionMap, fullText, school, year) {
  const elementBlocks = elements.map(el => {
    const context = buildContext(el, sectionMap, fullText)
    const contextBlock = context.text
      ? `TRECHO (seção: "${context.sectionTitle || 'busca por keywords'}"):\n"""\n${context.text}\n"""`
      : 'TRECHO: [seção não localizada no documento]'

    const legalRequired = el.legalBasis
      ?.filter(l => l.required)
      .map(l => `${l.norm} (${l.alias})`)
      .join(', ') || 'nenhuma'

    return `--- ELEMENTO: ${el.elementId} ---
Rótulo: ${el.label}
Normativa: ${el.normRef}
Refs legais obrigatórias: ${legalRequired}
Crítico: ${el.isCritical ? 'SIM' : 'NÃO'}${el.isNewIn2026 ? ' | ⚠️ NOVO EM 2026' : ''}
${contextBlock}`
  }).join('\n\n')

  return `Você é um analista pedagógico especializado em PPPs da rede pública do Distrito Federal, com domínio das normas da SEEDF.

ESCOLA: ${school.name} | ANO: ${year} | BLOCO: ${elements[0]?.blockLabel}

MODO DE ANÁLISE: pedagógico-interpretativo
Avalie cada elemento em DOIS NÍVEIS:
A) Verificação direta — o elemento é abordado com terminologia típica?
B) Verificação contextual — o conteúdo cobre o mesmo objetivo pedagógico com vocabulário próprio da escola?

Se (B) for satisfeito sem (A), o elemento é válido — use "adequate_implicit".
Documentos pedagógicos frequentemente integram temas com linguagem própria da comunidade escolar.
NÃO penalize ausência de terminologia técnica quando a intenção pedagógica estiver clara.

ELEMENTOS A ANALISAR:
${elementBlocks}

Responda SOMENTE com array JSON válido, sem texto adicional, sem markdown:
[
  {
    "elementId": "string",
    "status": "adequate" | "adequate_implicit" | "attention" | "critical" | "not_applicable",
    "score": 0.0,
    "summary": "até 280 chars",
    "excerpts": [{ "text": "trecho exato (máx 200 chars)", "section": "nome da seção" }],
    "legalRefs": { "required": [], "found": [], "missing": [] },
    "missingItems": []
  }
]

Critérios:
- "adequate": presente, desenvolvido, terminologicamente explícito
- "adequate_implicit": conteúdo válido de forma contextual/implícita
- "attention": presente mas superficial ou genérico
- "critical": genuinamente ausente ou título vazio sem conteúdo
- "not_applicable": não se aplica a esta escola/etapa`
}

function buildSinglePrompt(el, context, school, year) {
  const legalRequired = el.legalBasis
    ?.filter(l => l.required)
    .map(l => `${l.norm} (${l.alias})`)
    .join(', ') || 'nenhuma referência legal específica obrigatória'

  const contextBlock = context.text
    ? `TRECHO DO PPP (seção: "${context.sectionTitle || 'busca por keywords'}"):\n\`\`\`\n${context.text}\n\`\`\``
    : 'TRECHO DO PPP: [Seção não encontrada no documento]'

  return `Você é um analista pedagógico sênior especializado em PPPs da rede pública do Distrito Federal.

ESCOLA: ${school.name} | ANO: ${year}
ELEMENTO: ${el.label}
NORMATIVA: ${el.normRef}
REFS LEGAIS OBRIGATÓRIAS: ${legalRequired}
CRÍTICO: ${el.isCritical ? 'SIM — ausência impede aprovação' : 'NÃO'}
${el.isNewIn2026 ? '⚠️ NOVO EM 2026 — exigido pela Portaria 174/2026' : ''}

${contextBlock}

MODO DE ANÁLISE: pedagógico-interpretativo aprofundado

Este é um documento elaborado por uma comunidade escolar. Avalie em DOIS NÍVEIS:
A) Verificação direta: o elemento "${el.label}" está explicitamente abordado?
B) Verificação contextual: o texto cobre o mesmo objetivo de forma implícita, integrada ou com vocabulário próprio da escola?

Documentos pedagógicos frequentemente:
- Tratam múltiplos elementos de forma integrada
- Usam linguagem da comunidade escolar em vez de terminologia das portarias
- Descrevem práticas sem nomear explicitamente o elemento avaliado

NÃO penalize essas características. Marque "critical" SOMENTE se o conteúdo estiver genuinamente ausente.

Responda SOMENTE com JSON válido, sem texto adicional, sem markdown:
{
  "elementId": "${el.elementId}",
  "status": "adequate" | "adequate_implicit" | "attention" | "critical" | "not_applicable",
  "score": 0.0,
  "summary": "até 280 chars",
  "excerpts": [{ "text": "trecho exato (máx 200 chars)", "section": "nome da seção" }],
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
  const start = Math.max(0, bestPos - 500)
  const end   = Math.min(text.length, bestPos + maxChars - 500)
  return text.slice(start, end)
}

const ELEMENT_TO_SECTION = {
  'B1_1_capa':            ['capa'],
  'B1_2_sumario':         ['sumario'],
  'B1_3_apresentacao':    ['apresentacao'],
  'B2_1_historico':       ['historico'],
  'B2_2_diagnostico':     ['diagnostico'],
  'B2_3_funcao_social':   ['funcao_social'],
  'B2_4_missao':          ['missao'],
  'B2_5_principios':      ['principios'],
  'B3_1_metas':           ['metas'],
  'B3_2_objetivos':       ['objetivos'],
  'B3_3_fundamentos':     ['fundamentos'],
  'B3_4_org_curricular':  ['org_curricular'],
  'B3_5_org_trabalho':    ['org_trabalho'],
  'B4_1_itinerario':      ['itinerario'],
  'B4_2_percursos':       ['itinerario'],
  'B4_3_ifi':             ['ifi'],
  'B5_1_prog_institucionais': ['prog_institucionais'],
  'B5_2_proj_especificos':    ['proj_especificos'],
  'B5_2A_proj_etnorracial':   ['proj_etnorracial', 'proj_especificos'],
  'B5_2B_proj_maria_penha':   ['proj_maria_penha', 'proj_especificos'],
  'B5_3_parcerias':           ['proj_parcerias'],
  'B6_1_avaliacao':       ['avaliacao'],
  'B6_2_seaa':            ['seaa'],
  'B6_3_oe':              ['oe'],
  'B6_4_aee':             ['aee'],
  'B7_1_apoio_escolar':   ['apoio_escolar'],
  'B7_2_biblioteca':      ['biblioteca'],
  'B7_3_conselho_escolar':['conselho_escolar'],
  'B7_4_readaptados':     ['readaptados'],
  'B7_5_coord_pedagogica':['coord_pedagogica'],
  'B8_1_permanencia':     ['permanencia'],
  'B8_2_implementacao':   ['implementacao'],
  'B8_3_monitoramento':   ['monitoramento'],
  'B9_1_referencias':     ['referencias'],
  'B9_2_apendices':       ['apendices'],
  'B9_3_anexos':          ['anexos'],
}

function getSectionKeysForElement(elementId) {
  return ELEMENT_TO_SECTION[elementId] || []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByBlock(elements) {
  return elements.reduce((acc, el) => {
    if (!acc[el.blockCode]) acc[el.blockCode] = []
    acc[el.blockCode].push(el)
    return acc
  }, {})
}

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

function buildResultDocument(el, aiResult) {
  const VALID_STATUSES = new Set(['adequate', 'adequate_implicit', 'attention', 'critical', 'not_applicable'])
  const safe = {
    status:       VALID_STATUSES.has(aiResult.status) ? aiResult.status : 'critical',
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
    conditionKey:    el.conditionKey || null,
    isNewIn2026:     el.isNewIn2026 || false,
    aiResult:        safe,
    humanReview:     { status: 'pending', decision: null, comment: null, reviewedAt: null, reviewedBy: null },
    effectiveStatus: safe.status,
    comparison2025:  { previousStatus: null, delta: null },
    createdAt:       Timestamp.now(),
    updatedAt:       Timestamp.now(),
    _el:             el,  // removido pelo chamador antes de gravar no Firestore
  }
}

function errorResult(message) {
  return { status: 'critical', score: 0, summary: `Erro na análise automática: ${message}`, excerpts: [], legalRefs: { required: [], found: [], missing: [] }, missingItems: [] }
}

module.exports = { analyzeAllElements, runDeepReview }
