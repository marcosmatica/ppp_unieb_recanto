// src/services/visitasService.js

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// ─── Visitas ─────────────────────────────────────────────────────────────────
// Uma visita agrupa N sessões de verificação de metas para uma UE.
// status: 'open' | 'closed'

export const visitasService = {
  async criar({ schoolId, schoolName, cre, ciId, ciName }) {
    const ref = await addDoc(collection(db, 'schoolVisits'), {
      schoolId,
      schoolName,
      cre,
      ciId,
      ciName,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  async listarPorCI(ciId) {
    const q = query(
      collection(db, 'schoolVisits'),
      where('ciId', '==', ciId),
      orderBy('updatedAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async listarPorEscola(schoolId) {
    const q = query(
      collection(db, 'schoolVisits'),
      where('schoolId', '==', schoolId),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async buscar(visitId) {
    const snap = await getDoc(doc(db, 'schoolVisits', visitId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  async encerrar(visitId) {
    await updateDoc(doc(db, 'schoolVisits', visitId), {
      status: 'closed',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },
}

// ─── Sessões ──────────────────────────────────────────────────────────────────
// Uma sessão = visita presencial com data específica + conjunto de metas verificadas.
// Cada sessão tem suas próprias respostas por indicador.
// status: 'draft' | 'submitted'

export const sessoesService = {
  async criar({ visitId, metasCodes, date }) {
    const ref = await addDoc(
      collection(db, 'schoolVisits', visitId, 'sessions'),
      {
        metasCodes,
        date: Timestamp.fromDate(new Date(date)),
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    return ref.id
  },

  async listar(visitId) {
    const q = query(
      collection(db, 'schoolVisits', visitId, 'sessions'),
      orderBy('date', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async submeter(visitId, sessionId) {
    await updateDoc(
      doc(db, 'schoolVisits', visitId, 'sessions', sessionId),
      { status: 'submitted', submittedAt: serverTimestamp(), updatedAt: serverTimestamp() }
    )
  },
}

// ─── Respostas por indicador ──────────────────────────────────────────────────
// /schoolVisits/{visitId}/sessions/{sessionId}/responses/{indicatorCode}

export const responsesService = {
  async salvar(visitId, sessionId, indicatorCode, data) {
    const ref = doc(
      db,
      'schoolVisits', visitId,
      'sessions', sessionId,
      'responses', indicatorCode
    )
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      const { setDoc } = await import('firebase/firestore')
      await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    })
  },

  async listar(visitId, sessionId) {
    const snap = await getDocs(
      collection(db, 'schoolVisits', visitId, 'sessions', sessionId, 'responses')
    )
    return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))
  },
}
