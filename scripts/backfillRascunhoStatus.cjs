// Sincroniza feira_rascunhos.status a partir do status de feira_inscricoes.
// Uso: node scripts/backfillRascunhoStatus.js

const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

async function main() {
  const inscSnap = await db.collection('feira_inscricoes').get()
  let atualizados = 0
  let ignorados = 0
  const detalhes = []

  for (const doc of inscSnap.docs) {
    const insc = doc.data()
    if (!insc.rascunho_id) { ignorados++; continue }
    const rascRef = db.collection('feira_rascunhos').doc(insc.rascunho_id)
    const rascSnap = await rascRef.get()
    if (!rascSnap.exists) { ignorados++; continue }
    const rascStatus = rascSnap.data().status
    if (rascStatus === insc.status) { ignorados++; continue }

    const trancado = insc.status === 'aprovada' || insc.status === 'indeferida'
    const patch = {
      status: insc.status,
      trancado,
      atualizado_em: admin.firestore.FieldValue.serverTimestamp(),
    }
    if (insc.status === 'devolvida') {
      patch.campos_liberados = rascSnap.data().campos_liberados || []
    }
    await rascRef.update(patch)
    atualizados++
    detalhes.push({ rascunhoId: insc.rascunho_id, de: rascStatus, para: insc.status, titulo: insc.titulo })
  }

  console.log(`\nTotal inscrições: ${inscSnap.size}`)
  console.log(`Atualizados: ${atualizados}`)
  console.log(`Ignorados: ${ignorados}`)
  if (detalhes.length) {
    console.log('\nDetalhes:')
    detalhes.forEach(d => console.log(`  ${d.rascunhoId}: ${d.de || '(sem status)'} → ${d.para}  [${d.titulo || ''}]`))
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
