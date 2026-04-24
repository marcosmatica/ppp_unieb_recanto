// src/services/parecerService.js

import {
  collection, doc, getDoc, getDocs, onSnapshot,
  query, orderBy, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'

export const parecerService = {

  async getAnalysis(analysisId) {
    const snap = await getDoc(doc(db, 'analyses', analysisId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  async listObservations(analysisId) {
    const q = query(
      collection(db, 'analyses', analysisId, 'observations'),
      orderBy('createdAt', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  subscribeObservations(analysisId, cb) {
    const q = query(
      collection(db, 'analyses', analysisId, 'observations'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  },

  async updateObservation(analysisId, obsId, data) {
    await updateDoc(
      doc(db, 'analyses', analysisId, 'observations', obsId),
      { ...data, updatedAt: serverTimestamp() }
    )
  },

  async build(analysisId, force = false) {
    const fn = httpsCallable(functions, 'buildParecer')
    const { data } = await fn({ analysisId, force })
    return data
  },
}
