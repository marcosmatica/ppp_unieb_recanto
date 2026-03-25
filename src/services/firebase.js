// src/services/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import {
  getFirestore, collection, doc, getDoc, getDocs,
  setDoc, updateDoc, addDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp
} from 'firebase/firestore'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'


import { connectFirestoreEmulator } from 'firebase/firestore'
import { connectStorageEmulator } from 'firebase/storage'
import { connectFunctionsEmulator } from 'firebase/functions'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app       = initializeApp(firebaseConfig)
export const auth      = getAuth(app)
export const db        = getFirestore(app)
export const storage   = getStorage(app)
export const functions = getFunctions(app, 'southamerica-east1')
export const googleProvider = new GoogleAuthProvider()

// ─── Schools ────────────────────────────────────────────────────────────────

export const schoolsService = {
  async getByCRE(cre) {
    const q = query(
      collection(db, 'schools'),
      where('cre', '==', cre),
      orderBy('name')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getAll() {
    const snap = await getDocs(query(collection(db, 'schools'), orderBy('name')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async create(school) {
    const id = school.inep
    await setDoc(doc(db, 'schools', id), {
      ...school,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return id
  },
}

// ─── Analyses ───────────────────────────────────────────────────────────────

export const analysesService = {
  async getByAnalyst(analystId) {
    const q = query(
      collection(db, 'analyses'),
      where('analystId', '==', analystId),
      orderBy('updatedAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getByCRE(cre) {
    const q = query(
      collection(db, 'analyses'),
      where('cre', '==', cre),
      orderBy('updatedAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getById(analysisId) {
    const snap = await getDoc(doc(db, 'analyses', analysisId))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  },

  async create({ schoolId, schoolName, cre, analystId, year }) {
    const id = `${schoolId}_${year}`
    await setDoc(doc(db, 'analyses', id), {
      schoolId, schoolName, cre, analystId, year,
      status: 'pending',
      stats: { total: 0, critical: 0, attention: 0, adequate: 0, confirmed: 0, overridden: 0 },
      files: {},
      aiAnalysis: { ranAt: null, modelVersion: null, error: null },
      finalReport: { generatedAt: null, storagePath: null, analystNotes: '', decision: null },
      comparison: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return id
  },

  subscribe(analysisId, callback) {
    return onSnapshot(doc(db, 'analyses', analysisId), snap => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() })
    })
  },
}

// ─── Element Results ─────────────────────────────────────────────────────────

export const elementResultsService = {
  async getAll(analysisId) {
    const snap = await getDocs(
      collection(db, 'analyses', analysisId, 'elementResults')
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  subscribe(analysisId, callback) {
    return onSnapshot(
      collection(db, 'analyses', analysisId, 'elementResults'),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  },

  async submitReview({ analysisId, elementId, decision, comment }) {
    const fn = httpsCallable(functions, 'submitHumanReview')
    return fn({ analysisId, elementId, decision, comment })
  },
}

// ─── Upload PPP ──────────────────────────────────────────────────────────────

export const uploadService = {
  /**
   * Faz upload do arquivo PPP para o Cloud Storage.
   * Retorna uma Promise com progresso via onProgress(0–100).
   */
  uploadPPP({analysisId, file, year, onProgress}) {
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `analyses/${analysisId}/ppp${year}.${ext}`
    const storageRef = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)

    return new Promise((resolve, reject) => {
      task.on(
          'state_changed',
          snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => getDownloadURL(task.snapshot.ref).then(url => resolve({path, url}))
      )
    })
  },
}

if (import.meta.env.DEV) {
  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }
}