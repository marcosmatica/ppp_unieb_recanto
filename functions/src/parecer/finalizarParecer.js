// functions/src/parecer/finalizarParecer.js

'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const db = getFirestore()

exports.finalizarParecer = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.')

    const { analysisId, reopen = false } = request.data
    if (!analysisId) throw new HttpsError('invalid-argument', 'analysisId obrigatório.')

    const userSnap = await db.collection('users').doc(uid).get()
    const role = userSnap.exists ? userSnap.data().role : null
    if (!['supervisor', 'admin'].includes(role)) {
      const analysisSnap = await db.collection('analyses').doc(analysisId).get()
      if (analysisSnap.data()?.analystId !== uid) {
        throw new HttpsError('permission-denied', 'Sem permissão.')
      }
    }

    const status = reopen ? 'draft' : 'finalizado'

    await db.collection('analyses').doc(analysisId).update({
      'parecer.status':      status,
      'parecer.finalizedAt': reopen ? null : Timestamp.now(),
      'parecer.finalizedBy': reopen ? null : uid,
      updatedAt: Timestamp.now(),
    })

    await db.collection('audit_log').add({
      action:   reopen ? 'parecer_reopened' : 'parecer_finalized',
      analysisId,
      userId:   uid,
      createdAt: Timestamp.now(),
    })

    return { ok: true, status }
  }
)
