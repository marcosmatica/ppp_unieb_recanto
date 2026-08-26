// src/constants/feiraConstants.js

export const CATEGORIAS = [
  { value: 'A', label: 'A – Educação Infantil', etapa: 'infantil' },
  { value: 'B', label: 'B – Ensino Fundamental – Anos Iniciais (1º ao 5º ano)', etapa: 'anos_iniciais' },
  { value: 'C', label: 'C – Ensino Fundamental – Anos Finais (6º ao 9º ano)', etapa: 'anos_finais' },
  { value: 'D', label: 'D – 1º Segmento da Educação de Jovens e Adultos e Educação Prisional', etapa: 'eja_1' },
  { value: 'E', label: 'E – 2º Segmento da Educação de Jovens e Adultos e Educação Prisional', etapa: 'eja_2' },
  { value: 'F', label: 'F – 3º Segmento da Educação de Jovens e Adultos, Ensino Médio Noturno e Educação Prisional', etapa: 'eja_3' },
  { value: 'G', label: 'G – Centro de Ensino Especial (CEE), EJA Interventiva, Sala de Recursos Generalista (SRG), Salas de Recursos Generalista Bilíngue (SRGB), Sala de Recursos Específica (SRE), Sala de Apoio à Aprendizagem (SAA) e Classe Especial (CE)', etapa: 'especial' },
  { value: 'H', label: 'H – Altas Habilidades/Superdotação (AH/SD)', etapa: 'ahsd' },
  { value: 'I', label: 'I – Ensino Médio Regular', etapa: 'medio' },
  { value: 'J', label: 'J – Ensino Médio em Tempo Integral (EMTI) e Educação Profissional e Tecnológica, nas formas: Concomitante, Subsequente e Integrada ao Ensino Médio ou à EJA', etapa: 'emti_ept' },
]

export const CRITERIOS_AVALIACAO = [
  { key: 'projeto_1', label: 'Estrutura conforme Anexo I e metodologia', item: 'I', maxPts: 10 },
  { key: 'projeto_2', label: 'Potencial para solucionar problemas locais', item: 'I', maxPts: 10 },
  { key: 'projeto_3', label: 'Alinhamento com tema do Circuito', item: 'I', maxPts: 10 },
  { key: 'diario_1', label: 'Diário registra o processo de pesquisa', item: 'II', maxPts: 10 },
  { key: 'diario_2', label: 'Banner sintetiza ideias centrais', item: 'II', maxPts: 10 },
  { key: 'oral_1', label: 'Complexidade e domínio do conteúdo', item: 'III', maxPts: 10 },
  { key: 'oral_2', label: 'Respostas ao avaliador', item: 'III', maxPts: 10 },
  { key: 'oral_3', label: 'Organização e engajamento do grupo', item: 'III', maxPts: 10 },
  { key: 'oral_4', label: 'Competências empreendedoras', item: 'III', maxPts: 10 },
  { key: 'oral_5', label: 'Recursos audiovisuais/experimentos', item: 'III', maxPts: 10 },
]

export const ITENS_AVALIACAO = [
  { key: 'I', label: 'Projeto de Pesquisa', maxPts: 30 },
  { key: 'II', label: 'Diário de Bordo e Banner', maxPts: 20 },
  { key: 'III', label: 'Apresentação Oral', maxPts: 50 },
]

export const MENCOES = [
  { valor: 0,   label: 'Ausente' },
  { valor: 5.0, label: 'Regular' },
  { valor: 5.5, label: 'Regular' },
  { valor: 6.0, label: 'Bom' },
  { valor: 6.5, label: 'Bom' },
  { valor: 7.0, label: 'Muito bom' },
  { valor: 7.5, label: 'Muito bom' },
  { valor: 8.0, label: 'Ótimo' },
  { valor: 8.5, label: 'Ótimo' },
  { valor: 9.0, label: 'Excelente' },
  { valor: 9.5, label: 'Excelente' },
  { valor: 10,  label: 'Supera as expectativas' },
]

export const VALORES_NOTA = MENCOES.map(m => m.valor)

export const STATUS_INSCRICAO = {
  rascunho: { label: 'Rascunho', cor: 'gray' },
  enviada: { label: 'Enviada', cor: 'blue' },
  em_analise: { label: 'Em análise', cor: 'yellow' },
  devolvida: { label: 'Devolvida', cor: 'orange' },
  reenviada: { label: 'Reenviada', cor: 'blue' },
  em_reanalise: { label: 'Em reanálise', cor: 'yellow' },
  aprovada: { label: 'Aprovada', cor: 'green' },
  indeferida: { label: 'Indeferida', cor: 'red' },
  avaliada: { label: 'Avaliada', cor: 'purple' },
  resultado_preliminar: { label: 'Resultado preliminar', cor: 'purple' },
  resultado_final: { label: 'Resultado final', cor: 'purple' },
  classificada_distrital: { label: 'Classificada', cor: 'green' },
  nao_classificada: { label: 'Não classificada', cor: 'red' },
}

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
export const ACCEPTED_FILE_TYPES = { 'application/pdf': ['.pdf'] }
// Defaults — cada edição pode sobrescrever em `edicao.limites`.
export const MIN_ESTUDANTES = 2
export const MAX_ESTUDANTES = 5
export const MIN_ORIENTADORES = 1
export const MAX_ORIENTADORES_POR_TRABALHO = 2
export const MIN_PROJETOS_POR_ORIENTADOR = 0
export const MAX_PROJETOS_POR_ORIENTADOR = 3
export const DEBOUNCE_AUTOSAVE_MS = 800

export function getLimites(edicao) {
  const l = edicao?.limites || {}
  return {
    orientadores_min: Number(l.orientadores_min ?? MIN_ORIENTADORES),
    orientadores_max: Number(l.orientadores_max ?? MAX_ORIENTADORES_POR_TRABALHO),
    estudantes_min: Number(l.estudantes_min ?? MIN_ESTUDANTES),
    estudantes_max: Number(l.estudantes_max ?? MAX_ESTUDANTES),
    projetos_por_orientador_min: Number(l.projetos_por_orientador_min ?? MIN_PROJETOS_POR_ORIENTADOR),
    projetos_por_orientador_max: Number(l.projetos_por_orientador_max ?? MAX_PROJETOS_POR_ORIENTADOR),
  }
}

// Normaliza uma inscrição/rascunho antigo (orientador + orientador2) para o formato novo (orientadores[]).
export function normalizarOrientadores(reg) {
  if (Array.isArray(reg?.orientadores) && reg.orientadores.length) return reg.orientadores
  const arr = []
  if (reg?.orientador?.nome) arr.push(reg.orientador)
  if (reg?.orientador2?.nome) arr.push(reg.orientador2)
  return arr
}
