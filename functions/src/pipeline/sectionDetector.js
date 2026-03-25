/**
 * pipeline/sectionDetector.js
 * Detecta seções do PPP no texto extraído e constrói um mapa
 * { sectionKey: { title, text, startPos, endPos } }
 *
 * Estratégia: busca por títulos canônicos (e variações comuns) que a escola
 * pode usar. Quanto mais precisa a detecção, menor o contexto enviado à IA
 * (e menor o custo de tokens).
 */

// ─── Dicionário de seções canônicas ──────────────────────────────────────────
// Cada entrada define variações de título que a escola pode usar para
// aquela seção. O detector busca por qualquer uma delas.

const SECTION_PATTERNS = [
  // Pré-textuais
  { key: 'capa',           patterns: ['capa', 'folha de rosto'] },
  { key: 'sumario',        patterns: ['sumário', 'sumario', 'índice'] },
  { key: 'apresentacao',   patterns: ['apresentação', 'apresentacao'] },

  // Identidade
  { key: 'historico',      patterns: ['histórico', 'historico', 'histórico da unidade', 'histórico escolar'] },
  { key: 'diagnostico',    patterns: ['diagnóstico', 'diagnostico', 'diagnóstico da realidade', 'realidade escolar'] },
  { key: 'funcao_social',  patterns: ['função social', 'funcao social'] },
  { key: 'missao',         patterns: ['missão', 'missao', 'missão da escola', 'missão institucional'] },
  { key: 'principios',     patterns: ['princípios', 'principios', 'princípios orientadores', 'valores'] },

  // Planejamento
  { key: 'metas',          patterns: ['metas', 'metas da unidade', 'objetivos e metas'] },
  { key: 'objetivos',      patterns: ['objetivos', 'objetivo geral', 'objetivos específicos', 'objetivos especificos'] },
  { key: 'fundamentos',    patterns: ['fundamentos', 'fundamentos teórico', 'fundamentos metodológicos', 'concepções'] },
  { key: 'org_curricular', patterns: ['organização curricular', 'organizacao curricular', 'currículo', 'curriculo'] },
  { key: 'org_trabalho',   patterns: ['organização do trabalho', 'trabalho pedagógico', 'organização pedagógica'] },

  // Ensino Médio (condicional)
  { key: 'itinerario',     patterns: ['itinerário formativo', 'itinerario formativo', 'percursos educacionais'] },
  { key: 'ifi',            patterns: ['itinerário formativo integrador', 'ifi', 'tempo integral'] },

  // Projetos
  { key: 'prog_institucionais', patterns: ['programas institucionais', 'projetos institucionais', 'programas e projetos'] },
  { key: 'proj_especificos',    patterns: ['projetos específicos', 'projetos especificos', 'projetos da escola'] },
  { key: 'proj_etnorracial',    patterns: ['étnico-racial', 'etnico-racial', 'relações étnico', 'história afro', 'cultura afro'] },
  { key: 'proj_maria_penha',    patterns: ['maria da penha', 'violência contra', 'combate ao machismo', 'lei maria da penha', 'violência doméstica'] },
  { key: 'proj_parcerias',      patterns: ['parcerias', 'projetos em parceria', 'organizações parceiras'] },

  // Avaliação e suporte
  { key: 'avaliacao',      patterns: ['processo avaliativo', 'avaliação', 'avaliacao', 'conselho de classe'] },
  { key: 'seaa',           patterns: ['seaa', 'serviço especializado de apoio', 'apoio à aprendizagem'] },
  { key: 'oe',             patterns: ['orientação educacional', 'orientacao educacional', 'serviço de orientação'] },
  { key: 'aee',            patterns: ['atendimento educacional especializado', 'aee', 'sala de recursos'] },

  // Profissionais
  { key: 'apoio_escolar',  patterns: ['profissionais de apoio', 'monitor', 'educador social voluntário', 'jovem candango'] },
  { key: 'biblioteca',     patterns: ['biblioteca', 'biblioteca escolar'] },
  { key: 'conselho_escolar', patterns: ['conselho escolar'] },
  { key: 'readaptados',    patterns: ['readaptados', 'profissionais readaptados', 'servidor readaptado'] },
  { key: 'coord_pedagogica', patterns: ['coordenação pedagógica', 'coordenacao pedagogica', 'coordenador pedagógico'] },

  // Gestão
  { key: 'permanencia',    patterns: ['abandono', 'evasão', 'reprovação', 'permanência', 'fluxo escolar'] },
  { key: 'implementacao',  patterns: ['implementação do ppp', 'implementacao do ppp', 'gestão escolar'] },
  { key: 'monitoramento',  patterns: ['monitoramento', 'acompanhamento do ppp', 'avaliação do ppp'] },

  // Pós-textuais
  { key: 'referencias',    patterns: ['referências', 'referencias', 'referências bibliográficas'] },
  { key: 'apendices',      patterns: ['apêndices', 'apendices', 'apêndice'] },
  { key: 'anexos',         patterns: ['anexos', 'anexo'] },
]

// ─── Detector principal ───────────────────────────────────────────────────────

/**
 * Recebe o texto completo do PPP e retorna um mapa de seções.
 * sectionMap[key] = { title, text, startPos, endPos, found: boolean }
 */
function detectSections(fullText) {
  const lines  = fullText.split('\n')
  const sectionMap = {}

  // Inicializa todas as chaves como não encontradas
  for (const s of SECTION_PATTERNS) {
    sectionMap[s.key] = { title: null, text: '', startPos: -1, endPos: -1, found: false }
  }

  // Primeira passagem: encontra o índice de linha de cada seção
  const hits = []  // { key, lineIndex, priority }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.length > 120) continue   // linhas muito longas não são títulos

    const normalized = normalizeText(line)

    for (const section of SECTION_PATTERNS) {
      for (const pattern of section.patterns) {
        if (matchesTitle(normalized, normalizeText(pattern))) {
          hits.push({ key: section.key, lineIndex: i, title: line })
          break
        }
      }
    }
  }

  // Segunda passagem: extrai o texto entre cada hit e o próximo
  for (let h = 0; h < hits.length; h++) {
    const hit     = hits[h]
    const nextHit = hits[h + 1]
    const startLine = hit.lineIndex
    const endLine   = nextHit ? nextHit.lineIndex : lines.length

    const sectionText = lines.slice(startLine + 1, endLine).join('\n').trim()

    sectionMap[hit.key] = {
      title:    hit.title,
      text:     sectionText,
      startPos: startLine,
      endPos:   endLine,
      found:    true,
    }
  }

  return sectionMap
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Uma linha é título de seção se:
 * - contém o padrão
 * - tem no máximo 60 chars (títulos reais são curtos)
 * - não começa com letra minúscula (evita detecção em meio de parágrafo)
 */
function matchesTitle(normalizedLine, normalizedPattern) {
  return (
    normalizedLine.includes(normalizedPattern) &&
    normalizedLine.length <= 80
  )
}

module.exports = { detectSections }
