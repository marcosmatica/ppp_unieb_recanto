// src/constants/feiraConstants.js

export const CATEGORIAS = [
  { value: 'A', label: 'A — Educação Infantil (Creche)', etapa: 'creche' },
  { value: 'B', label: 'B — Educação Infantil (Pré-escola)', etapa: 'pre_escola' },
  { value: 'C', label: 'C — Anos Iniciais (1º ao 3º ano)', etapa: 'anos_iniciais_1' },
  { value: 'D', label: 'D — Anos Iniciais (4º e 5º ano)', etapa: 'anos_iniciais_2' },
  { value: 'E', label: 'E — Anos Finais (6º e 7º ano)', etapa: 'anos_finais_1' },
  { value: 'F', label: 'F — Anos Finais (8º e 9º ano)', etapa: 'anos_finais_2' },
  { value: 'G', label: 'G — Ensino Médio (1ª série)', etapa: 'medio_1' },
  { value: 'H', label: 'H — Ensino Médio (2ª e 3ª série)', etapa: 'medio_2' },
  { value: 'I', label: 'I — Educação de Jovens e Adultos', etapa: 'eja' },
  { value: 'J', label: 'J — Educação Especial', etapa: 'especial' },
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
export const MIN_ESTUDANTES = 2
export const MAX_ESTUDANTES = 5
export const MAX_ORIENTADORES_POR_TRABALHO = 2
export const DEBOUNCE_AUTOSAVE_MS = 800
