/**
 * functions/src/report/documentBuilder.js
 * Constrói o .docx de parecer final a partir dos dados da análise.
 * Usa a biblioteca docx (npm install docx).
 */

'use strict'

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, HeadingLevel,
  TabStopType, TabStopPosition,
} = require('docx')

// ─── Constantes de layout ─────────────────────────────────────────────────────

// A4 em DXA (1440 DXA = 1 polegada; 1 cm ≈ 567 DXA)
const PAGE_W      = 11906
const PAGE_H      = 16838
const MARGIN      = 1134   // ~2 cm
const CONTENT_W   = PAGE_W - MARGIN * 2   // 9638 DXA

// Cores
const COLOR_DARK   = '1A2B4A'   // azul escuro SEEDF
const COLOR_BLUE   = '1E6BBF'
const COLOR_GOLD   = 'C8940A'
const COLOR_RED    = 'B91C1C'
const COLOR_AMBER  = 'B45309'
const COLOR_GREEN  = '166534'
const COLOR_GRAY   = '4B5563'
const COLOR_LGRAY  = 'F3F4F6'   // fundo cinza claro
const COLOR_LRED   = 'FEF2F2'
const COLOR_LAMBER = 'FFFBEB'
const COLOR_LGREEN = 'F0FDF4'
const COLOR_LBLUE  = 'EFF6FF'
const COLOR_WHITE  = 'FFFFFF'

// Bordas de tabela
const borderNone  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const borderLight = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
const borderMed   = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' }

const BLOCK_LABELS = {
  B1:'Elementos Pré-textuais', B2:'Identidade da Unidade Escolar',
  B3:'Planejamento Pedagógico', B4:'Ensino Médio',
  B5:'Programas e Projetos', B6:'Avaliação e Suporte',
  B7:'Profissionais e Estruturas', B8:'Gestão Escolar',
  B9:'Elementos Pós-textuais',
}

const STATUS_LABEL = {
  critical:   'CRÍTICO',
  attention:  'ATENÇÃO',
  adequate:   'ADEQUADO',
  overridden: 'REV. ANALISTA',
}

const STATUS_COLOR = {
  critical:   COLOR_RED,
  attention:  COLOR_AMBER,
  adequate:   COLOR_GREEN,
  overridden: COLOR_BLUE,
}

const STATUS_BG = {
  critical:   COLOR_LRED,
  attention:  COLOR_LAMBER,
  adequate:   COLOR_LGREEN,
  overridden: COLOR_LBLUE,
}

// ─── Helpers tipográficos ─────────────────────────────────────────────────────

const run = (text, opts = {}) => new TextRun({
  text,
  font: 'Arial',
  size: opts.size || 22,          // 11pt padrão
  bold: opts.bold || false,
  italics: opts.italic || false,
  color: opts.color || COLOR_DARK,
  ...opts,
})

const para = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  spacing: { before: opts.before || 0, after: opts.after || 120 },
  alignment: opts.align || AlignmentType.LEFT,
  ...opts,
})

const emptyLine = (n = 1) =>
  Array.from({ length: n }, () => para([run('')], { after: 0 }))

const heading1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [run(text, { bold: true, size: 28, color: COLOR_DARK })],
  spacing: { before: 360, after: 160 },
  border: {
    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BLUE, space: 4 },
  },
})

const heading2 = (text, color = COLOR_DARK) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [run(text, { bold: true, size: 24, color })],
  spacing: { before: 240, after: 100 },
})

const heading3 = (text, color = COLOR_GRAY) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [run(text, { bold: true, size: 22, color })],
  spacing: { before: 160, after: 80 },
})

// ─── Tabela de resumo (4 colunas) ─────────────────────────────────────────────

function buildSummaryTable(stats) {
  const colW = Math.floor(CONTENT_W / 4)

  const makeCell = (label, value, bg, textColor) =>
    new TableCell({
      width: { size: colW, type: WidthType.DXA },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 120, right: 120 },
      borders: {
        top: borderLight, bottom: borderLight,
        left: borderLight, right: borderLight,
      },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        para([run(String(value), { bold: true, size: 40, color: textColor })],
          { align: AlignmentType.CENTER, after: 40 }),
        para([run(label, { size: 18, color: textColor })],
          { align: AlignmentType.CENTER, after: 0 }),
      ],
    })

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [colW, colW, colW, CONTENT_W - colW * 3],
    rows: [
      new TableRow({
        children: [
          makeCell('Críticos',   stats.critical  || 0, COLOR_LRED,   COLOR_RED),
          makeCell('Atenção',    stats.attention || 0, COLOR_LAMBER, COLOR_AMBER),
          makeCell('Adequados',  stats.adequate  || 0, COLOR_LGREEN, COLOR_GREEN),
          makeCell('Total',      stats.total     || 0, COLOR_LGRAY,  COLOR_GRAY),
        ],
      }),
    ],
  })
}

// ─── Tabela de um elemento ────────────────────────────────────────────────────

// functions/src/report/documentBuilder.js - versão melhorada

function buildElementRow(el, index) {
  const status = el.effectiveStatus || 'adequate'
  const statusLbl = STATUS_LABEL[status] || status.toUpperCase()
  const statusClr = STATUS_COLOR[status] || COLOR_GRAY
  const statusBg = STATUS_BG[status] || COLOR_LGRAY

  const summary = el.aiResult?.summary || ''
  const missing = el.aiResult?.missingItems || []
  const legalMiss = el.aiResult?.legalRefs?.missing || []
  const analystNote = el.humanReview?.comment || ''
  const excerpts = el.aiResult?.excerpts || []

// Na seção de trechos
  if (excerpts.length > 0) {
    rightChildren.push(
        para([run('📌 Trechos localizados no documento:', { bold: true, size: 18, color: COLOR_BLUE })], { after: 60 })
    )
    excerpts.forEach((ex, idx) => {
      const sectionLabel = ex.section ? `[${ex.section}]` : ''
      rightChildren.push(
          new Paragraph({
            children: [
              run(`"${ex.text}"`, { size: 18, italic: true, color: COLOR_DARK }),
            ],
            spacing: { before: 0, after: 40 },
            indent: { left: 360 },
          }),
          para([run(sectionLabel, { size: 14, color: COLOR_GRAY })], { after: 80 })
      )
    })
  }

  // Coluna esquerda (igual)
  const leftCell = new TableCell({
    width: { size: 1600, type: WidthType.DXA },
    shading: { fill: statusBg, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 100 },
    borders: {
      top: borderLight, bottom: borderLight,
      left: { style: BorderStyle.SINGLE, size: 12, color: statusClr },
      right: borderLight,
    },
    verticalAlign: VerticalAlign.TOP,
    children: [
      para([run(statusLbl, { bold: true, size: 18, color: statusClr })], { after: 60 }),
      para([run(`${index}. ${el.label}`, { bold: true, size: 20, color: COLOR_DARK })], { after: 60 }),
      para([run(el.normRef || '', { size: 16, italic: true, color: COLOR_GRAY })], { after: 0 }),
    ],
  })

  // Coluna direita - versão melhorada com MÚLTIPLOS trechos
  const rightChildren = []

  // Resumo da análise
  if (summary) {
    rightChildren.push(
        para([run('📋 Análise:', { bold: true, size: 18, color: COLOR_BLUE })], { after: 40 }),
        para([run(summary, { size: 20, color: COLOR_DARK })], { after: 80 })
    )
  }

  // TRECHOS LOCALIZADOS - agora mostra TODOS
  if (excerpts.length > 0) {
    rightChildren.push(
        para([run('📌 Trechos localizados no documento:', { bold: true, size: 18, color: COLOR_BLUE })], { after: 60 })
    )

    excerpts.forEach((ex, idx) => {
      const sectionLabel = ex.section ? `[${ex.section}]` : ''
      rightChildren.push(
          new Paragraph({
            children: [
              run(`"${ex.text}"`, { size: 18, italic: true, color: COLOR_DARK }),
            ],
            spacing: { before: 0, after: 40 },
            indent: { left: 360 },
          }),
          para([run(sectionLabel, { size: 14, color: COLOR_GRAY })], { after: 80 })
      )
    })
  }

  // Itens ausentes
  if (legalMiss.length > 0) {
    rightChildren.push(
        para([run('⚠️ Referências legais ausentes: ' + legalMiss.join(', '),
            { size: 18, color: COLOR_RED, bold: true })], { after: 60 })
    )
  }

  if (missing.length > 0) {
    rightChildren.push(
        para([run('❌ Itens não encontrados:', { size: 18, bold: true, color: COLOR_DARK })],
            { after: 40 })
    )
    for (const item of missing) {
      rightChildren.push(
          new Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            children: [run(item, { size: 18, color: COLOR_DARK })],
            spacing: { before: 0, after: 40 },
          })
      )
    }
  }

  // Observação do analista
  if (analystNote) {
    rightChildren.push(
        para([
          run('✏️ Observação do analista: ', { size: 18, bold: true, color: COLOR_BLUE }),
          run(analystNote, { size: 18, italic: true, color: COLOR_BLUE }),
        ], { after: 0 })
    )
  }

  if (rightChildren.length === 0) {
    rightChildren.push(para([run('—', { size: 20, color: COLOR_GRAY })], { after: 0 }))
  }

  const rightCell = new TableCell({
    width: { size: CONTENT_W - 1600, type: WidthType.DXA },
    shading: { fill: COLOR_WHITE, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 120 },
    borders: {
      top: borderLight, bottom: borderLight,
      left: borderLight, right: borderLight,
    },
    children: rightChildren,
  })

  return new TableRow({ children: [leftCell, rightCell] })
}

function buildElementsTable(elements, statuses) {
  const filtered = elements.filter(e => statuses.includes(e.effectiveStatus))
  if (filtered.length === 0) return null

  const rows = filtered.map((el, i) => buildElementRow(el, i + 1))

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1600, CONTENT_W - 1600],
    rows,
  })
}

// ─── Tabela de considerações finais por bloco ─────────────────────────────────

function buildBlockSummaryTable(elements) {
  const pending = elements.filter(e =>
    ['critical', 'attention'].includes(e.effectiveStatus)
  )
  if (pending.length === 0) return null

  const byBlock = {}
  for (const el of pending) {
    const b = el.blockCode || 'B?'
    if (!byBlock[b]) byBlock[b] = []
    byBlock[b].push(el)
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        shading: { fill: COLOR_DARK, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        borders: { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone },
        children: [para([run('Bloco', { bold: true, size: 20, color: COLOR_WHITE })], { after: 0 })],
      }),
      new TableCell({
        width: { size: 4600, type: WidthType.DXA },
        shading: { fill: COLOR_DARK, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        borders: { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone },
        children: [para([run('Elemento', { bold: true, size: 20, color: COLOR_WHITE })], { after: 0 })],
      }),
      new TableCell({
        width: { size: CONTENT_W - 7000, type: WidthType.DXA },
        shading: { fill: COLOR_DARK, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        borders: { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone },
        children: [para([run('Situação', { bold: true, size: 20, color: COLOR_WHITE })], { after: 0 })],
      }),
    ],
  })

  const dataRows = []
  let alt = false
  for (const [blockCode, els] of Object.entries(byBlock).sort()) {
    for (const el of els) {
      const s = el.effectiveStatus
      dataRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 100 },
              borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
              children: [para([run(BLOCK_LABELS[blockCode] || blockCode, { size: 18, color: COLOR_GRAY })], { after: 0 })],
            }),
            new TableCell({
              width: { size: 4600, type: WidthType.DXA },
              shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 100 },
              borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
              children: [para([run(el.label, { size: 18, bold: true, color: COLOR_DARK })], { after: 0 })],
            }),
            new TableCell({
              width: { size: CONTENT_W - 7000, type: WidthType.DXA },
              shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 100 },
              borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
              children: [para([run(STATUS_LABEL[s] || s, { size: 18, bold: true, color: STATUS_COLOR[s] || COLOR_GRAY })], { after: 0 })],
            }),
          ],
        })
      )
      alt = !alt
    }
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 4600, CONTENT_W - 7000],
    rows: [headerRow, ...dataRows],
  })
}

// ─── Header e Footer da página ────────────────────────────────────────────────

function buildHeader(schoolName, year) {
  return new Header({
    children: [
      new Paragraph({
        children: [
          run('SECRETARIA DE ESTADO DE EDUCAÇÃO DO DISTRITO FEDERAL  |  ',
            { size: 16, color: COLOR_GRAY }),
          run(`Parecer Técnico-Pedagógico — PPP ${year}`,
            { size: 16, bold: true, color: COLOR_DARK }),
        ],
        spacing: { after: 40 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BLUE, space: 4 },
        },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      }),
      para([run(schoolName, { size: 18, italic: true, color: COLOR_GRAY })], { after: 0 }),
    ],
  })
}

function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          run('Portaria SEEDF nº 139/2024 · Portaria nº 174/2026  |  Página ',
            { size: 16, color: COLOR_GRAY }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: COLOR_GRAY }),
          run(' de ', { size: 16, color: COLOR_GRAY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: COLOR_GRAY }),
        ],
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 },
        },
        spacing: { before: 60, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      }),
    ],
  })
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Constrói o buffer .docx do parecer.
 *
 * @param {Object} opts
 * @param {Object} opts.analysis      - doc da coleção /analyses
 * @param {Array}  opts.elements      - array de elementResults (todos)
 * @param {string} opts.analystNotes  - observações do analista
 * @param {string} opts.decision      - "approved_with_remarks" | "rejected"
 * @param {string} opts.analystName   - nome do analista (do perfil)
 * @returns {Promise<Buffer>}
 */
async function buildParecer({ analysis, elements, analystNotes, decision, analystName }) {
  const { schoolName, cre, year } = analysis
  const stats  = analysis.stats || {}
  const now    = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })

  const decisionLabel = decision === 'approved_with_remarks'
    ? 'APROVADO COM RESSALVAS'
    : 'REPROVADO'
  const decisionColor = decision === 'approved_with_remarks' ? COLOR_AMBER : COLOR_RED
  const decisionBg    = decision === 'approved_with_remarks' ? COLOR_LAMBER : COLOR_LRED

  const criticalEls  = elements.filter(e => e.effectiveStatus === 'critical')
  const attentionEls = elements.filter(e => e.effectiveStatus === 'attention')
  const adequateEls  = elements.filter(e => e.effectiveStatus === 'adequate')

  // ── Capa ────────────────────────────────────────────────────────────────────
  const coverChildren = [
    ...emptyLine(4),
    para([run('SECRETARIA DE ESTADO DE EDUCAÇÃO DO DISTRITO FEDERAL',
      { bold: true, size: 24, color: COLOR_GRAY })],
      { align: AlignmentType.CENTER, after: 80 }),
    para([run('Coordenação Regional de Ensino', { size: 22, color: COLOR_GRAY })],
      { align: AlignmentType.CENTER, after: 80 }),
    para([run(cre || '', { size: 22, color: COLOR_BLUE })],
      { align: AlignmentType.CENTER, after: 560 }),

    para([run('PARECER TÉCNICO-PEDAGÓGICO', { bold: true, size: 40, color: COLOR_DARK })],
      { align: AlignmentType.CENTER, after: 80 }),
    para([run(`Projeto Político-Pedagógico ${year}`, { size: 28, color: COLOR_BLUE })],
      { align: AlignmentType.CENTER, after: 400 }),

    para([run(schoolName, { bold: true, size: 32, color: COLOR_DARK })],
      { align: AlignmentType.CENTER, after: 200 }),

    // Caixa de decisão
    new Table({
      width: { size: 4000, type: WidthType.DXA },
      columnWidths: [4000],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              shading: { fill: decisionBg, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              borders: {
                top:    { style: BorderStyle.SINGLE, size: 12, color: decisionColor },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: decisionColor },
                left:   { style: BorderStyle.SINGLE, size: 12, color: decisionColor },
                right:  { style: BorderStyle.SINGLE, size: 12, color: decisionColor },
              },
              children: [
                para([run(decisionLabel, { bold: true, size: 32, color: decisionColor })],
                  { align: AlignmentType.CENTER, after: 0 }),
              ],
            }),
          ],
        }),
      ],
    }),

    ...emptyLine(2),
    para([run(`Brasília, ${dateStr}`, { size: 20, color: COLOR_GRAY })],
      { align: AlignmentType.CENTER, after: 40 }),
    para([run(`Analista: ${analystName || '—'}`, { size: 20, italic: true, color: COLOR_GRAY })],
      { align: AlignmentType.CENTER, after: 0 }),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  // ── Seção 1: Identificação ──────────────────────────────────────────────────
  const identChildren = [
    heading1('1. Identificação'),
    buildIdentTable(analysis, dateStr, analystName, decisionLabel, decisionColor),
    ...emptyLine(1),
  ]

  // ── Seção 2: Resumo executivo ───────────────────────────────────────────────
  const resumoChildren = [
    heading1('2. Resumo Executivo'),
    para([run('A tabela abaixo apresenta o consolidado da verificação dos elementos do PPP:',
      { size: 20 })], { after: 160 }),
    buildSummaryTable(stats),
    ...emptyLine(1),
  ]

  // Tabela de considerações por bloco
  const blockTable = buildBlockSummaryTable(elements)
  if (blockTable) {
    resumoChildren.push(
      para([run('Elementos com pendências identificadas:', { bold: true, size: 20 })], { after: 120 }),
      blockTable,
      ...emptyLine(1),
    )
  }

  // ── Seção 3: Elementos críticos ─────────────────────────────────────────────
  const critChildren = []
  if (criticalEls.length > 0) {
    critChildren.push(heading1('3. Elementos Críticos'))
    critChildren.push(para([
      run('Os elementos a seguir estão ', { size: 20 }),
      run('ausentes ou inadequados', { bold: true, size: 20, color: COLOR_RED }),
      run(' e impedem a aprovação do PPP sem correção:', { size: 20 }),
    ], { after: 160 }))
    critChildren.push(buildElementsTable(elements, ['critical']))
    critChildren.push(...emptyLine(1))
  }

  // ── Seção 4: Elementos com atenção ──────────────────────────────────────────
  const attChildren = []
  if (attentionEls.length > 0) {
    const secNum = criticalEls.length > 0 ? '4' : '3'
    attChildren.push(heading1(`${secNum}. Elementos com Necessidade de Ajuste`))
    attChildren.push(para([
      run('Os elementos a seguir estão ', { size: 20 }),
      run('presentes mas necessitam de complementação', { bold: true, size: 20, color: COLOR_AMBER }),
      run(':', { size: 20 }),
    ], { after: 160 }))
    attChildren.push(buildElementsTable(elements, ['attention']))
    attChildren.push(...emptyLine(1))
  }

  // ── Seção 5: Elementos adequados ────────────────────────────────────────────
  const baseN = 3 + (criticalEls.length > 0 ? 1 : 0) + (attentionEls.length > 0 ? 1 : 0)
  const adeChildren = []
  if (adequateEls.length > 0) {
    adeChildren.push(heading1(`${baseN}. Elementos Verificados e Adequados`))
    const table = buildElementsTable(elements, ['adequate', 'overridden'])
    if (table) adeChildren.push(table)
    adeChildren.push(...emptyLine(1))
  }

  // ── Seção final: Considerações e Decisão ────────────────────────────────────
  const finalN = baseN + (adequateEls.length > 0 ? 1 : 0)
  const finalChildren = [
    heading1(`${finalN}. Considerações Finais e Decisão`),
  ]

  if (analystNotes?.trim()) {
    finalChildren.push(heading2('Observações do Analista', COLOR_BLUE))
    finalChildren.push(para([run(analystNotes.trim(), { size: 20 })], { after: 200 }))
  }

  finalChildren.push(heading2('Orientações para a Unidade Escolar', COLOR_DARK))

  if (criticalEls.length > 0) {
    finalChildren.push(para([
      run('A unidade escolar deverá corrigir todos os ',  { size: 20 }),
      run(`${criticalEls.length} elemento(s) crítico(s)`, { bold: true, size: 20, color: COLOR_RED }),
      run(' listados na Seção 3 antes da reapresentação do PPP.', { size: 20 }),
    ], { after: 120 }))
  }

  if (attentionEls.length > 0) {
    finalChildren.push(para([
      run(`Os ${attentionEls.length} elemento(s) com atenção `,  { size: 20 }),
      run('devem ser complementados', { bold: true, size: 20, color: COLOR_AMBER }),
      run(' conforme as orientações desta análise.', { size: 20 }),
    ], { after: 120 }))
  }

  finalChildren.push(
    para([run('Prazo para reapresentação: 5 (cinco) dias úteis a partir do recebimento deste parecer, '
      + 'conforme Art. 10, II da Portaria SEEDF nº 139/2024.', { size: 20, italic: true, color: COLOR_GRAY })],
      { after: 320 })
  )

  // Caixa de decisão final
  finalChildren.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { fill: decisionBg, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 240, right: 240 },
              borders: {
                top:    { style: BorderStyle.SINGLE, size: 16, color: decisionColor },
                bottom: { style: BorderStyle.SINGLE, size: 16, color: decisionColor },
                left:   { style: BorderStyle.SINGLE, size: 16, color: decisionColor },
                right:  { style: BorderStyle.SINGLE, size: 16, color: decisionColor },
              },
              children: [
                para([run('DECISÃO DO PARECER', { bold: true, size: 20, color: COLOR_GRAY })],
                  { align: AlignmentType.CENTER, after: 80 }),
                para([run(decisionLabel, { bold: true, size: 36, color: decisionColor })],
                  { align: AlignmentType.CENTER, after: 80 }),
                para([run(schoolName + ' · PPP ' + year, { size: 20, italic: true, color: COLOR_GRAY })],
                  { align: AlignmentType.CENTER, after: 0 }),
              ],
            }),
          ],
        }),
      ],
    })
  )

  finalChildren.push(...emptyLine(3))
  finalChildren.push(
    para([run('_'.repeat(52), { size: 22, color: COLOR_DARK })],
      { align: AlignmentType.CENTER, after: 80 })
  )
  finalChildren.push(
    para([run(analystName || 'Analista da Unieb', { bold: true, size: 22, color: COLOR_DARK })],
      { align: AlignmentType.CENTER, after: 40 })
  )
  finalChildren.push(
    para([run(cre || '', { size: 20, color: COLOR_GRAY })],
      { align: AlignmentType.CENTER, after: 40 })
  )
  finalChildren.push(
    para([run('Brasília, ' + dateStr, { size: 20, italic: true, color: COLOR_GRAY })],
      { align: AlignmentType.CENTER, after: 0 })
  )

  // ── Monta o documento ────────────────────────────────────────────────────────
  const pageProps = {
    page: {
      size:   { width: PAGE_W, height: PAGE_H },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    },
  }

  const doc = new Document({
    title:    `Parecer Técnico-Pedagógico — ${schoolName} — PPP ${year}`,
    subject:  'Análise de Projeto Político-Pedagógico',
    creator:  'Plataforma PPP Analisador · SEEDF',
    keywords: 'PPP SEEDF análise parecer',

    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: COLOR_DARK },
          paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: COLOR_DARK },
          paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: COLOR_GRAY },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
        },
      ],
    },

    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '\u2013',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 560, hanging: 280 } } },
          }],
        },
      ],
    },

    sections: [
      // Capa: sem header/footer
      {
        properties: pageProps,
        children: coverChildren,
      },
      // Conteúdo: com header e footer
      {
        properties: pageProps,
        headers: { default: buildHeader(schoolName, year) },
        footers: { default: buildFooter() },
        children: [
          ...identChildren,
          ...resumoChildren,
          ...critChildren,
          ...attChildren,
          ...adeChildren,
          ...finalChildren,
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}

// ─── Tabela de identificação ──────────────────────────────────────────────────

function buildIdentTable(analysis, dateStr, analystName, decisionLabel, decisionColor) {
  const rowDef = (label, value, valueBold = false) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 2800, type: WidthType.DXA },
          shading: { fill: COLOR_LGRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 100 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          children: [para([run(label, { size: 18, bold: true, color: COLOR_GRAY })], { after: 0 })],
        }),
        new TableCell({
          width: { size: CONTENT_W - 2800, type: WidthType.DXA },
          shading: { fill: COLOR_WHITE, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          children: [para([run(String(value || '—'), {
            size: 18, bold: valueBold, color: COLOR_DARK,
          })], { after: 0 })],
        }),
      ],
    })

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, CONTENT_W - 2800],
    rows: [
      rowDef('Unidade Escolar',         analysis.schoolName, true),
      rowDef('CRE',                     analysis.cre),
      rowDef('Ano do PPP',              analysis.year),
      rowDef('Data da análise',         dateStr),
      rowDef('Analista responsável',    analystName || '—'),
      rowDef('Decisão',                 decisionLabel, true),
      rowDef('Base normativa',          'Portaria SEEDF nº 139/2024 · Portaria nº 174/2026'),
    ],
  })
}

module.exports = { buildParecer }
