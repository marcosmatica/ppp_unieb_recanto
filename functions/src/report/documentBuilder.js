/**
 * functions/src/report/documentBuilder.js
 * Constrói o .docx de parecer final a partir dos dados da análise.
 *
 * v2: adequate_implicit tratado como status positivo (aprovado)
 *     com nota descritiva diferenciada no parecer.
 */

'use strict'

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, HeadingLevel,
  TabStopType, TabStopPosition,
} = require('docx')

// ─── Layout ───────────────────────────────────────────────────────────────────

const PAGE_W    = 11906
const PAGE_H    = 16838
const MARGIN    = 1134
const CONTENT_W = PAGE_W - MARGIN * 2

// Cores
const COLOR_DARK   = '1A2B4A'
const COLOR_BLUE   = '1E6BBF'
const COLOR_GOLD   = 'C8940A'
const COLOR_RED    = 'B91C1C'
const COLOR_AMBER  = 'B45309'
const COLOR_GREEN  = '166534'
const COLOR_TEAL   = '0F766E'   // cor para adequate_implicit
const COLOR_GRAY   = '4B5563'
const COLOR_LGRAY  = 'F3F4F6'
const COLOR_LRED   = 'FEF2F2'
const COLOR_LAMBER = 'FFFBEB'
const COLOR_LGREEN = 'F0FDF4'
const COLOR_LTEAL  = 'F0FDFA'   // fundo para adequate_implicit
const COLOR_LBLUE  = 'EFF6FF'
const COLOR_WHITE  = 'FFFFFF'

const borderNone  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const borderLight = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }

const BLOCK_LABELS = {
  B1: 'Elementos Pré-textuais',   B2: 'Identidade da Unidade Escolar',
  B3: 'Planejamento Pedagógico',  B4: 'Ensino Médio',
  B5: 'Programas e Projetos',     B6: 'Avaliação e Suporte',
  B7: 'Profissionais e Estruturas', B8: 'Gestão Escolar',
  B9: 'Elementos Pós-textuais',
}

// ─── Status: labels, cores e agrupamento ─────────────────────────────────────

// Todos os status positivos (aprovação)
const POSITIVE_STATUSES = new Set(['adequate', 'adequate_implicit', 'overridden'])

const STATUS_LABEL = {
  critical:          'CRÍTICO',
  attention:         'ATENÇÃO',
  adequate:          'ADEQUADO',
  adequate_implicit: 'ADEQUADO (IMPL.)',
  overridden:        'REV. ANALISTA',
}

const STATUS_COLOR = {
  critical:          COLOR_RED,
  attention:         COLOR_AMBER,
  adequate:          COLOR_GREEN,
  adequate_implicit: COLOR_TEAL,
  overridden:        COLOR_BLUE,
}

const STATUS_BG = {
  critical:          COLOR_LRED,
  attention:         COLOR_LAMBER,
  adequate:          COLOR_LGREEN,
  adequate_implicit: COLOR_LTEAL,
  overridden:        COLOR_LBLUE,
}

// ─── Helpers tipográficos ─────────────────────────────────────────────────────

const run = (text, opts = {}) => new TextRun({
  text,
  font: 'Arial',
  size: opts.size || 22,
  bold: opts.bold || false,
  italics: opts.italic || false,
  color: opts.color || COLOR_DARK,
  ...opts,
})

const para = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  spacing: { before: opts.before || 0, after: opts.after ?? 160 },
  alignment: opts.align || AlignmentType.LEFT,
  ...opts,
})

const emptyLine = (n = 1) => Array(n).fill(null).map(() =>
  new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { after: 0 } })
)

const heading1 = (text) => new Paragraph({
  children: [run(text, { size: 26, bold: true, color: COLOR_DARK })],
  spacing: { before: 360, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_GOLD, space: 4 } },
})

// ─── buildIdentTable ──────────────────────────────────────────────────────────

function buildIdentTable(analysis, dateStr, analystName, decisionLabel, decisionColor) {
  const rows = [
    ['Escola', analysis.schoolName],
    ['CRE', analysis.cre || '—'],
    ['Ano do PPP', String(analysis.year)],
    ['Data do Parecer', dateStr],
    ['Analista Responsável', analystName || '—'],
    ['Decisão', decisionLabel],
  ]

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2600, CONTENT_W - 2600],
    rows: rows.map(([label, value], i) => new TableRow({
      children: [
        new TableCell({
          shading: { fill: COLOR_LGRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 80 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          children: [para([run(label, { size: 20, bold: true })], { after: 0 })],
        }),
        new TableCell({
          shading: {
            fill: label === 'Decisão' ? STATUS_BG[decisionColor] || COLOR_WHITE : COLOR_WHITE,
            type: ShadingType.CLEAR,
          },
          margins: { top: 80, bottom: 80, left: 120, right: 80 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          children: [para([run(value, {
            size: 20,
            bold: label === 'Decisão',
            color: label === 'Decisão' ? decisionColor : COLOR_DARK,
          })], { after: 0 })],
        }),
      ],
    })),
  })
}

// ─── buildSummaryTable ────────────────────────────────────────────────────────

function buildSummaryTable(stats) {
  // adequate agrupa adequate + adequate_implicit para exibição no resumo
  const adequateTotal = (stats.adequate || 0)  // stats.adequate já inclui adequate_implicit no index.js
  const implicitCount = stats.adequate_implicit || 0

  const rows = [
    { label: 'Total de elementos verificados', value: String(stats.total || 0),    color: COLOR_DARK  },
    { label: 'Elementos críticos',             value: String(stats.critical || 0), color: COLOR_RED   },
    { label: 'Elementos com atenção',          value: String(stats.attention || 0),color: COLOR_AMBER },
    { label: 'Elementos adequados',            value: String(adequateTotal),        color: COLOR_GREEN },
  ]

  if (implicitCount > 0) {
    rows.push({
      label: '  ↳ dos quais: adequados de forma implícita',
      value: String(implicitCount),
      color: COLOR_TEAL,
    })
  }

  rows.push(
    { label: 'Revisados pelo analista (discordância da IA)', value: String(stats.overridden || 0), color: COLOR_BLUE },
    { label: 'Score de aprovação', value: `${stats.score || 0}%`, color: COLOR_DARK },
  )

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W - 1400, 1400],
    rows: rows.map((row, i) => new TableRow({
      children: [
        new TableCell({
          shading: { fill: i % 2 === 0 ? COLOR_WHITE : COLOR_LGRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 80 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          children: [para([run(row.label, { size: 20 })], { after: 0 })],
        }),
        new TableCell({
          shading: { fill: i % 2 === 0 ? COLOR_WHITE : COLOR_LGRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 80, right: 120 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          verticalAlign: VerticalAlign.CENTER,
          children: [para([run(row.value, { size: 20, bold: true, color: row.color })], {
            after: 0, align: AlignmentType.CENTER,
          })],
        }),
      ],
    })),
  })
}

// ─── buildBlockSummaryTable ───────────────────────────────────────────────────

function buildBlockSummaryTable(elements) {
  const nonPositive = elements.filter(e => !POSITIVE_STATUSES.has(e.effectiveStatus))
  if (nonPositive.length === 0) return null

  const byBlock = nonPositive.reduce((acc, el) => {
    if (!acc[el.blockCode]) acc[el.blockCode] = []
    acc[el.blockCode].push(el)
    return acc
  }, {})

  const headerRow = new TableRow({
    children: ['Bloco', 'Elemento', 'Status', 'Observação da IA'].map((h, i) =>
      new TableCell({
        shading: { fill: COLOR_DARK, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 80 },
        borders: { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone },
        width: { size: [2200, 3800, 1200, CONTENT_W - 7200][i], type: WidthType.DXA },
        children: [para([run(h, { size: 18, bold: true, color: COLOR_WHITE })], { after: 0 })],
      })
    ),
  })

  const dataRows = []
  let alt = false
  for (const [blockCode, els] of Object.entries(byBlock)) {
    for (const el of els) {
      const s = el.effectiveStatus
      dataRows.push(new TableRow({
        children: [
          new TableCell({
            shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 80 },
            borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
            children: [para([run(BLOCK_LABELS[blockCode] || blockCode, { size: 17 })], { after: 0 })],
          }),
          new TableCell({
            shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 80 },
            borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
            children: [para([run(el.label, { size: 18, bold: true })], { after: 0 })],
          }),
          new TableCell({
            shading: { fill: STATUS_BG[s] || COLOR_WHITE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
            children: [para([run(STATUS_LABEL[s] || s, { size: 17, bold: true, color: STATUS_COLOR[s] || COLOR_GRAY })], {
              after: 0, align: AlignmentType.CENTER,
            })],
          }),
          new TableCell({
            shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 80 },
            borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
            children: [para([run(el.aiResult?.summary || '—', { size: 17, italic: true, color: COLOR_GRAY })], { after: 0 })],
          }),
        ],
      }))
      alt = !alt
    }
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2200, 3800, 1200, CONTENT_W - 7200],
    rows: [headerRow, ...dataRows],
  })
}

// ─── buildElementsTable ───────────────────────────────────────────────────────

function buildElementsTable(elements, statusFilter) {
  const filtered = elements.filter(e => statusFilter.includes(e.effectiveStatus))
  if (filtered.length === 0) return null

  const rows = filtered.map((el, i) => {
    const s   = el.effectiveStatus
    const alt = i % 2 !== 0

    // Nota extra para adequate_implicit
    const implicitNote = s === 'adequate_implicit'
      ? '\nNota: conteúdo presente de forma contextual/implícita — linguagem própria da escola.'
      : ''

    const summaryText = (el.aiResult?.summary || '—') + implicitNote
    const missing = el.aiResult?.missingItems || []
    const comment = el.humanReview?.comment || null

    const cellChildren = [
      para([run(el.label, { size: 18, bold: true, color: COLOR_DARK })], { after: 60 }),
      para([run(el.normRef || '', { size: 17, italic: true, color: COLOR_GRAY })], { after: 80 }),
      para([run(summaryText, {
        size: 18,
        color: s === 'adequate_implicit' ? COLOR_TEAL : (STATUS_COLOR[s] || COLOR_GRAY),
      })], { after: missing.length ? 60 : 0 }),
    ]

    if (missing.length > 0) {
      cellChildren.push(
        para([run('Itens ausentes:', { size: 17, bold: true, color: COLOR_AMBER })], { after: 40 }),
        ...missing.map(m => para([run(`• ${m}`, { size: 17, color: COLOR_AMBER })], { after: 20 }))
      )
    }

    if (comment) {
      cellChildren.push(
        para([run(`Analista: "${comment}"`, { size: 17, italic: true, color: COLOR_BLUE })], { after: 0 })
      )
    }

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 1400, type: WidthType.DXA },
          shading: { fill: STATUS_BG[s] || COLOR_WHITE, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 100, right: 80 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          verticalAlign: VerticalAlign.TOP,
          children: [
            para([run(STATUS_LABEL[s] || s, { size: 17, bold: true, color: STATUS_COLOR[s] || COLOR_GRAY })], {
              after: 40, align: AlignmentType.CENTER,
            }),
            ...(el.isCritical ? [para([run('Obrigatório', { size: 16, color: COLOR_RED })], {
              after: 0, align: AlignmentType.CENTER,
            })] : []),
          ],
        }),
        new TableCell({
          width: { size: CONTENT_W - 1400, type: WidthType.DXA },
          shading: { fill: alt ? COLOR_LGRAY : COLOR_WHITE, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 100 },
          borders: { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight },
          children: cellChildren,
        }),
      ],
    })
  })

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1400, CONTENT_W - 1400],
    rows,
  })
}

// ─── buildHeader / buildFooter ────────────────────────────────────────────────

function buildHeader(schoolName, year) {
  return new Header({
    children: [
      new Paragraph({
        children: [
          run('SECRETARIA DE ESTADO DE EDUCAÇÃO DO DISTRITO FEDERAL  |  ', { size: 16, color: COLOR_GRAY }),
          run(`Parecer Técnico-Pedagógico — PPP ${year}`, { size: 16, bold: true, color: COLOR_DARK }),
        ],
        spacing: { after: 40 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BLUE, space: 4 } },
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
          run('Portaria SEEDF nº 139/2024 · Portaria nº 174/2026  |  Página ', { size: 16, color: COLOR_GRAY }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: COLOR_GRAY }),
          run(' de ', { size: 16, color: COLOR_GRAY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: COLOR_GRAY }),
        ],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
        spacing: { before: 60, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      }),
    ],
  })
}

// ─── buildParecer (entrada principal) ────────────────────────────────────────

async function buildParecer({ analysis, elements, analystNotes, decision, analystName }) {
  const { schoolName, cre, year } = analysis
  const stats   = analysis.stats || {}
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const decisionLabel = decision === 'approved_with_remarks' ? 'APROVADO COM RESSALVAS' : 'REPROVADO'
  const decisionColor = decision === 'approved_with_remarks' ? COLOR_AMBER : COLOR_RED

  // Agrupamentos — adequate_implicit vai para a seção de adequados
  const criticalEls  = elements.filter(e => e.effectiveStatus === 'critical')
  const attentionEls = elements.filter(e => e.effectiveStatus === 'attention')
  const adequateEls  = elements.filter(e => POSITIVE_STATUSES.has(e.effectiveStatus))
  const implicitEls  = elements.filter(e => e.effectiveStatus === 'adequate_implicit')

  // ── Seção 1: Identificação ──────────────────────────────────────────────────
  const identChildren = [
    new Paragraph({
      children: [run('PARECER TÉCNICO-PEDAGÓGICO', { size: 36, bold: true, color: COLOR_DARK })],
      spacing: { before: 0, after: 80 }, alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [run('Projeto Político-Pedagógico — SEEDF', { size: 24, color: COLOR_BLUE })],
      spacing: { before: 0, after: 320 }, alignment: AlignmentType.CENTER,
    }),
    heading1('1. Identificação'),
    buildIdentTable(analysis, dateStr, analystName, decisionLabel, decisionColor),
    ...emptyLine(1),
  ]

  // ── Seção 2: Resumo executivo ───────────────────────────────────────────────
  const resumoChildren = [
    heading1('2. Resumo Executivo'),
    para([run('A tabela abaixo apresenta o consolidado da verificação dos elementos do PPP:', { size: 20 })], { after: 160 }),
    buildSummaryTable(stats),
    ...emptyLine(1),
  ]

  // Nota explicativa sobre adequate_implicit (se houver)
  if (implicitEls.length > 0) {
    resumoChildren.push(
      para([
        run('Nota sobre elementos "adequados de forma implícita": ', { size: 19, bold: true, color: COLOR_TEAL }),
        run(
          `${implicitEls.length} elemento(s) foram classificados como adequados de forma implícita, ` +
          'pois o conteúdo pedagógico está presente no documento com linguagem própria da comunidade ' +
          'escolar, sem uso da terminologia técnica das portarias. Esta classificação é igualmente ' +
          'válida para fins de aprovação.',
          { size: 19, color: COLOR_GRAY }
        ),
      ], { after: 200 })
    )
  }

  const blockTable = buildBlockSummaryTable(elements)
  if (blockTable) {
    resumoChildren.push(
      para([run('Elementos com pendências identificadas:', { bold: true, size: 20 })], { after: 120 }),
      blockTable,
      ...emptyLine(1),
    )
  }

  // ── Seção 3: Críticos ───────────────────────────────────────────────────────
  const critChildren = []
  if (criticalEls.length > 0) {
    critChildren.push(
      heading1('3. Elementos Críticos'),
      para([
        run('Os elementos a seguir estão ', { size: 20 }),
        run('ausentes ou inadequados', { bold: true, size: 20, color: COLOR_RED }),
        run(' e impedem a aprovação do PPP sem correção:', { size: 20 }),
      ], { after: 160 }),
      buildElementsTable(elements, ['critical']),
      ...emptyLine(1),
    )
  }

  // ── Seção 4: Atenção ────────────────────────────────────────────────────────
  const attChildren = []
  if (attentionEls.length > 0) {
    const secNum = criticalEls.length > 0 ? '4' : '3'
    attChildren.push(
      heading1(`${secNum}. Elementos com Necessidade de Ajuste`),
      para([
        run('Os elementos a seguir estão ', { size: 20 }),
        run('presentes mas necessitam de complementação', { bold: true, size: 20, color: COLOR_AMBER }),
        run(':', { size: 20 }),
      ], { after: 160 }),
      buildElementsTable(elements, ['attention']),
      ...emptyLine(1),
    )
  }

  // ── Seção 5: Adequados (inclui adequate_implicit) ───────────────────────────
  const baseN = 3 + (criticalEls.length > 0 ? 1 : 0) + (attentionEls.length > 0 ? 1 : 0)
  const adeChildren = []
  if (adequateEls.length > 0) {
    adeChildren.push(heading1(`${baseN}. Elementos Verificados e Adequados`))
    const table = buildElementsTable(elements, ['adequate', 'adequate_implicit', 'overridden'])
    if (table) adeChildren.push(table)
    adeChildren.push(...emptyLine(1))
  }

  // ── Seção final: Considerações e Decisão ────────────────────────────────────
  const finalN = baseN + (adequateEls.length > 0 ? 1 : 0)
  const finalChildren = [
    heading1(`${finalN}. Considerações Finais e Decisão`),
    ...(analystNotes ? [
      para([run('Observações do analista:', { bold: true, size: 20 })], { after: 80 }),
      para([run(analystNotes, { size: 20, italic: true })], { after: 240 }),
    ] : []),
    new Paragraph({
      children: [run(`DECISÃO: ${decisionLabel}`, { size: 28, bold: true, color: decisionColor })],
      spacing: { before: 240, after: 160 },
      alignment: AlignmentType.CENTER,
      shading: { fill: STATUS_BG[decision === 'rejected' ? 'critical' : 'attention'] || COLOR_LGRAY, type: ShadingType.CLEAR },
      border: {
        top: { style: BorderStyle.SINGLE, size: 8, color: decisionColor },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: decisionColor },
      },
    }),
    ...emptyLine(2),
    para([run('_'.repeat(50), { color: COLOR_GRAY })], { after: 40, align: AlignmentType.CENTER }),
    para([run(analystName || 'Analista Pedagógico', { bold: true, size: 20 })], { after: 20, align: AlignmentType.CENTER }),
    para([run('Analista — Unieb Recanto das Emas / SEEDF', { size: 18, color: COLOR_GRAY })], { after: 0, align: AlignmentType.CENTER }),
  ]

  // ── Monta o Document ────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: { default: buildHeader(schoolName, year) },
      footers: { default: buildFooter() },
      children: [
        ...identChildren,
        new Paragraph({ children: [new PageBreak()] }),
        ...resumoChildren,
        ...critChildren,
        ...attChildren,
        ...adeChildren,
        new Paragraph({ children: [new PageBreak()] }),
        ...finalChildren,
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

module.exports = { buildParecer }
