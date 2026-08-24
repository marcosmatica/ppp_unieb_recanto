// src/services/feiraService.js

import { db, functions } from './firebase'
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, arrayUnion,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

const col = (name) => collection(db, name)

// ─── Edições ────────────────────────────────────────────────────────────────

export const feiraEdicoesService = {
  async getAtiva() {
    const q = query(col('feira_edicoes'), where('ativo', '==', true))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  },

  async getById(id) {
    const snap = await getDoc(doc(db, 'feira_edicoes', id))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  },

  async criar(dados) {
    const ref = await addDoc(col('feira_edicoes'), {
      ...dados,
      ativo: true,
      inscricoes_abertas: false,
      resultado_preliminar_publicado: false,
      resultado_final_publicado: false,
      criado_em: serverTimestamp(),
    })
    return ref.id
  },

  async atualizar(id, dados) {
    await updateDoc(doc(db, 'feira_edicoes', id), {
      ...dados,
      atualizado_em: serverTimestamp(),
    })
  },
}

// ─── Links de Escolas ────────────────────────────────────────────────────────

export const feiraLinksService = {
  async getByToken(token) {
    const snap = await getDoc(doc(db, 'feira_links_escolas', token))
    if (!snap.exists()) return null
    return { token: snap.id, ...snap.data() }
  },

  async listarPorEdicao(edicaoId) {
    const q = query(
      col('feira_links_escolas'),
      where('edicao_id', '==', edicaoId),
      orderBy('escola_nome')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ token: d.id, ...d.data() }))
  },

  async gerarLinks(edicaoId) {
    const fn = httpsCallable(functions, 'feiraGerarLinks')
    return fn({ edicaoId })
  },
}

// ─── Inscrições ──────────────────────────────────────────────────────────────

export const feiraInscricoesService = {
  async listarPorEdicao(edicaoId) {
    const q = query(
      col('feira_inscricoes'),
      where('edicao_id', '==', edicaoId),
      orderBy('criado_em', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getById(id) {
    const snap = await getDoc(doc(db, 'feira_inscricoes', id))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  },

  async atualizar(id, dados) {
    await updateDoc(doc(db, 'feira_inscricoes', id), {
      ...dados,
      atualizado_em: serverTimestamp(),
    })
  },

  subscribe(id, callback) {
    return onSnapshot(doc(db, 'feira_inscricoes', id), snap => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() })
    })
  },
}

// ─── Rascunhos ───────────────────────────────────────────────────────────────

export const feiraRascunhosService = {
  async listarPorEscola(token) {
    const q = query(
      col('feira_rascunhos'),
      where('link_escola_token', '==', token),
      orderBy('criado_em', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getById(id) {
    const snap = await getDoc(doc(db, 'feira_rascunhos', id))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  },

  async criar(dados) {
    const ref = await addDoc(col('feira_rascunhos'), {
      ...dados,
      status: 'rascunho',
      trancado: false,
      campos_liberados: [],
      ultima_secao_editada: 'orientador',
      criado_em: serverTimestamp(),
      atualizado_em: serverTimestamp(),
    })
    return ref.id
  },

  async salvar(id, dados) {
    await updateDoc(doc(db, 'feira_rascunhos', id), {
      ...dados,
      atualizado_em: serverTimestamp(),
    })
  },
}

// ─── Cloud Functions públicas ────────────────────────────────────────────────

export const feiraPublicaService = {
  async enviar(rascunhoId, payload) {
    const fn = httpsCallable(functions, 'feiraEnviar')
    return fn({ rascunhoId, payload })
  },

  async reenviar(rascunhoId, payload) {
    const fn = httpsCallable(functions, 'feiraReenviar')
    return fn({ rascunhoId, payload })
  },

  async calcularResultados(edicaoId, categoria) {
    const fn = httpsCallable(functions, 'feiraCalcularResultados')
    return fn({ edicaoId, categoria })
  },

  async recalcularRecurso(recursoId, notasRevisadas) {
    const fn = httpsCallable(functions, 'feiraRecalcularRecurso')
    return fn({ recursoId, notasRevisadas })
  },

  async publicarResultadoFinal(edicaoId) {
    const fn = httpsCallable(functions, 'feiraPublicarResultadoFinal')
    return fn({ edicaoId })
  },

  async gerarCertificados(edicaoId) {
    const fn = httpsCallable(functions, 'feiraGerarCertificados', { timeout: 540000 })
    return fn({ edicaoId })
  },

  async gerarRelatorioSEI(edicaoId, categoria) {
    const fn = httpsCallable(functions, 'feiraGerarRelatorioSEI', { timeout: 300000 })
    return fn({ edicaoId, categoria: categoria || null })
  },
}

// ─── Avaliações ──────────────────────────────────────────────────────────────

export const feiraAvaliacoesService = {
  async listarPorInscricao(inscricaoId) {
    const q = query(
      col('feira_avaliacoes'),
      where('inscricao_id', '==', inscricaoId)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getById(id) {
    const snap = await getDoc(doc(db, 'feira_avaliacoes', id))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  },

  async salvar(id, dados) {
    await setDoc(doc(db, 'feira_avaliacoes', id), {
      ...dados,
      atualizado_em: serverTimestamp(),
    }, { merge: true })
  },
}

// ─── Avaliadores (usuários com flag avaliador_feira) ─────────────────────────

export const feiraAvaliadorService = {
  async listarAvaliadores() {
    const q = query(
      collection(db, 'users'),
      where('avaliador_feira', '==', true)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
  },

  async designarAvaliadores(inscricaoId, avaliadorUids) {
    await updateDoc(doc(db, 'feira_inscricoes', inscricaoId), {
      avaliadores: avaliadorUids,
      avaliacoes_concluidas: 0,
      atualizado_em: serverTimestamp(),
    })
  },
}

// ─── Recursos ────────────────────────────────────────────────────────────────

export const feiraRecursosService = {
  async listarPorEdicao(edicaoId) {
    const q = query(
      col('feira_recursos'),
      where('edicao_id', '==', edicaoId),
      orderBy('criado_em', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async criar(dados) {
    const ref = await addDoc(col('feira_recursos'), {
      ...dados,
      status: 'pendente',
      criado_em: serverTimestamp(),
    })
    return ref.id
  },

  async atualizar(id, dados) {
    await updateDoc(doc(db, 'feira_recursos', id), {
      ...dados,
      atualizado_em: serverTimestamp(),
    })
  },
}
