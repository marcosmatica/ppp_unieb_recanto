# Proposta: Modulo Feira de Ciencias - Etapa Regional do 15o CCEP-DF

## 1. Contexto e Escopo

O **15o Circuito de Ciencias das Escolas Publicas do DF (CCEP-DF)** tem tres etapas: Local, Regional e Distrital. Nosso sistema sera responsavel pela **Etapa Regional**, cobrindo:

- **Inscricao** — formulario publico por escola com upload de anexos
- **Analise de inscricoes** — validacao de documentos, verificacao de categoria, devolucao para correcoes
- **Avaliacao dos projetos** — 3 avaliadores por trabalho, 10 criterios, nota maxima 100 pontos
- **Resultados** — resultado preliminar, periodo recursal, resultado final
- **Certificacao** — geracao de certificados para participantes

### Referencia de design

O modulo segue o padrao ja consolidado no `sistema-ifb-recanto` (estudo socioeconomico): formulario publico com link unico → upload de anexos → envio → analise com ciclo de devolucao/correcao → decisao final. Adaptado para o contexto de feira de ciencias com a camada adicional de avaliacao por banca.

---

## 2. Modelo de Link por Unidade Escolar

**Cada escola cadastrada no sistema recebe um link unico** que funciona como portal de inscricao da feira. Pelo mesmo link, o professor-orientador da escola pode inscrever e gerenciar **todos os projetos** daquela unidade escolar.

### Como funciona

1. O admin cria uma **edicao da feira** no sistema (ano, tema, datas)
2. O sistema gera automaticamente um **token unico por escola** (vinculado a `feira_edicoes` + `schools`)
3. O link publico fica no formato: `/feira/{tokenEscola}`
4. Ao acessar o link, o professor ve:
   - Dados da escola (pre-preenchidos, somente leitura)
   - Lista de projetos ja inscritos por aquela escola (com status de cada)
   - Botao "Inscrever novo projeto"
5. Cada projeto e um formulario independente com seu proprio ciclo de vida (rascunho → enviado → analisado)

### Vantagens deste modelo

- **Gestao centralizada**: a escola ve todos os seus projetos num unico lugar
- **Controle de limite**: o sistema pode limitar a quantidade de projetos por escola/categoria (regra 3.2.7 do regulamento)
- **Sem duplicidade**: nao ha risco de mesma escola com multiplos links
- **Reuso de dados**: dados da escola preenchidos uma vez, reaproveitados em todos os projetos
- **Comissao pode limitar por escola**: regra de percentual maximo de projetos da mesma escola na mesma categoria (regra 3.2.7)

### Geracao dos links

Os tokens de escola podem ser gerados de duas formas:
- **Automatica**: ao criar a edicao, o sistema gera tokens para todas as escolas cadastradas na colecao `schools` que pertencem a CRE
- **Manual**: admin gera token para escola especifica (para escolas novas)

O token e um hash de 24 bytes URL-safe (mesmo padrao do `sistema-ifb-recanto`), armazenado em `feira_links_escolas/{token}`.

---

## 3. Fluxo Geral do Modulo

### Lado publico (professor-orientador)

1. Professor acessa o link da escola: `/feira/{tokenEscola}`
2. Ve painel com dados da escola e lista de projetos
3. Clica em "Inscrever novo projeto"
4. Preenche wizard de 3 etapas (orientador/equipe, projeto, documentos)
5. Revisa e envia
6. Acompanha status de cada projeto pelo mesmo link
7. Se devolvido, corrige e reenvia

### Lado administrativo (comissao regional)

1. Comissao visualiza todas as inscricoes recebidas (por escola, por categoria, por status)
2. Analisa documentos e dados de cada inscricao
3. Aprova, reprova ou devolve para correcoes
4. Designa avaliadores para trabalhos aprovados
5. Avaliadores preenchem formulario de avaliacao
6. Sistema calcula medias e gera ranking por categoria
7. Publica resultado preliminar → recurso → resultado final

---

## 4. Formulario Publico de Inscricao

### Pagina da escola: `/feira/{tokenEscola}`

Ao acessar, exibe:

- **Cabecalho**: nome da escola, CRE, edicao da feira, tema
- **Status da edicao**: inscricoes abertas/fechadas, datas
- **Lista de projetos**: tabela com titulo, categoria, orientador, status, data de envio
- **Botao "Inscrever novo projeto"**: abre o wizard de inscricao

### Wizard de inscricao (3 etapas + revisao)

| Etapa | Campos | Validacoes |
|-------|--------|------------|
| **1. Orientador e Equipe** | Nome do orientador, email, telefone; 2o orientador (opcional); nomes dos estudantes (2-5), serie/turma de cada | Max 2 orientadores; cada orientador max 2 trabalhos na edicao; min 2 e max 5 estudantes |
| **2. Projeto** | Titulo do trabalho; categoria (A-J, auto-sugerida pela etapa da escola); resumo curto (opcional); etapa local realizada (sim/nao) | Categoria coerente com etapa de ensino da escola |
| **3. Documentos** | Upload do Projeto de Pesquisa (PDF); Termo de Autorizacao de Imagem e Voz (1 PDF por estudante) | Projeto obrigatorio; 1 termo por estudante; somente PDF; max 15 MB por arquivo |
| **Revisao** | Resumo de todos os dados preenchidos; checkbox de concordancia com regulamento | Todos os campos obrigatorios preenchidos; todos os documentos anexados |

> **Nota**: dados da escola (nome, INEP, CRE) vem pre-preenchidos do cadastro e nao aparecem no wizard — sao somente leitura no cabecalho.

### Autosave

Cada alteracao e salva automaticamente no rascunho (debounce 800ms em `feira_rascunhos/{id}`), permitindo ao professor retomar o preenchimento a qualquer momento pelo mesmo link da escola. O campo `ultima_secao_editada` registra onde parou.

### Upload de anexos

Seguindo o padrao do `ChecklistDocumentos` do sistema de referencia:

- Componente `react-dropzone` com validacao de tipo (PDF) e tamanho (15 MB)
- Upload para Firebase Storage em `feira/{edicaoId}/{escolaInep}/{projetoId}/{timestamp}_{filename}`
- Checklist visual: cada documento obrigatorio aparece com status (pendente / enviado / erro)
- Preview de PDF inline antes do envio

---

## 5. Fluxo de Status das Inscricoes

### Fluxo principal

```
rascunho → enviada → em_analise → aprovada → avaliada
```

### Fluxo de correcao

```
em_analise → devolvida → reenviada → em_reanalise → aprovada
```

### Fluxo de rejeicao

```
em_analise → indeferida
devolvida → (prazo vencido) → indeferida
```

### Fluxo pos-avaliacao

```
avaliada → resultado_preliminar → resultado_final → classificada_distrital | nao_classificada
```

### Detalhamento dos status

| Status | Quem atua | O que acontece |
|--------|-----------|----------------|
| `rascunho` | Professor | Formulario em preenchimento, autosave ativo |
| `enviada` | Professor | Inscricao submetida pela primeira vez |
| `em_analise` | Comissao | Analista travou a edicao e esta conferindo |
| `devolvida` | Comissao → Professor | Pendencias identificadas; professor notificado com prazo e mensagem |
| `reenviada` | Professor | Correcoes realizadas e reenviadas |
| `em_reanalise` | Comissao | Reanalisando apos reenvio |
| `aprovada` | Comissao | Inscricao valida, pronta para avaliacao por banca |
| `indeferida` | Comissao | Inscricao reprovada definitivamente |
| `avaliada` | Sistema | Todos os 3 avaliadores concluiram; nota final calculada |
| `resultado_preliminar` | Sistema | Resultado publicado, em periodo recursal |
| `resultado_final` | Sistema | Resultado apos analise de recursos |
| `classificada_distrital` | Comissao | Classificada para a Etapa Distrital |
| `nao_classificada` | Comissao | Nao classificada para a Etapa Distrital |

---

## 6. Analise e Correcao de Inscricoes

### Painel de analise (lado Comissao)

- **Dados da inscricao**: resumo da escola, equipe, categoria, orientadores
- **Documentos**: cada anexo pode ser marcado como *valido*, *ilegivel* ou *invalido* com observacoes
- **Checklist de conformidade**: categoria coerente com etapa? Quantidade de estudantes correta? Orientador dentro do limite? Projeto no formato correto?
- **Historico de ciclos**: lista de envios e devolucoes com datas e mensagens

### Devolucao para correcao

- Analista escreve mensagem descrevendo as pendencias
- Define prazo para correcao (padrao: 5 dias uteis)
- Professor ve o aviso no portal da escola ao acessar o link
- Formulario reabre com restricoes: controlado por um array `campos_liberados` que define quais secoes/campos o professor pode editar
- Se prazo vencer sem reenvio: status automatico `indeferida`

> **Diferenca do modelo socioeconomico**: no estudo socioeconomico, a devolucao bloqueia o formulario e libera apenas documentos. Na feira de ciencias, a devolucao pode exigir correcao de dados (nome de estudante, categoria) alem de documentos, entao o bloqueio e mais granular.

---

## 7. Avaliacao dos Trabalhos Cientificos

Somente inscricoes com status `aprovada` entram na fase de avaliacao. Cada trabalho e avaliado por **3 avaliadores** designados pela Comissao Regional.

### Perfil do avaliador

- Novo papel no sistema: `avaliador_feira` (flag no documento do usuario)
- Avaliador so ve os trabalhos atribuidos a si
- Nao pode ser da mesma escola ou CRE do trabalho avaliado (regra 7.3.3 do regulamento)
- Avalia materiais na plataforma com 5 dias de antecedencia + avaliacao presencial

### Formulario de avaliacao (conforme Anexo VI do regulamento)

Nota maxima: **100 pontos**, divididos em 3 itens:

| Item | Criterios | Pontuacao |
|------|-----------|-----------|
| **I — Projeto de Pesquisa** | 1. Estrutura conforme Anexo I e metodologia; 2. Potencial para solucionar problemas locais; 3. Alinhamento com tema do Circuito | 30 pts (10 cada) |
| **II — Diario de Bordo e Banner** | 1. Diario registra o processo de pesquisa; 2. Banner sintetiza ideias centrais | 20 pts (10 cada) |
| **III — Apresentacao Oral** | 1. Complexidade e dominio do conteudo; 2. Respostas ao avaliador; 3. Organizacao e engajamento do grupo; 4. Competencias empreendedoras; 5. Recursos audiovisuais/experimentos | 50 pts (10 cada) |

### Escala de mencoes (por criterio)

| Pontuacao | Mencao |
|-----------|--------|
| 0,0 | Ausente |
| 5,0 ou 5,5 | Regular |
| 6,0 ou 6,5 | Bom |
| 7,0 ou 7,5 | Muito bom |
| 8,0 ou 8,5 | Otimo |
| 9,0 ou 9,5 | Excelente |
| 10,0 | Supera as expectativas |

### Calculo da nota final

- **Nota do avaliador** = soma dos 10 criterios (max 100)
- **Nota final do trabalho** = media aritmetica das notas dos 3 avaliadores
- **Bonus**: +1,0 ponto se comprovar realizacao da Etapa Local (registro fotografico) — nao ultrapassa 100
- **Desempate**: (1) comprovacao de Etapa Local; (2) maior media em Apresentacao Oral; (3) maior media em Projeto de Pesquisa; (4) criterios de Apresentacao Oral em ordem; (5) criterios de Projeto de Pesquisa em ordem; (6) sorteio

---

## 8. Resultados, Recursos e Certificacao

### Resultado preliminar

- Publicado na plataforma apos conclusao de todas as avaliacoes
- Ranking por categoria mostrando: posicao, escola, titulo, nota final
- Visivel para professores-orientadores via link da escola

### Periodo recursal (10 dias corridos)

- Formulario de interposicao de recurso (Anexo VII do regulamento)
- Campos: identificacao do avaliador, itens contestados, criterios a serem reanalisados, justificativas (max 100 palavras por criterio)
- Recurso analisado pela Comissao Regional
- Status do recurso: `pendente` → `deferido` / `indeferido`
- Se deferido: nota recalculada e ranking atualizado

### Resultado final

- Publicado apos encerramento do periodo recursal
- Classificados para Etapa Distrital conforme Tabela 1 do regulamento (1-2 por categoria por CRE)
- Status do trabalho atualizado para `classificada_distrital` ou `nao_classificada`

### Certificacao

- Certificado de participacao para todos os estudantes e professores da Etapa Regional
- Geracao em lote com template HTML → PDF (reusando `puppeteer-core` ja existente no projeto)
- Dados no certificado: nome, escola, titulo do trabalho, categoria, edicao

---

## 9. Modelo de Dados (Firestore)

### Colecoes novas

| Colecao | Descricao |
|---------|-----------|
| `feira_edicoes/{id}` | Configuracao de cada edicao da feira |
| `feira_links_escolas/{token}` | Links publicos por escola (1 token por escola por edicao) |
| `feira_rascunhos/{id}` | Rascunhos dos projetos (preenchimento em andamento) |
| `feira_inscricoes/{id}` | Inscricoes oficiais (criadas pela Cloud Function no envio) |
| `feira_avaliacoes/{id}` | Avaliacoes individuais (1 doc por avaliador por inscricao) |
| `feira_recursos/{id}` | Interposicoes de recurso contra avaliacoes |

### Esquema: `feira_edicoes`

```js
{
  ano: 2026,
  tema: "Elas na Ciencia: conectando saberes, tecnologia e meio ambiente",
  ativo: true,
  inscricoes_abertas: true,
  data_inicio_inscricoes: Timestamp,
  data_fim_inscricoes: Timestamp,
  data_etapa_regional: Timestamp,
  resultado_preliminar_publicado: false,
  resultado_final_publicado: false,
  criado_em: Timestamp
}
```

### Esquema: `feira_links_escolas`

```js
{
  edicao_id: "xxx",
  escola_inep: "53012345",
  escola_nome: "CEF Recanto das Emas",
  escola_cre: "recanto",
  token: "a1b2c3...",           // 24 bytes URL-safe
  projetos_count: 3,            // contador de projetos inscritos
  max_projetos: null,           // limite (null = sem limite)
  criado_em: Timestamp
}
```

### Esquema: `feira_rascunhos`

```js
{
  edicao_id: "xxx",
  link_escola_token: "a1b2c3...",  // vincula ao link da escola
  escola: { inep, nome, cre },     // copiado do link (somente leitura)
  status: "rascunho",

  // Etapa 1 - Orientador e Equipe
  orientador: { nome, email, telefone },
  orientador2: { nome, email } | null,
  estudantes: [
    { nome, serie, turma }          // 2-5 estudantes
  ],

  // Etapa 2 - Projeto
  titulo: "...",
  categoria: "I",                   // A-J
  resumo: "...",                    // opcional
  etapa_local_realizada: false,

  // Etapa 3 - Documentos
  documentos: {
    projeto_pesquisa: { url, path, nome, tamanho, enviado_em },
    termos_autorizacao: [
      { estudante_nome, url, path, nome, tamanho, enviado_em }
    ]
  },

  // Controle
  trancado: false,
  campos_liberados: [],             // para devolucao parcial
  ultima_secao_editada: "orientador",
  criado_em: Timestamp,
  atualizado_em: Timestamp
}
```

### Esquema: `feira_inscricoes`

```js
{
  rascunho_id: "xxx",              // liga ao rascunho
  edicao_id: "xxx",
  link_escola_token: "a1b2c3...",
  status: "enviada",

  // Dados copiados do rascunho no envio
  escola: { inep, nome, cre },
  orientador: { nome, email, telefone },
  orientador2: { nome, email } | null,
  titulo: "...",
  categoria: "I",
  resumo: "...",
  etapa_local_realizada: false,
  estudantes: [ { nome, serie, turma } ],
  documentos: { ... },

  // Ciclo de envio/devolucao
  envio_num: 1,
  devolucoes_num: 0,
  envios_hist: [{ em: Timestamp }],
  devolucoes_hist: [{ em, mensagem, prazo, campos_liberados, por_uid, por_nome }],
  prazo_correcao: Timestamp | null,

  // Analise pela comissao
  analise_documentos: {
    projeto: "valido" | "invalido" | "ilegivel",
    termos: ["valido", "invalido"]
  },
  analise_checklist: {
    categoria_ok: true,
    qtd_estudantes_ok: true,
    orientador_limite_ok: true,
    projeto_formato_ok: true
  },
  analise_observacoes: "...",
  parecer: "...",                   // parecer interno da comissao

  // Avaliacao (preenchido apos avaliacao por banca)
  avaliadores: ["uid1", "uid2", "uid3"],
  avaliacoes_concluidas: 0,         // 0 a 3
  nota_final: 85.3,                 // media dos 3 avaliadores
  notas_por_avaliador: [82.0, 85.0, 89.0],
  bonus_etapa_local: 1.0,
  nota_com_bonus: 86.3,

  // Ranking (preenchido na publicacao de resultado)
  classificacao: {
    posicao: 2,
    classificada_distrital: true
  },

  // Metadados
  criado_em: Timestamp,
  atualizado_em: Timestamp,
  decidido_em: Timestamp,
  decidido_por: { uid, nome }
}
```

### Esquema: `feira_avaliacoes`

```js
{
  inscricao_id: "xxx",
  edicao_id: "xxx",
  avaliador_uid: "xxx",
  avaliador_nome: "...",
  status: "pendente" | "concluida",
  notas: {
    projeto_1: 8.5,     // Item I - Criterio 1
    projeto_2: 9.0,     // Item I - Criterio 2
    projeto_3: 7.5,     // Item I - Criterio 3
    diario_1: 8.0,      // Item II - Criterio 1
    diario_2: 7.0,      // Item II - Criterio 2
    oral_1: 9.0,        // Item III - Criterio 1
    oral_2: 8.5,        // Item III - Criterio 2
    oral_3: 8.0,        // Item III - Criterio 3
    oral_4: 7.5,        // Item III - Criterio 4
    oral_5: 9.0         // Item III - Criterio 5
  },
  total_projeto: 25.0,  // soma Item I (max 30)
  total_diario: 15.0,   // soma Item II (max 20)
  total_oral: 42.0,     // soma Item III (max 50)
  total: 82.0,          // soma geral (max 100)
  observacoes: "...",
  criado_em: Timestamp,
  concluido_em: Timestamp
}
```

### Esquema: `feira_recursos`

```js
{
  inscricao_id: "xxx",
  edicao_id: "xxx",
  status: "pendente" | "deferido" | "indeferido",

  // Dados do recurso (Anexo VII do regulamento)
  avaliador_contestado: "uid ou identificacao",
  itens_contestados: ["oral_1", "oral_3"],
  justificativas: {
    oral_1: "...",       // max 100 palavras
    oral_3: "..."
  },

  // Resposta da comissao
  parecer_comissao: "...",
  decidido_em: Timestamp,
  decidido_por: { uid, nome },

  // Se deferido, novas notas
  notas_revisadas: { oral_1: 9.5, oral_3: 8.5 },
  nota_recalculada: 84.0,

  criado_em: Timestamp,
  criado_por: { orientador_nome, orientador_email }
}
```

---

## 10. Estrutura de Arquivos

### Novos arquivos

```
src/
  pages/
    feira/                              # Paginas administrativas
      FeiraListPage.jsx                 # Lista de inscricoes (filtros: escola, categoria, status)
      FeiraInscricaoPage.jsx            # Detalhe da inscricao
      FeiraAnalisePage.jsx              # Analise de documentos/dados
      FeiraAvaliacaoPage.jsx            # Form de avaliacao (avaliador)
      FeiraResultadosPage.jsx           # Ranking e resultados por categoria
      FeiraConfigPage.jsx               # Config da edicao + geracao de links
      FeiraRecursosPage.jsx             # Gestao de recursos
      FeiraLinksPage.jsx                # Lista de links por escola com status
    feira-publica/                      # Paginas publicas (sem login)
      EscolaPortal.jsx                  # Portal da escola (lista projetos + novo)
      ProjetoInscricao.jsx              # Wizard de inscricao do projeto
      ProjetoStatus.jsx                 # Detalhe/status de um projeto (professor)
  components/
    feira/                              # Componentes reutilizaveis
      ChecklistDocumentosFeira.jsx      # Upload com checklist
      FormularioAvaliacao.jsx           # Formulario de pontuacao (10 criterios)
      RankingTabela.jsx                 # Tabela de ranking por categoria
      ProjetoCard.jsx                   # Card de projeto na lista da escola
      StatusBadge.jsx                   # Badge de status
      WizardSteps.jsx                   # Navegacao do wizard
      CategoriaSelect.jsx              # Seletor de categoria com auto-sugestao
  services/
    feiraService.js                     # CRUD Firestore (inscricoes, avaliacoes, recursos)
    feiraLinksService.js                # CRUD links de escolas (geracao, listagem)
    feiraPublicaService.js              # Wrapper das Cloud Functions (envio, reenvio)
  constants/
    feiraConstants.js                   # Categorias A-J, criterios de avaliacao, mencoes, status

functions/
  feira.js                              # Cloud Functions (enviar, reenviar, gerar links)
```

### Alteracoes em arquivos existentes

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.jsx` | Adicionar rotas `/feira/*` (admin) e rotas publicas `/feira/{token}` e `/feira/{token}/projeto/*` |
| `src/components/layout/AppLayout.jsx` | Novo item no array `NAV`: "Feira de Ciencias" com sub-itens (Inscricoes, Links, Resultados, Config) |
| `src/pages/Dashboard.jsx` | Novo `ModuleCard` com stats: inscricoes recebidas, em analise, aprovadas, avaliadas |
| `src/hooks/usePermissoes.js` | Novo check: `isAvaliadorFeira` para o papel de avaliador |
| `firestore.rules` | Regras para as 6 novas colecoes |
| `storage.rules` | Regra para `feira/{allPaths=**}` (auth != null, incluindo anonymous) |
| `functions/index.js` | Exportar Cloud Functions de `feira.js` |

---

## 11. Mapeamento de Rotas

### Rotas publicas (sem autenticacao — anonymous auth)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/feira/{tokenEscola}` | EscolaPortal | Portal da escola: dados, lista de projetos, botao "novo projeto" |
| `/feira/{tokenEscola}/novo` | ProjetoInscricao | Wizard de inscricao de novo projeto |
| `/feira/{tokenEscola}/projeto/{rascunhoId}` | ProjetoInscricao | Editar/retomar rascunho existente |
| `/feira/{tokenEscola}/projeto/{rascunhoId}/status` | ProjetoStatus | Ver status, feedback da comissao, resultado |

### Rotas autenticadas (Comissao Regional)

| Rota | Pagina | Acesso |
|------|--------|--------|
| `/feira` | FeiraListPage | analyst / supervisor / admin |
| `/feira/config` | FeiraConfigPage | admin |
| `/feira/links` | FeiraLinksPage | analyst / supervisor / admin |
| `/feira/resultados` | FeiraResultadosPage | analyst / supervisor / admin |
| `/feira/recursos` | FeiraRecursosPage | supervisor / admin |
| `/feira/inscricao/{id}` | FeiraInscricaoPage | analyst / supervisor / admin |
| `/feira/inscricao/{id}/analise` | FeiraAnalisePage | analyst / supervisor / admin |
| `/feira/inscricao/{id}/avaliacao` | FeiraAvaliacaoPage | avaliador_feira (designado) |

---

## 12. Cloud Functions

### `feiraGerarLinks` (Callable, admin only)

- Input: `{ edicaoId }`
- Busca todas as escolas da CRE na colecao `schools`
- Para cada escola, gera token unico de 24 bytes e cria doc em `feira_links_escolas`
- Retorna: `{ ok, total_links, links: [{ escola, token }] }`

### `feiraEnviar` (Callable, anonymous auth)

- Input: `{ rascunhoId, payload }`
- Valida: edicao ativa, inscricoes abertas, dados completos, documentos anexados
- Cria ou atualiza doc em `feira_inscricoes` com todos os dados
- Incrementa `envio_num`, registra em `envios_hist`
- Atualiza status do rascunho para `enviada` ou `reenviada`
- Atualiza `projetos_count` no `feira_links_escolas`
- Retorna: `{ ok, inscricaoId, envio_num }`

### `feiraReenviar` (Callable, anonymous auth)

- Mesma logica do `feiraEnviar`, mas valida que o status era `devolvida`
- Reseta `trancado` e `campos_liberados` no rascunho
- Incrementa `envio_num`, preserva `devolucoes_num`

### `feiraCalcularResultados` (Callable, admin only)

- Input: `{ edicaoId, categoria }`
- Busca todas as inscricoes `avaliada` da categoria
- Calcula nota final (media dos 3 avaliadores) + bonus
- Aplica criterios de desempate sequenciais
- Gera ranking e atualiza `classificacao` em cada inscricao
- Retorna: `{ ok, ranking: [{ posicao, titulo, escola, nota }] }`

---

## 13. Regras Firestore

```javascript
// feira_edicoes: leitura para autenticados, escrita para admin
match /feira_edicoes/{docId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}

// feira_links_escolas: leitura para qualquer autenticado (inclui anonymous),
// escrita para admin
match /feira_links_escolas/{token} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}

// feira_rascunhos: leitura/escrita para qualquer autenticado (anonymous faz o preenchimento)
match /feira_rascunhos/{docId} {
  allow read, create, update: if request.auth != null;
  allow delete: if false;
}

// feira_inscricoes: criacao por Cloud Function (admin SDK);
// leitura para comissao + avaliadores designados;
// atualizacao para comissao
match /feira_inscricoes/{docId} {
  allow read: if isAnalyst() || isSupervisor() || isAdmin()
    || (request.auth != null && request.auth.uid in resource.data.avaliadores);
  allow create: if false; // apenas Cloud Function
  allow update: if isAnalyst() || isSupervisor() || isAdmin();
}

// feira_avaliacoes: leitura/escrita para avaliador designado e comissao
match /feira_avaliacoes/{docId} {
  allow read: if isAnalyst() || isSupervisor() || isAdmin()
    || (request.auth != null && request.auth.uid == resource.data.avaliador_uid);
  allow create, update: if request.auth != null
    && request.auth.uid == request.resource.data.avaliador_uid;
}

// feira_recursos: criacao por qualquer autenticado (professor via anonymous);
// leitura/atualizacao para comissao
match /feira_recursos/{docId} {
  allow create: if request.auth != null;
  allow read, update: if isSupervisor() || isAdmin();
}
```

---

## 14. Padroes Reutilizados vs Novos

### Reutilizados do sistema de referencia (sistema-ifb-recanto)

| Padrao | Origem | Adaptacao |
|--------|--------|-----------|
| Anonymous Auth para formulario publico | `InscricaoPublica.jsx` | Sem quiz de identidade; acesso direto pelo link da escola |
| Wizard multi-etapas com autosave | `InscricaoRetomada.jsx` | 3 etapas + revisao; campos adaptados ao contexto |
| Upload com checklist visual | `ChecklistDocumentos.jsx` | Documentos fixos (Projeto + Termos) em vez de dinamicos |
| Ciclo devolucao/correcao com prazo | `InscricaoAnalise.jsx` | Bloqueio granular por campo via `campos_liberados` |
| Cloud Function para envio seguro | `socioeconomicoEnviar` | Mesma logica: cria/atualiza doc oficial, incrementa ciclo |
| Historico de ciclos | `envios_hist / devolucoes_hist` | Identico |
| Debounce de autosave (800ms) | `InscricaoRetomada.jsx` | Identico |

### Elementos novos

| Elemento | Justificativa |
|----------|---------------|
| Link por escola (portal) | Uma escola gerencia todos os seus projetos pelo mesmo link |
| Colecao `feira_links_escolas` | Vincula token unico a escola+edicao |
| Papel `avaliador_feira` | Acesso restrito apenas aos trabalhos designados |
| Formulario de avaliacao 10 criterios | Exigencia do regulamento (Anexo VI) |
| Calculo de nota e ranking automaticos | Media de 3 avaliadores + bonus + desempate sequencial |
| Modulo de recursos | Exigencia do regulamento (Art. 8.2) |
| Geracao de certificados em lote | Reuso do pipeline puppeteer-core existente |
| Dashboard de resultados com ranking | Ranking por categoria com filtros e exportacao |

---

## 15. Faseamento de Implementacao

### Fase 1 — MVP Inscricao (prioridade alta)

- [x] Colecao `feira_edicoes` + pagina de config (`FeiraConfigPage`)
- [x] Colecao `feira_links_escolas` + geracao de links + pagina de links (`FeiraLinksPage`)
- [x] Portal publico da escola (`EscolaPortal`) com lista de projetos
- [x] Wizard de inscricao (`ProjetoInscricao`) com upload de documentos
- [x] Cloud Function `feiraEnviar`
- [x] Regras Firestore e Storage
- [x] Integracao: rotas em `App.jsx`, item no `NAV`, card no `Dashboard`

### Fase 2 — Analise e Correcao

- [x] Pagina de lista de inscricoes (`FeiraListPage`) com filtros
- [x] Pagina de detalhe (`FeiraInscricaoPage`)
- [x] Pagina de analise (`FeiraAnalisePage`) com checklist e validacao de documentos
- [x] Fluxo de devolucao: mensagem, prazo, `campos_liberados`
- [x] Cloud Function `feiraReenviar`
- [x] Status no portal publico (`ProjetoStatus`)

### Fase 3 — Avaliacao por Banca

- [x] Cadastro de avaliadores (flag `avaliador_feira` no usuario)
- [x] Designacao de avaliadores por inscricao
- [x] Formulario de avaliacao (`FeiraAvaliacaoPage`) com 10 criterios
- [x] Colecao `feira_avaliacoes`
- [x] Calculo automatico de nota final quando 3 avaliacoes concluidas

### Fase 4 — Resultados e Recursos

- [x] Cloud Function `feiraCalcularResultados` (ranking + desempate)
- [x] Pagina de resultados (`FeiraResultadosPage`) com ranking por categoria
- [x] Formulario de recurso (professor) + gestao (`FeiraRecursosPage`)
- [x] Recalculo de nota apos recurso deferido
- [x] Publicacao de resultado final

### Fase 5 — Certificacao e Relatorios

- [x] Geracao de certificados em lote (template HTML → PDF via puppeteer)
- [x] Exportacao de relatorios para SEI
- [x] Dashboard de acompanhamento geral
