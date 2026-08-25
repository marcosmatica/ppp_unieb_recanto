// functions/src/feira.js

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https")
const { onDocumentWritten } = require("firebase-functions/v2/firestore")
const { getFirestore, FieldValue } = require("firebase-admin/firestore")
const crypto = require("crypto")
const nodemailer = require("nodemailer")

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
    const { rascunhoId, payload } = request.data
    if (!rascunhoId || !payload) throw new HttpsError("invalid-argument", "Dados incompletos")

    const edicaoSnap = await db.collection("feira_edicoes").doc(payload.edicao_id).get()
    if (!edicaoSnap.exists) throw new HttpsError("not-found", "Edição não encontrada")
    const edicao = edicaoSnap.data()
    if (!edicao.ativo || !edicao.inscricoes_abertas) {
      throw new HttpsError("failed-precondition", "Inscrições não estão abertas")
    }
    if (edicao.data_encerramento) {
      const hoje = new Date().toISOString().slice(0, 10)
      if (hoje > edicao.data_encerramento) {
        throw new HttpsError("failed-precondition", "Prazo de envio encerrado")
      }
    }
    if (edicao.data_inicio) {
      const hoje = new Date().toISOString().slice(0, 10)
      if (hoje < edicao.data_inicio) {
        throw new HttpsError("failed-precondition", "Inscrições ainda não iniciaram")
      }
    }
    if (edicao.max_projetos_por_escola && payload.link_escola_token) {
      const linkSnap = await db.collection("feira_links_escolas").doc(payload.link_escola_token).get()
      if (linkSnap.exists) {
        const atual = linkSnap.data().projetos_count || 0
        const limite = linkSnap.data().max_projetos ?? edicao.max_projetos_por_escola
        if (atual >= limite) {
          throw new HttpsError("failed-precondition", `Limite de ${limite} projeto(s) por escola atingido`)
        }
      }
    }

    // Normaliza orientadores: aceita `orientadores[]` (novo) ou `orientador`/`orientador2` (legado)
    const orientadoresIn = Array.isArray(payload.orientadores) && payload.orientadores.length
      ? payload.orientadores
      : [payload.orientador, payload.orientador2].filter(o => o && o.nome)
    if (!payload.titulo || !payload.categoria || !orientadoresIn[0]?.nome) {
      throw new HttpsError("invalid-argument", "Campos obrigatórios não preenchidos")
    }
    if (!payload.documentos?.projeto_pesquisa?.url) {
      throw new HttpsError("invalid-argument", "Projeto de Pesquisa obrigatório")
    }
    const estMin = edicao?.limites?.estudantes_min ?? 2
    if (!payload.estudantes?.length || payload.estudantes.length < estMin) {
      throw new HttpsError("invalid-argument", `Mínimo de ${estMin} estudante(s)`)
    }
    // Termos por estudante (novo formato); tolera formato legado (termo_autorizacao único)
    const termosArr = payload.documentos?.termos_autorizacao || []
    const temTermoPorEstudante = payload.estudantes.every((_, i) => !!termosArr[i]?.url)
    if (!temTermoPorEstudante && !payload.documentos?.termo_autorizacao?.url) {
      throw new HttpsError("invalid-argument", "Termo de autorização de imagem obrigatório para cada estudante")
    }
    const orientadoresMatriculas = orientadoresIn
      .map(o => String(o.matricula_sedf || "").trim())
      .filter(Boolean)

    // Limites de orientadores por projeto
    const orientMin = edicao?.limites?.orientadores_min ?? 1
    const orientMax = edicao?.limites?.orientadores_max ?? 2
    if (orientadoresIn.length < orientMin || orientadoresIn.length > orientMax) {
      throw new HttpsError("invalid-argument", `Projeto deve ter entre ${orientMin} e ${orientMax} orientador(es)`)
    }
    // Limite máximo de estudantes
    const estMax = edicao?.limites?.estudantes_max ?? 5
    if (payload.estudantes.length > estMax) {
      throw new HttpsError("invalid-argument", `Máximo de ${estMax} estudante(s)`)
    }
    // Limite de projetos por orientador (matrícula SEDF)
    const projMax = edicao?.limites?.projetos_por_orientador_max
    if (projMax != null && orientadoresMatriculas.length) {
      for (const mat of orientadoresMatriculas) {
        const [snapI, snapR] = await Promise.all([
          db.collection("feira_inscricoes")
            .where("edicao_id", "==", payload.edicao_id)
            .where("orientadores_matriculas", "array-contains", mat).get(),
          db.collection("feira_rascunhos")
            .where("edicao_id", "==", payload.edicao_id)
            .where("orientadores_matriculas", "array-contains", mat).get(),
        ])
        const ids = new Set()
        snapI.docs.forEach(d => ids.add(`i/${d.id}`))
        snapR.docs.forEach(d => { if (d.id !== rascunhoId) ids.add(`r/${d.id}`) })
        if (ids.size >= projMax) {
          throw new HttpsError("failed-precondition",
            `Orientador com matrícula ${mat} já atingiu o limite de ${projMax} projeto(s) nesta edição`)
        }
      }
    }

    const inscricaoRef = db.collection("feira_inscricoes").doc()
    await inscricaoRef.set({
      rascunho_id: rascunhoId,
      edicao_id: payload.edicao_id,
      link_escola_token: payload.link_escola_token,
      status: "enviada",
      escola: payload.escola,
      orientadores: orientadoresIn,
      orientadores_matriculas: orientadoresMatriculas,
      orientador: orientadoresIn[0] || null,
      orientador2: orientadoresIn[1] || null,
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

    const edicaoRSnap = await db.collection("feira_edicoes").doc(insc.edicao_id).get()
    if (edicaoRSnap.exists && edicaoRSnap.data().permitir_reenvio === false) {
      throw new HttpsError("failed-precondition", "Reenvio de projetos está desabilitado")
    }

    const orientadoresRe = Array.isArray(payload.orientadores) && payload.orientadores.length
      ? payload.orientadores
      : [payload.orientador, payload.orientador2].filter(o => o && o.nome)
    const orientadoresMatriculasRe = orientadoresRe
      .map(o => String(o.matricula_sedf || "").trim())
      .filter(Boolean)

    // Aplica limites configurados na edição também no reenvio
    const edicaoR = edicaoRSnap.exists ? edicaoRSnap.data() : {}
    const orientMinR = edicaoR?.limites?.orientadores_min ?? 1
    const orientMaxR = edicaoR?.limites?.orientadores_max ?? 2
    if (orientadoresRe.length < orientMinR || orientadoresRe.length > orientMaxR) {
      throw new HttpsError("invalid-argument", `Projeto deve ter entre ${orientMinR} e ${orientMaxR} orientador(es)`)
    }
    const estMinR = edicaoR?.limites?.estudantes_min ?? 2
    const estMaxR = edicaoR?.limites?.estudantes_max ?? 5
    if (!payload.estudantes?.length || payload.estudantes.length < estMinR || payload.estudantes.length > estMaxR) {
      throw new HttpsError("invalid-argument", `Quantidade de estudantes deve ficar entre ${estMinR} e ${estMaxR}`)
    }
    const projMaxR = edicaoR?.limites?.projetos_por_orientador_max
    if (projMaxR != null && orientadoresMatriculasRe.length) {
      for (const mat of orientadoresMatriculasRe) {
        const [snapI, snapRasc] = await Promise.all([
          db.collection("feira_inscricoes")
            .where("edicao_id", "==", insc.edicao_id)
            .where("orientadores_matriculas", "array-contains", mat).get(),
          db.collection("feira_rascunhos")
            .where("edicao_id", "==", insc.edicao_id)
            .where("orientadores_matriculas", "array-contains", mat).get(),
        ])
        const ids = new Set()
        // Não conta a própria inscrição em reenvio
        snapI.docs.forEach(d => { if (d.id !== inscDoc.id) ids.add(`i/${d.id}`) })
        snapRasc.docs.forEach(d => { if (d.id !== rascunhoId) ids.add(`r/${d.id}`) })
        if (ids.size >= projMaxR) {
          throw new HttpsError("failed-precondition",
            `Orientador com matrícula ${mat} já atingiu o limite de ${projMaxR} projeto(s) nesta edição`)
        }
      }
    }

    const novoEnvio = (insc.envio_num || 1) + 1
    await inscDoc.ref.update({
      status: "reenviada",
      escola: payload.escola,
      orientadores: orientadoresRe,
      orientadores_matriculas: orientadoresMatriculasRe,
      orientador: orientadoresRe[0] || null,
      orientador2: orientadoresRe[1] || null,
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

// ─── feiraBackfillRascunhoStatus ─────────────────────────────────────────────
// Sincroniza feira_rascunhos.status a partir do status atual em feira_inscricoes.

const feiraBackfillRascunhoStatus = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")
    const userDoc = await db.collection("users").doc(request.auth.uid).get()
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin")
    }

    const inscSnap = await db.collection("feira_inscricoes").get()
    let atualizados = 0
    let ignorados = 0
    const detalhes = []

    for (const doc of inscSnap.docs) {
      const insc = doc.data()
      if (!insc.rascunho_id) { ignorados++; continue }
      const rascRef = db.collection("feira_rascunhos").doc(insc.rascunho_id)
      const rascSnap = await rascRef.get()
      if (!rascSnap.exists) { ignorados++; continue }
      const rascStatus = rascSnap.data().status
      if (rascStatus === insc.status) { ignorados++; continue }

      const trancado = insc.status === "aprovada" || insc.status === "indeferida"
      const patch = {
        status: insc.status,
        trancado,
        atualizado_em: FieldValue.serverTimestamp(),
      }
      if (insc.status === "devolvida") {
        patch.campos_liberados = rascSnap.data().campos_liberados || []
      }
      await rascRef.update(patch)
      atualizados++
      detalhes.push({ rascunhoId: insc.rascunho_id, de: rascStatus, para: insc.status })
    }

    return { ok: true, atualizados, ignorados, total: inscSnap.size, detalhes }
  }
)

// ─── feiraOnInscricaoStatusChange ────────────────────────────────────────────
// Envia email para a escola quando avaliador aprovar / devolver / indeferir

const STATUS_EMAIL_LABELS = {
  aprovada:   { titulo: "Inscrição aprovada",  cor: "#16a34a" },
  devolvida:  { titulo: "Inscrição devolvida para correções", cor: "#ea580c" },
  indeferida: { titulo: "Inscrição indeferida", cor: "#dc2626" },
}

const feiraOnInscricaoStatusChange = onDocumentWritten(
  { document: "feira_inscricoes/{inscId}", region: "southamerica-east1", secrets: ["SMTP_USER", "SMTP_PASS"] },
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()
    if (!after) return
    const statusAntigo = before?.status
    const statusNovo = after.status
    if (statusAntigo === statusNovo) return
    if (!STATUS_EMAIL_LABELS[statusNovo]) return

    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    if (!smtpUser || !smtpPass) {
      console.warn("SMTP não configurado — email de análise não enviado")
      return
    }

    const destinatarios = new Set()
    if (after.orientador?.email) destinatarios.add(after.orientador.email)
    if (after.orientador2?.email) destinatarios.add(after.orientador2.email)
    if (after.link_escola_token) {
      const linkSnap = await db.collection("feira_links_escolas").doc(after.link_escola_token).get()
      if (linkSnap.exists && linkSnap.data().ultimo_email_enviado) {
        destinatarios.add(linkSnap.data().ultimo_email_enviado)
      }
    }
    if (destinatarios.size === 0) return

    const info = STATUS_EMAIL_LABELS[statusNovo]
    const baseUrl = process.env.APP_BASE_URL || "https://unieb-recanto.web.app"
    const link = after.link_escola_token && after.rascunho_id
      ? `${baseUrl}/inscricao/${after.link_escola_token}/projeto/${after.rascunho_id}/status`
      : baseUrl

    let msgDevolucao = ""
    if (statusNovo === "devolvida") {
      const hist = after.devolucoes_hist || []
      const ultima = hist[hist.length - 1]
      if (ultima?.mensagem) {
        msgDevolucao = `
          <div style="margin:16px 0;padding:12px 16px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:6px;">
            <strong style="color:#c2410c;">Mensagem da comissão:</strong>
            <div style="margin-top:6px;white-space:pre-wrap;">${String(ultima.mensagem).replace(/</g, "&lt;")}</div>
          </div>`
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: (parseInt(process.env.SMTP_PORT || "587", 10)) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })

    try {
      await transporter.sendMail({
        from: `"CCEP-DF Etapa Regional" <${smtpUser}>`,
        to: Array.from(destinatarios).join(", "),
        subject: `${info.titulo} — ${after.titulo || "Projeto"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:${info.cor};margin-bottom:8px;">${info.titulo}</h2>
            <p>Olá!</p>
            <p>O projeto <strong>${after.titulo || ""}</strong> da escola <strong>${after.escola?.nome || ""}</strong> teve sua análise atualizada.</p>
            ${msgDevolucao}
            <div style="margin:24px 0;text-align:center;">
              <a href="${link}" style="display:inline-block;padding:12px 28px;background:${info.cor};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
                ${statusNovo === "devolvida" ? "Corrigir e reenviar" : "Ver detalhes"}
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="font-size:11px;color:#9ca3af;">Email automático do sistema UNIEB Recanto.</p>
          </div>
        `,
      })
    } catch (e) {
      console.error("Falha ao enviar email de análise:", e)
    }
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

// ─── feiraLookupEscola (público, sem auth) ─────────────────────────────────
// Busca escola pelo código INEP e retorna info básica + se tem link ativo

const feiraLookupEscola = onRequest(
  { region: "southamerica-east1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

    const { inep } = req.body
    if (!inep || typeof inep !== "string" || inep.trim().length < 4) {
      return res.status(400).json({ error: "Código INEP inválido" })
    }

    const inepClean = inep.trim()

    const linkSnap = await db.collection("feira_links_escolas")
      .where("escola_inep", "==", inepClean)
      .limit(1)
      .get()

    if (linkSnap.empty) {
      return res.status(404).json({ error: "Nenhum link encontrado para este código INEP. Verifique o código e tente novamente." })
    }

    const linkDoc = linkSnap.docs[0]
    const link = linkDoc.data()

    const edicaoSnap = await db.collection("feira_edicoes").doc(link.edicao_id).get()
    const edicao = edicaoSnap.exists ? edicaoSnap.data() : null

    res.json({
      ok: true,
      escola_nome: link.escola_nome,
      escola_inep: link.escola_inep,
      escola_cre: link.escola_cre,
      edicao_ano: edicao?.ano || null,
      edicao_tema: edicao?.tema || null,
      inscricoes_abertas: edicao?.inscricoes_abertas || false,
    })
  }
)

// ─── feiraEnviarLinkEmail (público, sem auth) ───────────────────────────────
// Envia o link individual da escola por email

const feiraEnviarLinkEmail = onRequest(
  { region: "southamerica-east1", cors: true, secrets: ["SMTP_USER", "SMTP_PASS"] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

    const { inep, email } = req.body
    if (!inep || !email) return res.status(400).json({ error: "INEP e email são obrigatórios" })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return res.status(400).json({ error: "Email inválido" })

    const linkSnap = await db.collection("feira_links_escolas")
      .where("escola_inep", "==", inep.trim())
      .limit(1)
      .get()

    if (linkSnap.empty) {
      return res.status(404).json({ error: "Nenhum link encontrado para este INEP" })
    }

    const linkDoc = linkSnap.docs[0]
    const link = linkDoc.data()
    const token = linkDoc.id

    const baseUrl = process.env.APP_BASE_URL || "https://unieb-recanto.web.app"
    const portalUrl = `${baseUrl}/inscricao/${token}`

    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com"
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10)

    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ error: "Serviço de email não configurado" })
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: `"CCEP-DF Etapa Regional" <${smtpUser}>`,
      to: email,
      subject: `Link de Inscrição — ${link.escola_nome} — CCEP-DF`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e3a5f;margin-bottom:8px;">CCEP-DF · Etapa Regional</h2>
          <p>Olá!</p>
          <p>Segue o link de inscrição para a <strong>${link.escola_nome}</strong> (INEP ${link.escola_inep}):</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
              Acessar Portal da Escola
            </a>
          </div>
          <p style="font-size:13px;color:#6b7280;">Ou copie e cole este link no navegador:<br>
          <a href="${portalUrl}" style="color:#2563eb;">${portalUrl}</a></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:11px;color:#9ca3af;">Este email foi enviado pelo sistema UNIEB Recanto. Caso não tenha solicitado, ignore esta mensagem.</p>
        </div>
      `,
    })

    await db.collection("feira_links_escolas").doc(token).update({
      ultimo_email_enviado: email,
      ultimo_email_em: FieldValue.serverTimestamp(),
    })

    res.json({ ok: true, message: "Link enviado com sucesso!" })
  }
)

module.exports = {
  feiraGerarLinks,
  feiraEnviar,
  feiraReenviar,
  feiraCalcularResultados,
  feiraOnAvaliacaoWrite,
  feiraOnInscricaoStatusChange,
  feiraBackfillRascunhoStatus,
  feiraRecalcularRecurso,
  feiraPublicarResultadoFinal,
  feiraGerarCertificados,
  feiraGerarRelatorioSEI,
  feiraLookupEscola,
  feiraEnviarLinkEmail,
}
