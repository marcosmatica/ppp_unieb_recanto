// functions/src/feira.js

const { onCall, HttpsError } = require("firebase-functions/v2/https")
const { onDocumentWritten } = require("firebase-functions/v2/firestore")
const { getFirestore, FieldValue } = require("firebase-admin/firestore")
const crypto = require("crypto")

const db = getFirestore()

// ─── feiraGerarLinks ─────────────────────────────────────────────────────────

const feiraGerarLinks = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin pode gerar links")
    }

    const { edicaoId } = request.data
    if (!edicaoId) throw new HttpsError("invalid-argument", "edicaoId obrigatório")

    const edicaoSnap = await db.collection("feira_edicoes").doc(edicaoId).get()
    if (!edicaoSnap.exists) throw new HttpsError("not-found", "Edição não encontrada")

    const cre = userDoc.data().cre
    const schoolsSnap = await db.collection("schools").where("cre", "==", cre).get()

    const batch = db.batch()
    const links = []

    for (const schoolDoc of schoolsSnap.docs) {
      const school = schoolDoc.data()
      const existingQ = await db.collection("feira_links_escolas")
        .where("edicao_id", "==", edicaoId)
        .where("escola_inep", "==", schoolDoc.id)
        .limit(1)
        .get()

      if (!existingQ.empty) continue

      const token = crypto.randomBytes(24).toString("base64url")
      const ref = db.collection("feira_links_escolas").doc(token)
      batch.set(ref, {
        edicao_id: edicaoId,
        escola_inep: schoolDoc.id,
        escola_nome: school.name,
        escola_cre: school.cre,
        token,
        projetos_count: 0,
        max_projetos: null,
        criado_em: FieldValue.serverTimestamp(),
      })
      links.push({ escola: school.name, token })
    }

    await batch.commit()
    return { ok: true, total_links: links.length, links }
  }
)

// ─── feiraEnviar ─────────────────────────────────────────────────────────────

const feiraEnviar = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const { rascunhoId, payload } = request.data
    if (!rascunhoId || !payload) throw new HttpsError("invalid-argument", "Dados incompletos")

    const edicaoSnap = await db.collection("feira_edicoes").doc(payload.edicao_id).get()
    if (!edicaoSnap.exists) throw new HttpsError("not-found", "Edição não encontrada")
    const edicao = edicaoSnap.data()
    if (!edicao.ativo || !edicao.inscricoes_abertas) {
      throw new HttpsError("failed-precondition", "Inscrições não estão abertas")
    }

    if (!payload.titulo || !payload.categoria || !payload.orientador?.nome) {
      throw new HttpsError("invalid-argument", "Campos obrigatórios não preenchidos")
    }
    if (!payload.documentos?.projeto_pesquisa?.url) {
      throw new HttpsError("invalid-argument", "Projeto de Pesquisa obrigatório")
    }
    if (!payload.estudantes?.length || payload.estudantes.length < 2) {
      throw new HttpsError("invalid-argument", "Mínimo de 2 estudantes")
    }

    const inscricaoRef = db.collection("feira_inscricoes").doc()
    await inscricaoRef.set({
      rascunho_id: rascunhoId,
      edicao_id: payload.edicao_id,
      link_escola_token: payload.link_escola_token,
      status: "enviada",
      escola: payload.escola,
      orientador: payload.orientador,
      orientador2: payload.orientador2 || null,
      titulo: payload.titulo,
      categoria: payload.categoria,
      resumo: payload.resumo || "",
      etapa_local_realizada: payload.etapa_local_realizada || false,
      estudantes: payload.estudantes,
      documentos: payload.documentos,
      envio_num: 1,
      devolucoes_num: 0,
      envios_hist: [{ em: new Date().toISOString() }],
      devolucoes_hist: [],
      prazo_correcao: null,
      criado_em: FieldValue.serverTimestamp(),
      atualizado_em: FieldValue.serverTimestamp(),
    })

    await db.collection("feira_rascunhos").doc(rascunhoId).update({
      status: "enviada",
      atualizado_em: FieldValue.serverTimestamp(),
    })

    await db.collection("feira_links_escolas").doc(payload.link_escola_token).update({
      projetos_count: FieldValue.increment(1),
    })

    return { ok: true, inscricaoId: inscricaoRef.id, envio_num: 1 }
  }
)

// ─── feiraReenviar ───────────────────────────────────────────────────────────

const feiraReenviar = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const { rascunhoId, payload } = request.data
    if (!rascunhoId || !payload) throw new HttpsError("invalid-argument", "Dados incompletos")

    const inscSnap = await db.collection("feira_inscricoes")
      .where("rascunho_id", "==", rascunhoId)
      .limit(1)
      .get()

    if (inscSnap.empty) throw new HttpsError("not-found", "Inscrição não encontrada")

    const inscDoc = inscSnap.docs[0]
    const insc = inscDoc.data()

    if (insc.status !== "devolvida") {
      throw new HttpsError("failed-precondition", "Inscrição não está devolvida")
    }

    const novoEnvio = (insc.envio_num || 1) + 1
    await inscDoc.ref.update({
      status: "reenviada",
      escola: payload.escola,
      orientador: payload.orientador,
      orientador2: payload.orientador2 || null,
      titulo: payload.titulo,
      categoria: payload.categoria,
      resumo: payload.resumo || "",
      etapa_local_realizada: payload.etapa_local_realizada || false,
      estudantes: payload.estudantes,
      documentos: payload.documentos,
      envio_num: novoEnvio,
      envios_hist: [...(insc.envios_hist || []), { em: new Date().toISOString() }],
      prazo_correcao: null,
      atualizado_em: FieldValue.serverTimestamp(),
    })

    await db.collection("feira_rascunhos").doc(rascunhoId).update({
      status: "reenviada",
      trancado: false,
      campos_liberados: [],
      atualizado_em: FieldValue.serverTimestamp(),
    })

    return { ok: true, inscricaoId: inscDoc.id, envio_num: novoEnvio }
  }
)

// ─── feiraCalcularResultados ─────────────────────────────────────────────────

const feiraCalcularResultados = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin")
    }

    const { edicaoId, categoria } = request.data
    if (!edicaoId || !categoria) throw new HttpsError("invalid-argument", "edicaoId e categoria obrigatórios")

    const inscSnap = await db.collection("feira_inscricoes")
      .where("edicao_id", "==", edicaoId)
      .where("categoria", "==", categoria)
      .where("status", "==", "avaliada")
      .get()

    const ranking = []

    for (const doc of inscSnap.docs) {
      const insc = doc.data()
      const avalSnap = await db.collection("feira_avaliacoes")
        .where("inscricao_id", "==", doc.id)
        .where("status", "==", "concluida")
        .get()

      if (avalSnap.size < 3) continue

      const notas = avalSnap.docs.map(a => a.data().total)
      const media = notas.reduce((s, n) => s + n, 0) / notas.length
      const bonus = insc.etapa_local_realizada ? 1.0 : 0
      const notaFinal = Math.min(100, media + bonus)

      const oralMedias = avalSnap.docs.map(a => a.data().total_oral)
      const projetoMedias = avalSnap.docs.map(a => a.data().total_projeto)

      await doc.ref.update({
        nota_final: parseFloat(media.toFixed(1)),
        notas_por_avaliador: notas,
        bonus_etapa_local: bonus,
        nota_com_bonus: parseFloat(notaFinal.toFixed(1)),
        media_oral: parseFloat((oralMedias.reduce((s, n) => s + n, 0) / oralMedias.length).toFixed(1)),
        media_projeto: parseFloat((projetoMedias.reduce((s, n) => s + n, 0) / projetoMedias.length).toFixed(1)),
      })

      ranking.push({
        id: doc.id,
        titulo: insc.titulo,
        escola: insc.escola?.nome,
        nota: notaFinal,
        etapa_local: insc.etapa_local_realizada,
        media_oral: oralMedias.reduce((s, n) => s + n, 0) / oralMedias.length,
        media_projeto: projetoMedias.reduce((s, n) => s + n, 0) / projetoMedias.length,
      })
    }

    ranking.sort((a, b) => {
      if (b.nota !== a.nota) return b.nota - a.nota
      if (a.etapa_local !== b.etapa_local) return a.etapa_local ? -1 : 1
      if (b.media_oral !== a.media_oral) return b.media_oral - a.media_oral
      return b.media_projeto - a.media_projeto
    })

    const batch = db.batch()
    ranking.forEach((r, i) => {
      batch.update(db.collection("feira_inscricoes").doc(r.id), {
        classificacao: { posicao: i + 1, classificada_distrital: i < 2 },
        status: "resultado_preliminar",
      })
    })
    await batch.commit()

    return { ok: true, ranking: ranking.map((r, i) => ({ posicao: i + 1, ...r })) }
  }
)

// ─── feiraOnAvaliacaoWrite ───────────────────────────────────────────────────
// Auto-calculate nota final when all 3 evaluations are completed

const feiraOnAvaliacaoWrite = onDocumentWritten(
  { document: "feira_avaliacoes/{avalId}", region: "southamerica-east1" },
  async (event) => {
    const after = event.data?.after?.data()
    if (!after || after.status !== "concluida") return

    const inscricaoId = after.inscricao_id
    if (!inscricaoId) return

    const avalSnap = await db.collection("feira_avaliacoes")
      .where("inscricao_id", "==", inscricaoId)
      .where("status", "==", "concluida")
      .get()

    const concluidas = avalSnap.size

    const inscRef = db.collection("feira_inscricoes").doc(inscricaoId)
    const inscSnap = await inscRef.get()
    if (!inscSnap.exists) return
    const insc = inscSnap.data()

    await inscRef.update({ avaliacoes_concluidas: concluidas })

    if (concluidas >= 3) {
      const notas = avalSnap.docs.map(a => a.data().total)
      const media = notas.reduce((s, n) => s + n, 0) / notas.length
      const bonus = insc.etapa_local_realizada ? 1.0 : 0
      const notaFinal = Math.min(100, media + bonus)

      const oralMedias = avalSnap.docs.map(a => a.data().total_oral)
      const projetoMedias = avalSnap.docs.map(a => a.data().total_projeto)

      await inscRef.update({
        status: "avaliada",
        nota_final: parseFloat(media.toFixed(1)),
        notas_por_avaliador: notas,
        bonus_etapa_local: bonus,
        nota_com_bonus: parseFloat(notaFinal.toFixed(1)),
        media_oral: parseFloat((oralMedias.reduce((s, n) => s + n, 0) / oralMedias.length).toFixed(1)),
        media_projeto: parseFloat((projetoMedias.reduce((s, n) => s + n, 0) / projetoMedias.length).toFixed(1)),
        atualizado_em: FieldValue.serverTimestamp(),
      })
    }
  }
)

// ─── feiraRecalcularRecurso ─────────────────────────────────────────────────
// Recalculate nota after a recurso is granted (deferido)

const feiraRecalcularRecurso = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || !["supervisor", "admin"].includes(userDoc.data().role)) {
      throw new HttpsError("permission-denied", "Sem permissão")
    }

    const { recursoId, notasRevisadas } = request.data
    if (!recursoId || !notasRevisadas) throw new HttpsError("invalid-argument", "Dados incompletos")

    const recursoSnap = await db.collection("feira_recursos").doc(recursoId).get()
    if (!recursoSnap.exists) throw new HttpsError("not-found", "Recurso não encontrado")

    const recurso = recursoSnap.data()
    const inscricaoId = recurso.inscricao_id

    const avalSnap = await db.collection("feira_avaliacoes")
      .where("inscricao_id", "==", inscricaoId)
      .where("avaliador_uid", "==", recurso.avaliador_contestado)
      .limit(1)
      .get()

    if (avalSnap.empty) throw new HttpsError("not-found", "Avaliação não encontrada")

    const avalDoc = avalSnap.docs[0]
    const avalData = avalDoc.data()
    const notasAtualizadas = { ...avalData.notas, ...notasRevisadas }

    const totalProjeto = ["projeto_1", "projeto_2", "projeto_3"].reduce((s, k) => s + (notasAtualizadas[k] || 0), 0)
    const totalDiario = ["diario_1", "diario_2"].reduce((s, k) => s + (notasAtualizadas[k] || 0), 0)
    const totalOral = ["oral_1", "oral_2", "oral_3", "oral_4", "oral_5"].reduce((s, k) => s + (notasAtualizadas[k] || 0), 0)
    const total = totalProjeto + totalDiario + totalOral

    await avalDoc.ref.update({
      notas: notasAtualizadas,
      total_projeto: totalProjeto,
      total_diario: totalDiario,
      total_oral: totalOral,
      total,
    })

    const todasAvals = await db.collection("feira_avaliacoes")
      .where("inscricao_id", "==", inscricaoId)
      .where("status", "==", "concluida")
      .get()

    const notas = todasAvals.docs.map(a => {
      if (a.id === avalDoc.id) return total
      return a.data().total
    })

    const inscRef = db.collection("feira_inscricoes").doc(inscricaoId)
    const inscSnap = await inscRef.get()
    const insc = inscSnap.data()

    const media = notas.reduce((s, n) => s + n, 0) / notas.length
    const bonus = insc.etapa_local_realizada ? 1.0 : 0
    const notaFinal = Math.min(100, media + bonus)

    await inscRef.update({
      nota_final: parseFloat(media.toFixed(1)),
      notas_por_avaliador: notas,
      nota_com_bonus: parseFloat(notaFinal.toFixed(1)),
      atualizado_em: FieldValue.serverTimestamp(),
    })

    await db.collection("feira_recursos").doc(recursoId).update({
      notas_revisadas: notasRevisadas,
      nota_recalculada: parseFloat(notaFinal.toFixed(1)),
    })

    return { ok: true, nota_recalculada: parseFloat(notaFinal.toFixed(1)) }
  }
)

// ─── feiraPublicarResultadoFinal ────────────────────────────────────────────

const feiraPublicarResultadoFinal = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin")
    }

    const { edicaoId } = request.data
    if (!edicaoId) throw new HttpsError("invalid-argument", "edicaoId obrigatório")

    const inscSnap = await db.collection("feira_inscricoes")
      .where("edicao_id", "==", edicaoId)
      .where("status", "==", "resultado_preliminar")
      .get()

    const batch = db.batch()

    for (const doc of inscSnap.docs) {
      const insc = doc.data()
      const classificada = insc.classificacao?.classificada_distrital === true
      batch.update(doc.ref, {
        status: classificada ? "classificada_distrital" : "nao_classificada",
        atualizado_em: FieldValue.serverTimestamp(),
      })
    }

    batch.update(db.collection("feira_edicoes").doc(edicaoId), {
      resultado_final_publicado: true,
      atualizado_em: FieldValue.serverTimestamp(),
    })

    await batch.commit()
    return { ok: true, total: inscSnap.size }
  }
)

// ─── feiraGerarCertificados ─────────────────────────────────────────────────

const feiraGerarCertificados = onCall(
  { region: "southamerica-east1", timeoutSeconds: 540, memory: "1GiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin")
    }

    const { edicaoId } = request.data
    if (!edicaoId) throw new HttpsError("invalid-argument", "edicaoId obrigatório")

    const edicaoSnap = await db.collection("feira_edicoes").doc(edicaoId).get()
    if (!edicaoSnap.exists) throw new HttpsError("not-found", "Edição não encontrada")
    const edicao = edicaoSnap.data()

    const statusFinais = ["resultado_final", "classificada_distrital", "nao_classificada"]
    const inscSnap = await db.collection("feira_inscricoes")
      .where("edicao_id", "==", edicaoId)
      .where("status", "in", statusFinais)
      .get()

    if (inscSnap.empty) throw new HttpsError("failed-precondition", "Nenhuma inscrição com resultado final")

    const puppeteer = require("puppeteer-core")
    const chromium = require("@sparticuz/chromium")
    const { getStorage } = require("firebase-admin/storage")
    const bucket = getStorage().bucket()

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1123, height: 794 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    const certificados = []

    for (const doc of inscSnap.docs) {
      const insc = doc.data()
      const participantes = [
        ...(insc.estudantes || []).map(e => ({ nome: e.nome, tipo: "Estudante" })),
        { nome: insc.orientador?.nome, tipo: "Professor(a) Orientador(a)" },
        ...(insc.orientador2?.nome ? [{ nome: insc.orientador2.nome, tipo: "Professor(a) Coorientador(a)" }] : []),
      ]

      for (const p of participantes) {
        const html = gerarHtmlCertificado({
          nomeParticipante: p.nome,
          tipoParticipante: p.tipo,
          titulo: insc.titulo,
          categoria: insc.categoria,
          escola: insc.escola?.nome,
          ano: edicao.ano,
          tema: edicao.tema,
        })

        await page.setContent(html, { waitUntil: "networkidle0" })
        const pdfBuffer = await page.pdf({ width: "297mm", height: "210mm", printBackground: true })

        const nomeArquivo = `${p.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${doc.id}.pdf`
        const filePath = `feira/${edicaoId}/certificados/${nomeArquivo}`
        const file = bucket.file(filePath)
        await file.save(pdfBuffer, { contentType: "application/pdf" })

        certificados.push({ nome: p.nome, tipo: p.tipo, path: filePath })
      }
    }

    await browser.close()
    return { ok: true, total: certificados.length, certificados }
  }
)

// ─── feiraGerarRelatorioSEI ─────────────────────────────────────────────────

const CATEGORIAS_LABEL = {
  A: 'A — Educação Infantil (Creche)',
  B: 'B — Educação Infantil (Pré-escola)',
  C: 'C — Anos Iniciais (1º ao 3º ano)',
  D: 'D — Anos Iniciais (4º e 5º ano)',
  E: 'E — Anos Finais (6º e 7º ano)',
  F: 'F — Anos Finais (8º e 9º ano)',
  G: 'G — Ensino Médio (1ª série)',
  H: 'H — Ensino Médio (2ª e 3ª série)',
  I: 'I — Educação de Jovens e Adultos',
  J: 'J — Educação Especial',
}

const feiraGerarRelatorioSEI = onCall(
  { region: "southamerica-east1", timeoutSeconds: 300, memory: "1GiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin")
    }

    const { edicaoId, categoria } = request.data
    if (!edicaoId) throw new HttpsError("invalid-argument", "edicaoId obrigatório")

    const edicaoSnap = await db.collection("feira_edicoes").doc(edicaoId).get()
    if (!edicaoSnap.exists) throw new HttpsError("not-found", "Edição não encontrada")
    const edicao = edicaoSnap.data()

    const statusFinais = ["avaliada", "resultado_preliminar", "resultado_final", "classificada_distrital", "nao_classificada"]
    let q = db.collection("feira_inscricoes")
      .where("edicao_id", "==", edicaoId)
      .where("status", "in", statusFinais)

    const inscSnap = await q.get()
    if (inscSnap.empty) throw new HttpsError("failed-precondition", "Nenhuma inscrição com resultado")

    let inscricoes = inscSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (categoria) inscricoes = inscricoes.filter(i => i.categoria === categoria)
    if (inscricoes.length === 0) throw new HttpsError("failed-precondition", "Nenhuma inscrição nesta categoria")

    inscricoes.sort((a, b) => (b.nota_com_bonus ?? b.nota_final ?? 0) - (a.nota_com_bonus ?? a.nota_final ?? 0))

    const porCategoria = {}
    for (const insc of inscricoes) {
      const cat = insc.categoria || '?'
      if (!porCategoria[cat]) porCategoria[cat] = []
      porCategoria[cat].push(insc)
    }

    const html = gerarHtmlRelatorioSEI({ edicao, porCategoria, categoriaFiltro: categoria })

    const puppeteer = require("puppeteer-core")
    const chromium = require("@sparticuz/chromium")
    const { getStorage } = require("firebase-admin/storage")
    const bucket = getStorage().bucket()

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" } })
    await browser.close()

    const sufixo = categoria ? `_cat_${categoria}` : '_geral'
    const nomeArquivo = `relatorio_sei_${edicao.ano}${sufixo}.pdf`
    const filePath = `feira/${edicaoId}/relatorios/${nomeArquivo}`
    const file = bucket.file(filePath)
    await file.save(pdfBuffer, { contentType: "application/pdf" })

    const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 7 * 24 * 60 * 60 * 1000 })
    return { ok: true, downloadUrl: url, fileName: nomeArquivo, total: inscricoes.length }
  }
)

function gerarHtmlRelatorioSEI({ edicao, porCategoria, categoriaFiltro }) {
  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const tituloCategoria = categoriaFiltro ? ` — Categoria ${CATEGORIAS_LABEL[categoriaFiltro] || categoriaFiltro}` : ''

  const categoriasOrdenadas = Object.keys(porCategoria).sort()
  let tabelasHtml = ''

  for (const cat of categoriasOrdenadas) {
    const lista = porCategoria[cat]
    tabelasHtml += `
      <h3 style="margin:24px 0 8px;font-size:13px;color:#1e3a5f;">Categoria ${CATEGORIAS_LABEL[cat] || cat}</h3>
      <table>
        <thead>
          <tr>
            <th style="width:30px">Pos.</th>
            <th>Título do Trabalho</th>
            <th>Escola</th>
            <th style="width:90px">Orientador(a)</th>
            <th style="width:40px">Nota</th>
            <th style="width:50px">Bônus</th>
            <th style="width:55px">Nota Final</th>
            <th style="width:55px">Distrital</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map((insc, idx) => `
            <tr>
              <td style="text-align:center">${insc.classificacao?.posicao ?? (idx + 1)}</td>
              <td>${insc.titulo || ''}</td>
              <td>${insc.escola?.nome || ''}</td>
              <td>${insc.orientador?.nome || ''}</td>
              <td style="text-align:center">${(insc.nota_final ?? 0).toFixed(1)}</td>
              <td style="text-align:center">${insc.bonus_etapa_local ? '+1,0' : '—'}</td>
              <td style="text-align:center;font-weight:bold">${(insc.nota_com_bonus ?? insc.nota_final ?? 0).toFixed(1)}</td>
              <td style="text-align:center">${insc.classificacao?.classificada_distrital ? 'Sim' : 'Não'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }

  const totalInscritos = Object.values(porCategoria).reduce((s, l) => s + l.length, 0)
  const totalClassificados = Object.values(porCategoria).reduce((s, l) => s + l.filter(i => i.classificacao?.classificada_distrital).length, 0)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 11px; line-height: 1.5; color: #222; }
  h1 { font-size: 16px; text-align: center; color: #1e3a5f; margin-bottom: 4px; }
  h2 { font-size: 13px; text-align: center; color: #333; font-weight: normal; margin-bottom: 16px; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; }
  .header .org { font-size: 10px; color: #555; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
  th { background: #f0f4f8; border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-weight: 600; font-size: 9px; }
  td { border: 1px solid #ddd; padding: 4px 6px; }
  tr:nth-child(even) td { background: #fafbfc; }
  .resumo { margin: 20px 0; padding: 12px; background: #f0f4f8; border-left: 3px solid #1e3a5f; font-size: 11px; }
  .footer { margin-top: 32px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #ccc; padding-top: 8px; }
  .assinatura { margin-top: 48px; display: flex; justify-content: space-around; }
  .assinatura div { text-align: center; width: 200px; }
  .assinatura .linha { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 10px; }
</style></head><body>
  <div class="header">
    <div class="org">SECRETARIA DE ESTADO DE EDUCAÇÃO DO DISTRITO FEDERAL</div>
    <div class="org">COORDENAÇÃO REGIONAL DE ENSINO DO RECANTO DAS EMAS</div>
    <h1>Relatório da Etapa Regional — 15º CCEP-DF ${edicao.ano}</h1>
    <h2>${edicao.tema || ''}${tituloCategoria}</h2>
  </div>

  <div class="resumo">
    <strong>Resumo:</strong> ${totalInscritos} trabalho(s) avaliado(s) em ${categoriasOrdenadas.length} categoria(s).
    ${totalClassificados} trabalho(s) classificado(s) para a Etapa Distrital.
  </div>

  ${tabelasHtml}

  <div class="assinatura">
    <div><div class="linha">Presidente da Comissão Regional</div></div>
    <div><div class="linha">Coordenador(a) Regional de Ensino</div></div>
  </div>

  <div class="footer">
    Documento gerado eletronicamente pelo sistema UNIEB Recanto em ${dataAtual}.
  </div>
</body></html>`
}

function gerarHtmlCertificado({ nomeParticipante, tipoParticipante, titulo, categoria, escola, ano, tema }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 297mm; height: 210mm; font-family: 'Georgia', serif; background: #fff; display: flex; align-items: center; justify-content: center; }
  .cert { width: 277mm; height: 190mm; border: 3px solid #1e3a5f; padding: 24px 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative; }
  .cert::before { content: ''; position: absolute; inset: 6px; border: 1px solid #1e3a5f; }
  h1 { font-size: 18px; color: #1e3a5f; margin-bottom: 8px; letter-spacing: 3px; text-transform: uppercase; }
  .sub { font-size: 12px; color: #555; margin-bottom: 20px; }
  .nome { font-size: 28px; color: #1e3a5f; font-weight: bold; margin: 12px 0; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; }
  .tipo { font-size: 14px; color: #333; margin-bottom: 16px; }
  .desc { font-size: 13px; color: #333; line-height: 1.6; max-width: 500px; }
  .footer { position: absolute; bottom: 20px; font-size: 10px; color: #999; }
</style></head><body>
<div class="cert">
  <h1>Certificado de Participação</h1>
  <div class="sub">15º Circuito de Ciências das Escolas Públicas do DF — Etapa Regional ${ano}</div>
  <div class="sub" style="font-style:italic">${tema}</div>
  <p style="font-size:13px;color:#333">Certificamos que</p>
  <div class="nome">${nomeParticipante}</div>
  <div class="tipo">${tipoParticipante}</div>
  <div class="desc">
    participou da Etapa Regional do 15º CCEP-DF com o trabalho
    <strong>"${titulo}"</strong> (Categoria ${categoria}),
    pela escola <strong>${escola}</strong>.
  </div>
  <div class="footer">Documento gerado eletronicamente pelo sistema UNIEB Recanto.</div>
</div>
</body></html>`
}

module.exports = {
  feiraGerarLinks,
  feiraEnviar,
  feiraReenviar,
  feiraCalcularResultados,
  feiraOnAvaliacaoWrite,
  feiraRecalcularRecurso,
  feiraPublicarResultadoFinal,
  feiraGerarCertificados,
  feiraGerarRelatorioSEI,
}
