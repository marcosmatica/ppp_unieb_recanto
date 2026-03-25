/**
 * pipeline/elementAnalyzer.js
 * Analisa cada elemento do checklist contra o texto do PPP usando a API Claude.
 *
 * Estratégia de contexto:
 *   1. Primeiro tenta a seção mapeada (sectionMap[element.conditionKey])
 *   2. Se a seção não foi detectada, envia um chunk do texto completo
 *      centrado nas ocorrências das searchKeywords do elemento
 *   3. Processa em paralelo com concorrência controlada (evita rate-limit)
 */

const { logger } = require('firebase-functions')
const { Timestamp } = require('firebase-admin/firestore')

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL             = 'claude-sonnet-4-6'
const MAX_TOKENS        = 1024
const CONCURRENCY       = 5     // análises simultâneas
const CONTEXT_CHARS     = 4000  // máx de chars do PPP enviados por elemento

// ─── Entrada principal ────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {Array}  opts.elements    - elementos do checklist filtrados
 * @param {Object} opts.sectionMap  - mapa de seções detectadas
 * @param {string} opts.fullText    - texto completo do PPP
 * @param {Object} opts.school      - dados da escola (stages, name etc.)
 * @param {string} opts.analysisId
 * @param {number} opts.year        - 2025 ou 2026
 * @returns {Array} results - array de documentos prontos para elementResults
 */
async function analyzeAllElements({ elements, sectionMap, fullText, school, analysisId, year }) {
  const results = []

  // Processa em batches de CONCURRENCY
  for (let i = 0; i < elements.length; i += CONCURRENCY) {
    const batch = elements.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(el => analyzeElement({ el, sectionMap, fullText, school, year }))
    )

    results.push(...batchResults)
    logger.info(`Elementos analisados: ${Math.min(i + CONCURRENCY, elements.length)}/${elements.length}`, { analysisId })
  }

  return results
}

// ─── Análise de um elemento ───────────────────────────────────────────────────

async function analyzeElement({ el, sectionMap, fullText, school, year }) {
  const context = buildContext(el, sectionMap, fullText)
  const prompt  = buildPrompt(el, context, school, year)

  let aiResult
  try {
    aiResult = await callClaude(prompt)
  } catch (err) {
    logger.error(`Falha na análise do elemento ${el.elementId}`, { error: err.message })
    aiResult = errorResult(err.message)
  }

  return buildResultDocument(el, aiResult, school)
}

// ─── Contexto: seção mapeada ou busca por keywords ───────────────────────────

function buildContext(el, sectionMap, fullText) {
  // 1. Tenta seção mapeada (mais preciso, menos tokens)
  const sectionKeys = getSectionKeysForElement(el.elementId)
  for (const key of sectionKeys) {
    const section = sectionMap[key]
    if (section?.found && section.text.length > 50) {
      return {
        type: 'section',
        sectionTitle: section.title,
        text: section.text.slice(0, CONTEXT_CHARS),
      }
    }
  }

  // 2. Fallback: busca por keywords no texto completo
  const keywords = el.searchKeywords || []
  const chunk = extractChunkByKeywords(fullText, keywords, CONTEXT_CHARS)
  return {
    type: 'keyword_search',
    sectionTitle: null,
    text: chunk,
  }
}

/**
 * Extrai um trecho do texto ao redor das ocorrências das keywords.
 * Retorna vazio se nenhuma keyword encontrada.
 */
function extractChunkByKeywords(text, keywords, maxChars) {
  if (!keywords.length) return text.slice(0, maxChars)

  const lower = text.toLowerCase()
  let bestPos = -1

  for (const kw of keywords) {
    const pos = lower.indexOf(kw.toLowerCase())
    if (pos !== -1) {
      bestPos = pos
      break
    }
  }

  if (bestPos === -1) return ''  // keyword não encontrada → seção ausente

  const start = Math.max(0, bestPos - 500)
  const end   = Math.min(text.length, bestPos + maxChars - 500)
  return text.slice(start, end)
}

// ─── Mapeamento elemento → seção ─────────────────────────────────────────────

const ELEMENT_TO_SECTION = {
  // Pré-textuais
  'B1_1_capa':            ['capa'],
  'B1_2_sumario':         ['sumario'],
  'B1_3_apresentacao':    ['apresentacao'],
  // Identidade
  'B2_1_historico':       ['historico'],
  'B2_2_diagnostico':     ['diagnostico'],
  'B2_3_funcao_social':   ['funcao_social'],
  'B2_4_missao':          ['missao'],
  'B2_5_principios':      ['principios'],
  // Planejamento
  'B3_1_metas':           ['metas'],
  'B3_2_objetivos':       ['objetivos'],
  'B3_3_fundamentos':     ['fundamentos'],
  'B3_4_org_curricular':  ['org_curricular'],
  'B3_5_org_trabalho':    ['org_trabalho'],
  // Ensino Médio
  'B4_1_itinerario':      ['itinerario'],
  'B4_2_percursos':       ['itinerario'],
  'B4_3_ifi':             ['ifi'],
  // Projetos
  'B5_1_prog_institucionais': ['prog_institucionais'],
  'B5_2_proj_especificos':    ['proj_especificos'],
  'B5_2A_proj_etnorracial':   ['proj_etnorracial', 'proj_especificos'],
  'B5_2B_proj_maria_penha':   ['proj_maria_penha', 'proj_especificos'],
  'B5_3_parcerias':           ['proj_parcerias'],
  // Avaliação
  'B6_1_avaliacao':       ['avaliacao'],
  'B6_2_seaa':            ['seaa'],
  'B6_3_oe':              ['oe'],
  'B6_4_aee':             ['aee'],
  // Profissionais
  'B7_1_apoio_escolar':   ['apoio_escolar'],
  'B7_2_biblioteca':      ['biblioteca'],
  'B7_3_conselho_escolar':['conselho_escolar'],
  'B7_4_readaptados':     ['readaptados'],
  'B7_5_coord_pedagogica':['coord_pedagogica'],
  // Gestão
  'B8_1_permanencia':     ['permanencia'],
  'B8_2_implementacao':   ['implementacao'],
  'B8_3_monitoramento':   ['monitoramento'],
  // Pós-textuais
  'B9_1_referencias':     ['referencias'],
  'B9_2_apendices':       ['apendices'],
  'B9_3_anexos':          ['anexos'],
}

function getSectionKeysForElement(elementId) {
  return ELEMENT_TO_SECTION[elementId] || []
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(el, context, school, year) {
  const legalRequired = el.legalBasis
    ?.filter(l => l.required)
    .map(l => `${l.norm} (${l.alias})`)
    .join(', ') || 'nenhuma referência legal específica obrigatória'

  const contextBlock = context.text
    ? `TRECHO DO PPP (seção: "${context.sectionTitle || 'busca por keywords'}"):\n\`\`\`\n${context.text}\n\`\`\``
    : 'TRECHO DO PPP: [Seção não encontrada no documento]'

  return `Você é um analista especializado em Projetos Político-Pedagógicos (PPP) da rede pública de ensino do Distrito Federal, com domínio das normas da SEEDF.

ESCOLA: ${school.name}
ANO DO PPP: ${year}
ELEMENTO A VERIFICAR: ${el.label}
REFERÊNCIA NORMATIVA: ${el.normRef}
REFERÊNCIAS LEGAIS OBRIGATÓRIAS: ${legalRequired}
ELEMENTO CRÍTICO: ${el.isCritical ? 'SIM — ausência impede aprovação' : 'NÃO'}
${el.isNewIn2026 ? '⚠️ NOVO EM 2026 — exigido pela Portaria 174/2026' : ''}

${contextBlock}

INSTRUÇÕES:
Analise se o elemento "${el.label}" está presente e adequado no trecho acima.
Verifique especificamente:
1. O elemento existe e está desenvolvido (não apenas citado superficialmente)?
2. O conteúdo é suficientemente elaborado ou é apenas um título vazio?
3. As referências legais obrigatórias estão citadas?
${el.isCritical ? '4. CRÍTICO: este item é obrigatório — marque como "critical" se ausente ou insuficiente.' : ''}

Responda SOMENTE com um objeto JSON válido, sem texto adicional, sem markdown:
{
  "status": "adequate" | "attention" | "critical" | "not_applicable",
  "score": 0.0 a 1.0,
  "summary": "resumo em até 280 caracteres do problema ou confirmação",
  "excerpts": [
    { "text": "trecho exato encontrado no PPP (máx 200 chars)", "section": "nome da seção" }
  ],
  "legalRefs": {
    "required": ["lista das referências legais exigidas"],
    "found": ["quais foram encontradas no texto"],
    "missing": ["quais estão faltando"]
  },
  "missingItems": ["lista de itens específicos não encontrados"]
}

Critérios de status:
- "adequate": elemento presente, desenvolvido e com referências legais corretas
- "attention": elemento presente mas incompleto, superficial ou sem referências legais
- "critical": elemento ausente ou completamente inadequado
- "not_applicable": não se aplica a esta escola/etapa`
}

// ─── Chamada à API Claude ────────────────────────────────────────────────────

async function callClaude(prompt) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''

  // Parse defensivo do JSON
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ─── Monta o documento final para elementResults ──────────────────────────────

function buildResultDocument(el, aiResult, school) {
  // Garante que campos obrigatórios existam (fallback para respostas malformadas)
  const safe = {
    status:       aiResult.status       || 'critical',
    score:        aiResult.score        ?? 0,
    summary:      aiResult.summary      || 'Análise não pôde ser concluída.',
    excerpts:     aiResult.excerpts     || [],
    legalRefs:    aiResult.legalRefs    || { required: [], found: [], missing: [] },
    missingItems: aiResult.missingItems || [],
  }

  return {
    // Identidade do elemento
    elementId:       el.elementId,
    blockCode:       el.blockCode,
    blockLabel:      el.blockLabel,
    label:           el.label,
    normRef:         el.normRef,
    isCritical:      el.isCritical,
    isConditional:   el.isConditional,
    conditionKey:    el.conditionKey || null,
    isNewIn2026:     el.isNewIn2026 || false,

    // Resultado da IA
    aiResult: safe,

    // Revisão humana — inicia como pendente
    humanReview: {
      status:     'pending',
      decision:   null,
      comment:    null,
      reviewedAt: null,
      reviewedBy: null,
    },

    // Status efetivo = IA (será recalculado quando analista revisar)
    effectiveStatus: safe.status,

    // Comparativo 2025 — preenchido depois pelo comparator.js
    comparison2025: {
      previousStatus: null,
      delta:          null,
    },

    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

// ─── Resultado de erro ────────────────────────────────────────────────────────

function errorResult(message) {
  return {
    status: 'critical',
    score: 0,
    summary: `Erro na análise automática: ${message}`,
    excerpts: [],
    legalRefs: { required: [], found: [], missing: [] },
    missingItems: [],
  }
}

module.exports = { analyzeAllElements }
