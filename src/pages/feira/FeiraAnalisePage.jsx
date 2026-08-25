import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feiraInscricoesService, feiraRascunhosService } from '../../services/feiraService'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/feira/StatusBadge'
import DocPreview from '../../components/feira/DocPreview'
import { useColResize } from '../../hooks/useColResize'
import ResizeBorder from '../../components/ResizeBorder'
import {
  ArrowLeft, ChevronRight, FileText, MessageSquare, CheckCircle2, AlertCircle,
  Eye, EyeOff, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../AnalysisReview.css'
import '../../components/DocumentViewer.css'
import { getLimites, normalizarOrientadores } from '../../constants/feiraConstants'

const COL_DEFAULTS = { drawer: 320, card: 400 }
const COL_MIN      = { drawer: 240, card: 320 }
const COL_MAX      = { drawer: 480, card: 560 }

const GRUPOS_AVALIACAO = [
  {
    key: 'obrigatorios',
    code: 'G1',
    label: 'Itens obrigatórios da inscrição',
    descricao: 'Verificação dos requisitos formais de inscrição.',
    itens: [
      { key: 'categoria_ok', label: 'Categoria coerente com a etapa e o nível de ensino.' },
      { key: 'qtd_estudantes_ok', label: 'Quantidade de estudantes dentro do permitido.' },
      { key: 'orientador_limite_ok', label: 'Professor(a)-orientador(a) dentro do limite de projetos.' },
      { key: 'projeto_enviado_ok', label: 'Projeto de Pesquisa foi enviado (obrigatório).' },
      { key: 'termo_enviado_ok', label: 'Termo de Autorização de Imagem e Voz foi enviado.' },
      { key: 'nome_social_ok', label: 'Nome social respeitado na identificação dos integrantes.' },
    ],
  },
  {
    key: 'formatacao',
    code: 'G2',
    label: 'Formatação do Projeto (Anexo I)',
    descricao: 'Confira as regras de formatação do arquivo submetido.',
    itens: [
      { key: 'fmt_pdf_10mb', label: 'Arquivo PDF, com até 10 MB.' },
      { key: 'fmt_a4_margens', label: 'Folha A4 com margens 2x2x2x2 cm.' },
      { key: 'fmt_arial_espacamento', label: 'Fonte Arial e espaçamento simples entre linhas.' },
      { key: 'fmt_paginas_5_10', label: 'Entre 5 e 10 páginas.' },
      { key: 'fmt_titulo', label: 'Título em CAIXA ALTA, negrito, Arial 14, centralizado (nomes científicos em itálico).' },
      { key: 'fmt_autores', label: 'Autores identificados com sobrescritos para estudantes (¹) e orientadores (²), com instituição e CRE.' },
      { key: 'fmt_legendas_titulos', label: 'Figuras/gráficos com legenda abaixo; tabelas com título acima; citadas no texto antes de aparecerem.' },
      { key: 'fmt_referencias_abnt', label: 'Referências bibliográficas seguindo o padrão indicado (ABNT).' },
    ],
  },
  {
    key: 'topicos',
    code: 'G3',
    label: 'Tópicos do Projeto (Tabela 3)',
    descricao: 'Todos os tópicos obrigatórios estão presentes e cumprem os limites de caracteres.',
    itens: [
      { key: 'top_resumo', label: 'Resumo (até 1.000 caracteres) descrevendo etapas e objetivos.' },
      { key: 'top_palavras_chave', label: 'Três palavras-chave separadas por ponto e vírgula (não repetem o título).' },
      { key: 'top_introducao', label: 'Introdução com pergunta de pesquisa, hipóteses e objetivos.' },
      { key: 'top_metodologia', label: 'Metodologia detalhando estratégias, procedimentos, materiais e locais (sem resultados).' },
      { key: 'top_resultados', label: 'Resultados e Discussão apresentados e analisados conforme literatura.' },
      { key: 'top_conclusoes', label: 'Conclusões com os principais achados do projeto.' },
      { key: 'top_referencias', label: 'Referências Bibliográficas listadas e todas citadas no texto.' },
    ],
  },
  {
    key: 'regulamento',
    code: 'G4',
    label: 'Conteúdo e Regulamento (item 5.2)',
    descricao: 'Avaliação de conteúdo obrigatória — reprovação em qualquer item pode gerar desclassificação.',
    itens: [
      { key: 'reg_participacao_estudantes', label: 'Evidencia a participação efetiva dos estudantes na construção do projeto.' },
      { key: 'reg_apresenta_resultados', label: 'Apresenta resultados (não é apenas relato de experiência/descrição de eventos).' },
      { key: 'reg_inovacao', label: 'Não é fruto de trabalho já publicado sem inovação ou dados novos.' },
      { key: 'reg_sem_plagio_ia', label: 'Sem plágio; não elaborado exclusiva ou majoritariamente por IA (usos citados quando houver).' },
      { key: 'reg_impacto_social', label: 'Explicita o impacto social da investigação.' },
      { key: 'reg_etica', label: 'Respeita normas éticas de pesquisa com seres humanos e biodiversidade.' },
    ],
  },
]

const ALL_ITEMS = GRUPOS_AVALIACAO.flatMap(g => g.itens)

const PDF_MAX_BYTES = 10 * 1024 * 1024

function computeAutoChecks(inscricao, edicao) {
  if (!inscricao) return {}
  const proj  = inscricao.documentos?.projeto_pesquisa
  const termoLegado = inscricao.documentos?.termo_autorizacao
  const termosArr = inscricao.documentos?.termos_autorizacao || []
  const estudantes = inscricao.estudantes || []
  const out = {}
  const lim = getLimites(edicao)

  out.projeto_enviado_ok = !!proj?.url
  const termosPorEstudante = estudantes.every((_, i) => !!termosArr[i]?.url)
  out.termo_enviado_ok = termosPorEstudante || !!termoLegado?.url
  out.qtd_estudantes_ok = estudantes.length >= lim.estudantes_min && estudantes.length <= lim.estudantes_max

  const orientadores = normalizarOrientadores(inscricao).length
  out.orientador_limite_ok = orientadores >= lim.orientadores_min && orientadores <= lim.orientadores_max

  if (proj) {
    const isPdf = (proj.tipo === 'application/pdf') || /\.pdf$/i.test(proj.nome || '')
    const dentroTamanho = typeof proj.tamanho === 'number' ? proj.tamanho <= PDF_MAX_BYTES : true
    out.fmt_pdf_10mb = isPdf && dentroTamanho
  }
  return out
}

const AUTO_KEYS = new Set([
  'projeto_enviado_ok', 'termo_enviado_ok', 'qtd_estudantes_ok',
  'orientador_limite_ok', 'fmt_pdf_10mb',
])

export default function FeiraAnalisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [inscricao, setInscricao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [checklist, setChecklist] = useState({})
  const [checklistObs, setChecklistObs] = useState({})
  const [docAnalise, setDocAnalise] = useState({ projeto: '', termo: '', termos: [] })
  const [observacoes, setObservacoes] = useState('')
  const [msgDevolucao, setMsgDevolucao] = useState('')

  const [activeGroup, setActiveGroup] = useState('obrigatorios')
  const [activeItem, setActiveItem] = useState('categoria_ok')
  const [activeDoc, setActiveDoc]   = useState('projeto')
  const [docCollapsed, setDocCollapsed] = useState(false)

  const [drawerW, onDrawerDrag, drawerDragging] = useColResize('drawer', COL_DEFAULTS.drawer, COL_MIN.drawer, COL_MAX.drawer)
  const [cardW,   onCardDrag,   cardDragging]   = useColResize('card',   COL_DEFAULTS.card,   COL_MIN.card,   COL_MAX.card)

  useEffect(() => {
    feiraInscricoesService.getById(id)
      .then(i => {
        if (i) {
          setInscricao(i)
          const auto = computeAutoChecks(i)
          const saved = i.analise_checklist || {}
          setChecklist({ ...auto, ...saved })
          if (i.analise_checklist_obs) setChecklistObs(i.analise_checklist_obs)
          if (i.analise_documentos) setDocAnalise({ projeto: '', termo: '', termos: [], ...i.analise_documentos })
          if (i.analise_observacoes) setObservacoes(i.analise_observacoes)
        }
      })
      .catch(e => { console.error(e); toast.error('Erro ao carregar inscrição') })
      .finally(() => setLoading(false))
  }, [id])

  const docs = useMemo(() => {
    if (!inscricao) return []
    const list = []
    if (inscricao.documentos?.projeto_pesquisa?.url) {
      list.push({ key: 'projeto', label: 'Projeto de Pesquisa', doc: inscricao.documentos.projeto_pesquisa })
    }
    if (inscricao.documentos?.termo_autorizacao?.url) {
      list.push({ key: 'termo', label: 'Termo de Autorização (legado)', doc: inscricao.documentos.termo_autorizacao })
    }
    ;(inscricao.documentos?.termos_autorizacao || []).forEach((t, i) => {
      if (t?.url) {
        const nomeEst = inscricao.estudantes?.[i]?.nome || t.estudante_nome || `Estudante ${i + 1}`
        list.push({ key: `termo_${i}`, label: `Termo — ${nomeEst}`, doc: t, idx: i })
      }
    })
    return list
  }, [inscricao])

  useEffect(() => {
    if (docs.length && !docs.find(d => d.key === activeDoc)) setActiveDoc(docs[0].key)
  }, [docs, activeDoc])

  const activeItemDef = ALL_ITEMS.find(it => it.key === activeItem)
  const activeGroupDef = GRUPOS_AVALIACAO.find(g => g.key === activeGroup)
  const autoResults = useMemo(() => computeAutoChecks(inscricao), [inscricao])

  const toggleItem = useCallback((key, checked) => {
    setChecklist(c => ({ ...c, [key]: checked }))
  }, [])

  const selectItem = useCallback((grupoKey, itemKey) => {
    setActiveGroup(grupoKey)
    setActiveItem(itemKey)
  }, [])

  async function salvarAnalise(novoStatus) {
    setSalvando(true)
    try {
      const dados = {
        status: novoStatus,
        analise_checklist: checklist,
        analise_checklist_obs: checklistObs,
        analise_documentos: docAnalise,
        analise_observacoes: observacoes,
      }
      if (novoStatus === 'devolvida') {
        dados.devolucoes_num = (inscricao.devolucoes_num || 0) + 1
        dados.devolucoes_hist = [...(inscricao.devolucoes_hist || []), {
          em: new Date().toISOString(),
          mensagem: msgDevolucao,
          por_uid: user.uid,
          por_nome: profile?.name,
        }]
      }
      if (novoStatus === 'aprovada' || novoStatus === 'indeferida') {
        dados.decidido_em = new Date().toISOString()
        dados.decidido_por = { uid: user.uid, nome: profile?.name }
      }
      await feiraInscricoesService.atualizar(id, dados)
      if (inscricao.rascunho_id) {
        try {
          await feiraRascunhosService.salvar(inscricao.rascunho_id, {
            status: novoStatus,
            trancado: novoStatus === 'aprovada' || novoStatus === 'indeferida',
          })
        } catch (e) { console.error('Falha ao sincronizar rascunho:', e) }
      }
      toast.success(`Inscrição ${novoStatus === 'aprovada' ? 'aprovada' : novoStatus === 'indeferida' ? 'indeferida' : 'devolvida'}`)
      navigate('/feira')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="review-loading"><div className="spinner" /></div>
  if (!inscricao) return <div style={{ padding: 32 }}>Inscrição não encontrada.</div>

  const currentDoc = docs.find(d => d.key === activeDoc)

  return (
    <div className="review-page">
      {/* Header */}
      <div className="review-header">
        <button
          onClick={() => navigate(`/feira/inscricao/${id}`)}
          className="back-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft size={15} /> Inscrição
        </button>
        <div className="review-title-group">
          <h1 className="review-title">{inscricao.titulo}</h1>
          <span className="review-meta">
            {inscricao.escola_nome || '—'} · {inscricao.categoria || '—'}
          </span>
        </div>
        <div className="review-header-actions">
          <StatusBadge status={inscricao.status} />
        </div>
      </div>

      {/* Body */}
      <div className="review-body">

        {/* Col 0: Drawer com grupos + checkboxes */}
        <div
          className={`drawer-col${drawerDragging ? ' col--dragging' : ''}`}
          style={{ width: drawerW, minWidth: drawerW, maxWidth: drawerW }}
        >
          <ChecklistDrawer
            grupos={GRUPOS_AVALIACAO}
            checklist={checklist}
            checklistObs={checklistObs}
            autoResults={autoResults}
            activeGroup={activeGroup}
            activeItem={activeItem}
            onToggle={toggleItem}
            onSelectItem={selectItem}
          />
          <ResizeBorder onMouseDown={onDrawerDrag} isDragging={drawerDragging} side="right" />
        </div>

        {/* Col 1: Documento */}
        <div className="review-viewer-col">
          {docCollapsed ? (
            <button className="dv-collapsed-btn" onClick={() => setDocCollapsed(false)} style={{ margin: 12 }}>
              <Eye size={16} /><span>Ver documento</span>
            </button>
          ) : (
            <DocumentoViewer
              docs={docs}
              activeDoc={activeDoc}
              onChangeDoc={setActiveDoc}
              currentDoc={currentDoc}
              onCollapse={() => setDocCollapsed(true)}
            />
          )}
        </div>

        {/* Col 2: Card do item selecionado + ações globais */}
        <div
          className={`element-card-col${cardDragging ? ' col--dragging' : ''}`}
          style={{ width: cardW, minWidth: cardW, maxWidth: cardW }}
        >
          <ResizeBorder onMouseDown={onCardDrag} isDragging={cardDragging} side="left" />
          <div className="element-card animate-fade-in">
            {/* Item selecionado */}
            {activeItemDef && (
              <>
                <div className="ec-top">
                  <div className="ec-badges">
                    <span className={`status-pill status-${checklist[activeItem] ? 'adequate' : 'gray'}`}>
                      {checklist[activeItem]
                        ? <><CheckCircle2 size={13} /> Conforme</>
                        : <><AlertCircle size={13} /> Não avaliado</>}
                    </span>
                    <span className="new-badge">{activeGroupDef?.label}</span>
                  </div>
                </div>
                <h2 className="ec-title">{activeItemDef.label}</h2>
                {activeGroupDef?.descricao && (
                  <p className="ec-normref">{activeGroupDef.descricao}</p>
                )}

                {AUTO_KEYS.has(activeItem) && autoResults[activeItem] !== undefined && (
                  <AutoCheckBanner
                    ok={autoResults[activeItem]}
                    detail={autoCheckDetail(activeItem, inscricao)}
                  />
                )}

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                  fontSize: 13, cursor: 'pointer', background: checklist[activeItem] ? 'var(--color-adequate-bg)' : 'var(--white)',
                }}>
                  <input
                    type="checkbox"
                    checked={!!checklist[activeItem]}
                    onChange={e => toggleItem(activeItem, e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Marcar este item como conforme</span>
                </label>

                <div className="comment-box">
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>
                    <MessageSquare size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Observação do item
                  </label>
                  <textarea
                    value={checklistObs[activeItem] || ''}
                    onChange={e => setChecklistObs(o => ({ ...o, [activeItem]: e.target.value }))}
                    placeholder="Anote justificativas, pendências ou trechos que motivam a decisão…"
                  />
                </div>
              </>
            )}

            {/* Documentos: validade */}
            <div className="ec-excerpts-block">
              <p className="ec-excerpts-label">Validade dos documentos</p>
              {docs.length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Nenhum documento anexado.</span>}
              {docs.map(d => (
                <DocValidityRow
                  key={d.key}
                  label={d.label}
                  doc={d.doc}
                  value={d.legado ? (docAnalise.termos?.[d.idx] || '') : (docAnalise[d.key] || '')}
                  active={activeDoc === d.key}
                  onFocus={() => setActiveDoc(d.key)}
                  onChange={v => {
                    if (d.legado) {
                      setDocAnalise(da => {
                        const termos = [...(da.termos || [])]
                        termos[d.idx] = v
                        return { ...da, termos }
                      })
                    } else {
                      setDocAnalise(da => ({ ...da, [d.key]: v }))
                    }
                  }}
                />
              ))}
            </div>

            {/* Observações gerais */}
            <div className="comment-box">
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>
                Observações gerais
              </label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Considerações gerais sobre a análise…"
              />
            </div>

            {/* Mensagem de devolução */}
            <div className="comment-box">
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber-700)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>
                Mensagem de devolução (se aplicável)
              </label>
              <textarea
                value={msgDevolucao}
                onChange={e => setMsgDevolucao(e.target.value)}
                placeholder="Descreva as pendências que a escola deve corrigir…"
              />
            </div>

            {/* Ações */}
            <div className="ec-actions">
              <button
                className="btn-agree"
                onClick={() => salvarAnalise('aprovada')}
                disabled={salvando}
              >
                <CheckCircle2 size={14} /> Aprovar inscrição
              </button>
              <div className="ec-secondary-actions">
                <button
                  className="btn-disagree"
                  onClick={() => salvarAnalise('devolvida')}
                  disabled={salvando || !msgDevolucao}
                  style={{ flex: 1 }}
                >
                  Devolver
                </button>
                <button
                  className="btn-disagree"
                  onClick={() => salvarAnalise('indeferida')}
                  disabled={salvando}
                  style={{ flex: 1, color: 'var(--red-600)', borderColor: 'var(--red-200)' }}
                >
                  Indeferir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── ChecklistDrawer ───────────────────────────────────────────────────── */

function ChecklistDrawer({ grupos, checklist, checklistObs, autoResults, activeGroup, activeItem, onToggle, onSelectItem }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(grupos.map(g => g.key)))

  const toggleGroup = (key) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="drawer-nav">
      {grupos.map((g, idx) => {
        const total = g.itens.length
        const marcados = g.itens.filter(it => checklist[it.key]).length
        const pendentes = total - marcados
        const isOpen = openGroups.has(g.key)
        const isActive = g.key === activeGroup

        return (
          <div
            key={g.key}
            className={`drawer-block${isOpen ? ' drawer-block--open' : ''}${isActive ? ' drawer-block--active' : ''}`}
            style={{ '--block-depth': idx }}
          >
            <button className="drawer-block-header" onClick={() => toggleGroup(g.key)}>
              <span className={`drawer-chevron${isOpen ? ' drawer-chevron--open' : ''}`}>
                <ChevronRight size={13} />
              </span>
              <span className="drawer-block-code">{g.code}</span>
              <span className="drawer-block-label">{g.label}</span>
              <div className="drawer-block-pills">
                {marcados > 0 && <span className="drawer-pill" style={{ background: 'var(--color-adequate-bg)', color: 'var(--green-700)' }}>{marcados}</span>}
                {pendentes > 0 && <span className="drawer-pill drawer-pill--pending">{pendentes}</span>}
              </div>
            </button>

            <div className="drawer-progress-bar">
              <div className="drawer-progress-ok" style={{ width: `${(marcados / total) * 100}%` }} />
            </div>

            {isOpen && (
              <div className="drawer-elements">
                {g.itens.map(it => {
                  const checked = !!checklist[it.key]
                  const isCurrent = it.key === activeItem
                  const hasObs = !!(checklistObs?.[it.key] || '').trim()
                  const isAuto = AUTO_KEYS.has(it.key) && autoResults?.[it.key] !== undefined
                  const autoOk = autoResults?.[it.key]
                  return (
                    <div
                      key={it.key}
                      className={`drawer-element${isCurrent ? ' drawer-element--active' : ''}`}
                      style={{ paddingLeft: 4 }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => onToggle(it.key, e.target.checked)}
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: 4, flexShrink: 0, cursor: 'pointer' }}
                      />
                      <button
                        onClick={() => onSelectItem(g.key, it.key)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          textAlign: 'left', flex: 1, minWidth: 0,
                        }}
                      >
                        <span className="drawer-element-label" style={{
                          color: isCurrent ? 'var(--blue-800)' : (checked ? 'var(--gray-500)' : 'var(--gray-700)'),
                          fontWeight: isCurrent ? 500 : 400,
                          textDecoration: checked ? 'line-through' : 'none',
                        }}>
                          {it.label}
                        </span>
                      </button>
                      {isAuto && (
                        <span
                          title={autoOk ? 'Verificação automática: conforme' : 'Verificação automática: pendência'}
                          style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: .3,
                            padding: '1px 5px', borderRadius: 8, marginTop: 4, flexShrink: 0,
                            background: autoOk ? 'var(--color-adequate-bg)' : 'var(--red-50)',
                            color: autoOk ? 'var(--green-700)' : 'var(--red-600)',
                          }}
                        >AUTO</span>
                      )}
                      {hasObs && (
                        <MessageSquare size={11} style={{ color: 'var(--blue-500)', marginTop: 5, flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── DocumentoViewer ───────────────────────────────────────────────────── */

function DocumentoViewer({ docs, activeDoc, onChangeDoc, currentDoc, onCollapse }) {
  if (docs.length === 0) {
    return (
      <div className="document-viewer">
        <div className="dv-header">
          <span className="dv-title"><FileText size={14} /> Documento</span>
        </div>
        <div className="dv-hint" style={{ padding: 24 }}>Nenhum documento anexado a esta inscrição.</div>
      </div>
    )
  }

  return (
    <div className="document-viewer">
      <div className="dv-header" style={{ gap: 10, flexWrap: 'wrap' }}>
        <span className="dv-title"><FileText size={14} /> Documento</span>
        <select
          value={activeDoc}
          onChange={e => onChangeDoc(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gray-300)', flex: 1, minWidth: 140 }}
        >
          {docs.map(d => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
        {currentDoc?.doc?.url && (
          <a
            href={currentDoc.doc.url}
            target="_blank"
            rel="noreferrer"
            title="Abrir em nova aba"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--blue-600)', textDecoration: 'none' }}
          >
            <ExternalLink size={13} />
          </a>
        )}
        <button className="dv-collapse-btn" onClick={onCollapse} title="Ocultar painel">
          <EyeOff size={14} />
        </button>
      </div>
      {currentDoc?.doc?.url ? (
        <div className="dv-iframe-wrapper" style={{ flex: 1, minHeight: 0 }}>
          <iframe
            key={currentDoc.doc.url}
            src={currentDoc.doc.url}
            className="dv-iframe"
            title={currentDoc.label}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      ) : (
        <div className="dv-hint" style={{ padding: 24 }}>Selecione um documento para visualizar.</div>
      )}
    </div>
  )
}

/* ─── AutoCheckBanner ───────────────────────────────────────────────────── */

function AutoCheckBanner({ ok, detail }) {
  return (
    <div className={`ec-ai-block ai-${ok ? 'adequate' : 'critical'}`}>
      <div className="ec-ai-header">
        {ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
        Verificação automática
      </div>
      <p className="ec-ai-summary">{detail}</p>
    </div>
  )
}

function autoCheckDetail(key, i) {
  const proj = i?.documentos?.projeto_pesquisa
  const termoLegado = i?.documentos?.termo_autorizacao
  const termosArr = i?.documentos?.termos_autorizacao || []
  const estudantes = i?.estudantes || []
  const orientadores = normalizarOrientadores(i).length
  const lim = getLimites(null)

  switch (key) {
    case 'projeto_enviado_ok':
      return proj?.url ? `Projeto enviado: ${proj.nome || 'arquivo anexado'}.` : 'Nenhum arquivo de Projeto de Pesquisa foi anexado.'
    case 'termo_enviado_ok': {
      const n = termosArr.filter(t => t?.url).length
      if (n >= estudantes.length && estudantes.length > 0) return `${n} termo(s) — um por estudante.`
      if (termoLegado?.url) return `Termo único (formato legado) enviado: ${termoLegado.nome || 'arquivo anexado'}.`
      return n > 0 ? `Apenas ${n}/${estudantes.length} termos enviados.` : 'Nenhum termo de autorização foi anexado.'
    }
    case 'qtd_estudantes_ok':
      return `Quantidade informada: ${estudantes.length} (permitido: ${lim.estudantes_min}–${lim.estudantes_max}).`
    case 'orientador_limite_ok':
      return `Orientadores cadastrados: ${orientadores} (permitido: ${lim.orientadores_min}–${lim.orientadores_max}).`
    case 'fmt_pdf_10mb': {
      if (!proj) return 'Projeto não enviado.'
      const mb = typeof proj.tamanho === 'number' ? (proj.tamanho / 1024 / 1024).toFixed(2) + ' MB' : 'tamanho desconhecido'
      const tipo = proj.tipo || '—'
      return `Arquivo: ${tipo}, ${mb}. Requisito: PDF até 10 MB.`
    }
    default:
      return ''
  }
}

/* ─── DocValidityRow ────────────────────────────────────────────────────── */

function DocValidityRow({ label, doc, value, active, onFocus, onChange }) {
  return (
    <div
      onClick={onFocus}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8,
        border: `1px solid ${active ? 'var(--blue-400)' : 'var(--gray-200)'}`,
        background: active ? 'var(--blue-50)' : 'var(--white)',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
        {doc.nome && (
          <div style={{ fontSize: 10.5, color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.nome}
          </div>
        )}
      </div>
      <DocPreview url={doc.url} nome={doc.nome} label="Ver" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
        style={{ fontSize: 11.5, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--gray-300)' }}
      >
        <option value="">—</option>
        <option value="valido">Válido</option>
        <option value="invalido">Inválido</option>
        <option value="ilegivel">Ilegível</option>
      </select>
    </div>
  )
}
