// src/services/planosService.js

import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// /schoolVisits/{visitId}/actionPlans/{planId}
// status: 'pending' | 'in_progress' | 'done'

export const planosService = {
  async criar({ visitId, schoolId, schoolName, cre, indicatorCode, indicatorLabel,
                metaCode, descriptorLevel, goal, deadline, responsibleSchool,
                responsibleCI, ciId, observation }) {
    const ref = await addDoc(
      collection(db, 'schoolVisits', visitId, 'actionPlans'),
      {
        visitId, schoolId, schoolName, cre,
        indicatorCode, indicatorLabel, metaCode,
        descriptorLevel,
        goal, deadline, responsibleSchool, responsibleCI,
        ciId, observation,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    return ref.id
  },

  async listarPorVisita(visitId) {
    const q = query(
      collection(db, 'schoolVisits', visitId, 'actionPlans'),
      orderBy('createdAt', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async listarPorEscola(schoolId) {
    const q = query(
      collection(db, 'schoolVisits'),
      where('schoolId', '==', schoolId)
    )
    const visitSnap = await getDocs(q)
    const plans = await Promise.all(
      visitSnap.docs.map(v =>
        getDocs(collection(db, 'schoolVisits', v.id, 'actionPlans'))
          .then(s => s.docs.map(d => ({ id: d.id, visitId: v.id, ...d.data() })))
      )
    )
    return plans.flat().sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds)
  },

  async atualizarStatus(visitId, planId, status) {
    await updateDoc(
      doc(db, 'schoolVisits', visitId, 'actionPlans', planId),
      { status, updatedAt: serverTimestamp() }
    )
  },

  async atualizar(visitId, planId, data) {
    await updateDoc(
      doc(db, 'schoolVisits', visitId, 'actionPlans', planId),
      { ...data, updatedAt: serverTimestamp() }
    )
  },
}
