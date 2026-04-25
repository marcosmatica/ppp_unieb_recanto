// src/services/parecerService.js

import {
    collection, doc, getDoc, getDocs, onSnapshot,
    query, orderBy, where, writeBatch,
    updateDoc, addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'

export const parecerService = {

  async getAnalysis(analysisId) {
    const snap = await getDoc(doc(db, 'analyses', analysisId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  subscribeAnalysis(analysisId, cb) {
    return onSnapshot(doc(db, 'analyses', analysisId), snap => {
      if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    })
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

  async updateObservation(analysisId, obsId, data, userId) {
    await updateDoc(
      doc(db, 'analyses', analysisId, 'observations', obsId),
      { ...data, updatedAt: serverTimestamp(), updatedBy: userId || null }
    )
  },

  async acceptObservation(analysisId, obsId, userId) {
    return this.updateObservation(analysisId, obsId, { status: 'confirmed' }, userId)
  },

  async rejectObservation(analysisId, obsId, userId) {
    return this.updateObservation(analysisId, obsId, { status: 'rejected' }, userId)
  },

  async restoreObservation(analysisId, obsId, userId) {
    return this.updateObservation(analysisId, obsId, { status: 'auto' }, userId)
  },

  async deleteObservation(analysisId, obsId) {
    await deleteDoc(doc(db, 'analyses', analysisId, 'observations', obsId))
  },

  async createObservation(analysisId, data, userId) {
    const ref = await addDoc(
      collection(db, 'analyses', analysisId, 'observations'),
      {
        tipo:             data.tipo || 'observacao',
        severidade:       data.severidade ?? 1,
        texto:            data.texto || '',
        label:            data.label || 'Observação manual',
        blockCode:        data.blockCode || null,
        blockLabel:       data.blockLabel || null,
        anchorId:         data.anchorId || null,
        trechoReferencia: data.trechoReferencia || null,
        section:          data.section || null,
        normRef:          data.normRef || null,
        missingItems:     data.missingItems || [],
        missingRefs:      data.missingRefs || [],
        isCritical:       false,
        isNewIn2026:      false,
        status:           'manual',
        createdAt:        serverTimestamp(),
        updatedAt:        serverTimestamp(),
        createdBy:        userId || null,
      }
    )
    return ref.id
  },

  async build(analysisId, force = false) {
    const fn = httpsCallable(functions, 'buildParecer')
    const { data } = await fn({ analysisId, force })
    return data
  },

    async bulkAcceptObservacoes(analysisId, tipo, userId) {
        const q = query(
            collection(db, 'analyses', analysisId, 'observations'),
            where('tipo', '==', tipo),
            where('status', '==', 'auto')
        )
        const snap = await getDocs(q)
        if (!snap.size) return 0
        const batch = writeBatch(db)
        snap.docs.forEach(d => batch.update(d.ref, {
            status: 'confirmed',
            updatedAt: serverTimestamp(),
            updatedBy: userId || null,
        }))
        await batch.commit()
        return snap.size
    },

  async finalizar(analysisId, reopen = false) {
    const fn = httpsCallable(functions, 'finalizarParecer')
    const { data } = await fn({ analysisId, reopen })
    return data
  },

  async exportPdf(analysisId) {
    const fn = httpsCallable(functions, 'exportParecerPdf')
    const { data } = await fn({ analysisId })
    return data
  },
}
