// src/services/indicadoresEI.js

export const METAS_EI = [
  {
    code: 'M1',
    label: 'Gestão de sistemas e redes de ensino',
    indicadores: [
      { code: '1.1', label: 'Gestão de acesso, oferta e matrícula' },
    ],
  },
  {
    code: 'M2',
    label: 'Formação e remuneração dos profissionais',
    indicadores: [
      { code: '2.1', label: 'Habilitação' },
      { code: '2.2', label: 'Formação continuada' },
      { code: '2.3', label: 'Condições de trabalho adequadas' },
    ],
  },
  {
    code: 'M3',
    label: 'Gestão das instituições de Educação Infantil',
    indicadores: [
      { code: '3.1', label: 'Organização Institucional' },
      { code: '3.2', label: 'Proposta Pedagógica' },
      { code: '3.3', label: 'Planejamento pedagógico' },
      { code: '3.4', label: 'Registro da prática educativa / escrituração' },
      { code: '3.5', label: 'Coordenação Pedagógica' },
      { code: '3.6', label: 'Alimentação saudável das crianças' },
      { code: '3.7', label: 'Limpeza, salubridade e conforto' },
      { code: '3.8', label: 'Segurança' },
    ],
  },
  {
    code: 'M4',
    label: 'Currículos, interações e práticas pedagógicas',
    indicadores: [
      { code: '4.1', label: 'Crianças construindo sua autonomia nas práticas sociais' },
      { code: '4.2', label: 'Crianças expressando-se por diferentes campos de experiências' },
      { code: '4.3', label: 'Crianças com experiências variadas de linguagem oral e escrita' },
      { code: '4.4', label: 'Crianças reconhecendo identidade e valorizando diferenças' },
      { code: '4.5', label: 'Respeito à identidade, desejos e interesses das crianças' },
      { code: '4.6', label: 'Respeito às ideias, conquistas e produções das crianças' },
      { code: '4.7', label: 'Interação entre crianças, adultos e instituições' },
    ],
  },
  {
    code: 'M5',
    label: 'Interação com a família e comunidade',
    indicadores: [
      { code: '5.1', label: 'Respeito e acolhimento' },
      { code: '5.2', label: 'Garantia de direitos das famílias de participar e acompanhar' },
    ],
  },
  {
    code: 'M6',
    label: 'Intersetorialidade',
    indicadores: [
      { code: '6.1', label: 'Rede de proteção dos direitos das crianças' },
      { code: '6.2', label: 'Cuidado integral das crianças' },
      { code: '6.3', label: 'Participação das crianças' },
      { code: '6.4', label: 'Participação social intersetorial' },
    ],
  },
  {
    code: 'M7',
    label: 'Espaços, materiais e mobiliários',
    indicadores: [
      { code: '7.1', label: 'Espaços e mobiliários que favorecem as experiências das crianças' },
      { code: '7.2', label: 'Materiais variados e acessíveis às crianças' },
      { code: '7.3', label: 'Espaços, materiais e mobiliários para necessidades dos adultos' },
    ],
  },
  {
    code: 'M8',
    label: 'Infraestrutura',
    indicadores: [
      { code: '8.1', label: 'Localização, entorno, acesso e condicionantes físicos' },
      { code: '8.2', label: 'Programa de necessidades, setorização, fluxo e proporções' },
    ],
  },
]

export const DESCRIPTOR_LABELS = [
  '',
  'Insuficiente',
  'Abaixo do esperado',
  'Em desenvolvimento',
  'Adequado',
  'Referência',
]

export function getIndicadorByCode(code) {
  for (const meta of METAS_EI) {
    const ind = meta.indicadores.find(i => i.code === code)
    if (ind) return { ...ind, meta }
  }
  return null
}
