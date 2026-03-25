# Modelo de Dados — Firestore
# Plataforma de Análise de PPP · SEEDF/DF
# Portaria 139/2024 + Portaria 174/2026

---

## Visão geral das coleções

```
/users
/schools
/analyses
  /{analysisId}/elementResults      ← subcoleção
/checklist_definitions              ← coleção de configuração estática
/audit_log
```

---

## 1. `/users/{userId}`

Usuários da plataforma (técnicos de CRE/Unieb, gestores SEEDF).

```js
{
  uid:        "string",           // Firebase Auth UID
  name:       "string",
  email:      "string",
  role:       "analyst" | "supervisor" | "admin",
  cre:        "string",           // ex: "CRE Gama" — filtra escolas visíveis
  createdAt:  Timestamp,
  active:     boolean
}
```

**Regras de acesso:** `analyst` vê apenas escolas da sua CRE; `supervisor` vê todas da CRE; `admin` vê tudo.

---

## 2. `/schools/{schoolId}`

Cadastro permanente de cada unidade escolar. Criado uma vez, reutilizado a cada ano.

```js
{
  // Identificação
  name:           "string",           // "CEF 01 do Gama"
  inep:           "string",           // código INEP (chave natural única)
  cre:            "string",           // "CRE Gama"
  address:        "string",

  // Oferta educacional — determina quais elementos são obrigatórios
  stages: {
    educacaoInfantil:   boolean,
    ensFundamental1:    boolean,      // Anos Iniciais
    ensFundamental2:    boolean,      // Anos Finais
    ensMedio:           boolean,      // ativa bloco 4 (Portaria 174/2026)
    eja:                boolean,
    educacaoEspecial:   boolean,
    socioeducacao:      boolean       // ativa elemento 1.3-XI (Art. 4º, XI)
  },

  // Se Ensino Médio: especificidades do bloco 4
  ensMedioConfig: {
    tempoIntegral:  boolean,          // ativa verificação do IFI
    itinerarios:    ["string"]        // lista dos itinerários ofertados
  },

  createdAt:   Timestamp,
  updatedAt:   Timestamp,
  createdBy:   "userId"
}
```

---

## 3. `/analyses/{analysisId}`

Uma análise = um PPP de um ano de uma escola. Documento principal da sessão de trabalho.

```js
{
  // Vínculo
  schoolId:     "string",           // ref → /schools/{schoolId}
  schoolName:   "string",           // desnormalizado para queries
  cre:          "string",           // desnormalizado
  analystId:    "string",           // ref → /users/{userId}
  year:         2026,               // ano do PPP principal

  // Estado geral
  status: "pending" | "in_progress" | "review" | "approved" | "rejected",
  // pending     → upload feito, análise IA ainda não rodou
  // in_progress → analista revisando os elementos
  // review      → analista enviou para supervisão
  // approved    → parecer aprovado
  // rejected    → parecer com reprovação emitido

  // Contadores (mantidos em sync para dashboard rápido)
  stats: {
    total:       number,   // total de elementos aplicáveis a esta escola
    critical:    number,   // 🔴 críticos pendentes de confirmação
    attention:   number,   // 🟡 atenção pendentes
    adequate:    number,   // 🟢 adequados confirmados
    confirmed:   number,   // quantos o analista já revisou
    overridden:  number    // quantos o analista discordou da IA
  },

  // Arquivos (Storage paths)
  files: {
    ppp2026: {
      storagePath:  "string",       // gs://bucket/analyses/{id}/ppp2026.pdf
      fileName:     "string",
      fileType:     "pdf" | "docx",
      uploadedAt:   Timestamp,
      extractedText: boolean        // true após pipeline de extração
    },
    ppp2025: {                      // opcional — comparativo
      storagePath:  "string",
      fileName:     "string",
      fileType:     "pdf" | "docx",
      uploadedAt:   Timestamp,
      extractedText: boolean
    }
  },

  // Resultado da análise IA (preenchido após processamento)
  aiAnalysis: {
    ranAt:          Timestamp,
    modelVersion:   "string",       // ex: "claude-sonnet-4-6"
    processingMs:   number,
    error:          "string" | null
  },

  // Parecer final (preenchido na Etapa 7)
  finalReport: {
    generatedAt:    Timestamp,
    storagePath:    "string",       // gs://bucket/reports/{id}/parecer.docx
    analystNotes:   "string",       // texto livre do analista
    decision:       "approved_with_remarks" | "rejected" | null
  },

  // Comparativo 2025→2026 (preenchido se ppp2025 disponível)
  comparison: {
    ranAt:          Timestamp,
    newElements:    ["elementId"],  // presentes em 2026, ausentes em 2025
    removedElements:["elementId"],  // presentes em 2025, ausentes em 2026
    improved:       ["elementId"],  // avaliação melhorou
    regressed:      ["elementId"]   // avaliação piorou
  },

  createdAt:  Timestamp,
  updatedAt:  Timestamp
}
```

---

## 4. `/analyses/{analysisId}/elementResults/{elementId}`

**Subcoleção** — um documento por elemento verificável do PPP.
É aqui que mora o coração da verificação.

`elementId` = código do checklist, ex: `"B1_1_capa"`, `"B5_2B_projeto_maria_penha"`

```js
{
  // Identidade do elemento
  elementId:      "string",         // ex: "B5_2B_projeto_maria_penha"
  blockCode:      "string",         // ex: "B5" (Bloco 5 — Projetos)
  blockLabel:     "string",         // ex: "Programas e Projetos"
  label:          "string",         // ex: "Projeto: combate ao machismo / Lei Maria da Penha"
  normRef:        "string",         // ex: "Art. 9º, II, m, 2 — Portaria 174/2026"
  isCritical:     boolean,          // true = 🔴, false = pode ser 🟡 ou 🟢
  isConditional:  boolean,          // true = só se aplica a certas escolas
  conditionKey:   "string" | null,  // ex: "ensMedio", "socioeducacao"
  isNewIn2026:    boolean,          // destaque visual NOVO 2026

  // Resultado da IA
  aiResult: {
    status:   "adequate" | "attention" | "critical" | "not_applicable",
    score:    number,               // 0.0–1.0 — confiança da análise
    summary:  "string",            // descrição do problema encontrado (≤300 chars)
    excerpts: [                    // trechos localizados no documento
      {
        text:     "string",        // trecho extraído
        page:     number | null,   // página (se PDF)
        section:  "string" | null  // título da seção identificada
      }
    ],
    missingItems: ["string"],      // itens específicos não encontrados
    legalRefs: {                   // verificação de citações legais obrigatórias
      required:  ["string"],       // ex: ["Lei 10.639/2003", "Lei 11.645/2008"]
      found:     ["string"],       // quais foram encontradas no texto
      missing:   ["string"]        // quais estão faltando
    }
  },

  // Revisão humana do analista
  humanReview: {
    status:    "pending" | "confirmed" | "overridden" | "skipped",
    decision:  "agree" | "disagree" | null,
    comment:   "string" | null,    // texto livre do analista
    reviewedAt: Timestamp | null,
    reviewedBy: "userId" | null
  },

  // Status efetivo (combinação IA + revisão humana)
  // Calculado no cliente / Cloud Function
  effectiveStatus: "adequate" | "attention" | "critical" | "overridden" | "not_applicable",

  // Para comparativo 2025
  comparison2025: {
    previousStatus: "adequate" | "attention" | "critical" | "absent" | null,
    delta:          "improved" | "regressed" | "same" | "new" | null
  },

  createdAt:  Timestamp,
  updatedAt:  Timestamp
}
```

---

## 5. `/checklist_definitions/{elementId}`

Coleção **estática de configuração** — define todos os elementos verificáveis
conforme as portarias. Editada apenas por `admin`. Lida pelo pipeline de IA
e pelo front-end para montar o formulário de revisão.

```js
{
  // Identidade
  elementId:      "string",         // "B5_2B_projeto_maria_penha"
  blockCode:      "string",         // "B5"
  blockLabel:     "string",         // "Programas e Projetos"
  order:          number,           // ordem de exibição dentro do bloco

  // Rótulo e descrição
  label:          "string",
  description:    "string",         // orientação completa para o analista

  // Normativa
  normRef:        "string",         // "Art. 9º, II, m, 2 — Portaria 174/2026"
  legalBasis: [                     // leis/decretos que fundamentam este elemento
    {
      norm:   "string",             // "Lei Federal 11.340/2006"
      alias:  "string",             // "Lei Maria da Penha"
      required: boolean             // se a citação é obrigatória no PPP
    }
  ],

  // Comportamento
  isCritical:       boolean,
  isConditional:    boolean,
  conditionKey:     "string" | null,  // campo de /schools.stages que ativa
  isNewIn2026:      boolean,
  active:           boolean,

  // Prompt de análise para IA (template)
  aiPromptTemplate: "string",         // template com placeholders {schoolName}, {text}

  // Palavras-chave para busca no texto (heurística rápida)
  searchKeywords:   ["string"],
  negativeKeywords: ["string"],       // palavras que indicam ausência real

  createdAt:  Timestamp,
  updatedAt:  Timestamp
}
```

---

## 6. `/audit_log/{logId}`

Registro imutável de todas as ações relevantes (conformidade e rastreabilidade).

```js
{
  action:     "upload" | "ai_analysis_complete" | "element_reviewed"
            | "report_generated" | "status_changed" | "override",
  analysisId: "string",
  schoolId:   "string",
  userId:     "string",
  elementId:  "string" | null,
  before:     any | null,           // estado anterior (para overrides)
  after:      any | null,           // estado posterior
  metadata:   {},                   // informações adicionais livres
  timestamp:  Timestamp
}
```

---

## Índices compostos necessários (Firestore)

```
# Dashboard por CRE
analyses: cre ASC, year ASC, status ASC

# Painel do analista
analyses: analystId ASC, status ASC, updatedAt DESC

# Elementos pendentes em uma análise
elementResults: analysisId + humanReview.status == "pending" + isCritical DESC

# Listagem de escolas por CRE
schools: cre ASC, name ASC
```

---

## Regras de Segurança (Firestore Rules — esboço)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helpers
    function isAuth() { return request.auth != null; }
    function role()   { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
    function myCRE()  { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.cre; }

    match /users/{userId} {
      allow read:  if isAuth() && (request.auth.uid == userId || role() == "admin");
      allow write: if isAuth() && role() == "admin";
    }

    match /schools/{schoolId} {
      allow read:  if isAuth();
      allow write: if isAuth() && (role() == "admin" || role() == "supervisor");
    }

    match /analyses/{analysisId} {
      allow read:  if isAuth() && (
        role() == "admin" ||
        role() == "supervisor" ||
        resource.data.cre == myCRE()
      );
      allow create: if isAuth() && role() in ["analyst","supervisor","admin"];
      allow update: if isAuth() && (
        role() in ["supervisor","admin"] ||
        resource.data.analystId == request.auth.uid
      );
      allow delete: if isAuth() && role() == "admin";

      match /elementResults/{elementId} {
        allow read:  if isAuth();
        allow write: if isAuth() && (
          role() in ["supervisor","admin"] ||
          get(/databases/$(database)/documents/analyses/$(analysisId)).data.analystId == request.auth.uid
        );
      }
    }

    match /checklist_definitions/{elementId} {
      allow read:  if isAuth();
      allow write: if isAuth() && role() == "admin";
    }

    match /audit_log/{logId} {
      allow read:  if isAuth() && role() in ["supervisor","admin"];
      allow create: if isAuth();
      allow update, delete: if false;  // imutável
    }
  }
}
```

---

## Contagem de documentos esperada (estimativa de escala)

| Coleção                | Estimativa |
|------------------------|-----------|
| `users`                | ~200       |
| `schools`              | ~700       |
| `analyses`             | ~700/ano   |
| `elementResults`       | ~18.000/ano (700 escolas × ~26 elementos médios) |
| `checklist_definitions`| ~30 fixos  |
| `audit_log`            | ~50.000/ano|

Dentro dos limites free-tier do Firestore com folga. Sem necessidade de sharding.

---

## Notas de implementação

**IDs dos documentos:**
- `schools/{inep}` — usar código INEP como ID natural evita duplicatas
- `analyses/{schoolId}_{year}` — chave composta garante unicidade por escola/ano
- `elementResults/{elementId}` — ID estático do checklist (não auto-gerado)
- `audit_log` — sempre `addDoc()` com ID auto-gerado

**Desnormalização intencional:**
- `schoolName` e `cre` em `analyses` evitam joins no dashboard
- `effectiveStatus` calculado e persistido evita recalcular no cliente a cada render

**Cloud Functions recomendadas:**
- `onAnalysisCreate` → inicializa os documentos de `elementResults` a partir de `/checklist_definitions`, filtrando pelos `stages` da escola
- `onElementResultUpdate` → recalcula `analyses.stats` em tempo real
- `onReportGenerate` → gera o `.docx` do parecer final via `docx` (npm) e salva no Storage
