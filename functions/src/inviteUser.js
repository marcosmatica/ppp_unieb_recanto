// functions/src/inviteUser.js
const { onCall, HttpsError } = require("firebase-functions/v2/https")
const { getFirestore, FieldValue } = require("firebase-admin/firestore")
const nodemailer = require("nodemailer")

const db = getFirestore()

const VALID_ROLES = ["admin", "supervisor", "analyst"]

function buildTransporter() {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (!smtpUser || !smtpPass) return null
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com"
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10)
  return {
    transporter: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    }),
    from: smtpUser,
  }
}

// ─── inviteUser (admin) ─────────────────────────────────────────────────────
// Cria pending_invites/{email} e envia email com o link de acesso.
const inviteUser = onCall(
  { region: "southamerica-east1", secrets: ["SMTP_USER", "SMTP_PASS"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const callerSnap = await db.collection("users").doc(request.auth.uid).get()
    if (!callerSnap.exists || callerSnap.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin pode convidar usuários")
    }

    const { name, email, role, cre } = request.data || {}
    const emailNorm = (email || "").trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!name || !emailNorm) throw new HttpsError("invalid-argument", "Nome e email são obrigatórios")
    if (!emailRegex.test(emailNorm)) throw new HttpsError("invalid-argument", "Email inválido")
    if (!VALID_ROLES.includes(role)) throw new HttpsError("invalid-argument", "Função inválida")
    if (!cre) throw new HttpsError("invalid-argument", "CRE obrigatória")

    // já é usuário?
    const existing = await db.collection("users").where("email", "==", emailNorm).limit(1).get()
    if (!existing.empty) {
      throw new HttpsError("already-exists", "Este email já é um usuário do sistema")
    }

    const inviteRef = db.collection("pending_invites").doc(emailNorm)
    await inviteRef.set({
      email: emailNorm,
      name: name.trim(),
      role,
      cre,
      invitedBy: request.auth.uid,
      invitedByName: callerSnap.data().name || null,
      createdAt: FieldValue.serverTimestamp(),
      status: "pending",
    })

    const baseUrl = process.env.APP_BASE_URL || "https://unieb-recanto.web.app"
    const loginUrl = `${baseUrl}/login`

    const mail = buildTransporter()
    if (!mail) {
      console.warn("SMTP não configurado — convite salvo, email não enviado")
      return { ok: true, emailSent: false, message: "Convite salvo (SMTP não configurado)" }
    }

    await mail.transporter.sendMail({
      from: `"UNIEB Recanto" <${mail.from}>`,
      to: emailNorm,
      subject: "Você foi convidado(a) para o UNIEB Recanto",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e3a5f;margin-bottom:8px;">UNIEB · Recanto das Emas</h2>
          <p>Olá, <strong>${name}</strong>!</p>
          <p>Você foi convidado(a) por <strong>${callerSnap.data().name || "um administrador"}</strong> para acessar o sistema de análise de PPP como <strong>${role}</strong> — CRE <strong>${cre}</strong>.</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
              Acessar o Sistema
            </a>
          </div>
          <p style="font-size:13px;color:#6b7280;">
            Faça login com sua conta Google usando este endereço: <strong>${emailNorm}</strong><br>
            Ou copie e cole este link no navegador:<br>
            <a href="${loginUrl}" style="color:#2563eb;">${loginUrl}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:11px;color:#9ca3af;">Se você não esperava este convite, ignore este email.</p>
        </div>
      `,
    })

    await inviteRef.update({ emailSentAt: FieldValue.serverTimestamp() })

    return { ok: true, emailSent: true }
  }
)

// ─── claimInvite ───────────────────────────────────────────────────────────
// Chamada pelo cliente na primeira autenticação: se o usuário logado tem invite,
// cria o doc users/{uid} e apaga o invite.
const claimInvite = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")

    const uid = request.auth.uid
    const email = (request.auth.token.email || "").toLowerCase()
    if (!email) throw new HttpsError("failed-precondition", "Sem email no token")

    const userRef = db.collection("users").doc(uid)
    const userSnap = await userRef.get()
    if (userSnap.exists) return { ok: true, alreadyUser: true }

    const inviteRef = db.collection("pending_invites").doc(email)
    const inviteSnap = await inviteRef.get()
    if (!inviteSnap.exists) throw new HttpsError("not-found", "Nenhum convite encontrado")

    const invite = inviteSnap.data()
    await userRef.set({
      email,
      name: invite.name || request.auth.token.name || email,
      role: invite.role,
      cre: invite.cre,
      createdAt: FieldValue.serverTimestamp(),
      invitedBy: invite.invitedBy || null,
    })
    await inviteRef.delete()

    return { ok: true, alreadyUser: false }
  }
)

// ─── revokeInvite ──────────────────────────────────────────────────────────
const revokeInvite = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Não autenticado")
    const callerSnap = await db.collection("users").doc(request.auth.uid).get()
    if (!callerSnap.exists || callerSnap.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Apenas admin pode revogar convites")
    }
    const { email } = request.data || {}
    const emailNorm = (email || "").trim().toLowerCase()
    if (!emailNorm) throw new HttpsError("invalid-argument", "Email obrigatório")
    await db.collection("pending_invites").doc(emailNorm).delete()
    return { ok: true }
  }
)

module.exports = { inviteUser, claimInvite, revokeInvite }
