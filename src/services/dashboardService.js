// src/services/dashboardService.js
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from './firebase'
import { METAS_EI } from './indicadoresEI'

export async function fetchVisitasCRE(cre) {
  const q = query(
    collection(db, 'schoolVisits'),
    where('cre', '==', cre),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function fetchVisitasCI(ciId) {
  const q = query(
    collection(db, 'schoolVisits'),
    where('ciId', '==', ciId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// visitas = array de objetos { id, schoolId, schoolName, cre, createdAt }
// Retorna { [schoolId]: { schoolName, cre, createdAt, indicators: { [code]: { levels, observations } } } }
export async function fetchRespostasAgregadas(visitas) {
  const result = {}
  await Promise.all(
    visitas.map(async ({ id: visitId, schoolId, schoolName, cre, createdAt }) => {
      if (!result[schoolId]) {
        result[schoolId] = { schoolName, cre, createdAt, indicators: {} }
      }
      const sessSnap = await getDocs(
        query(
          collection(db, 'schoolVisits', visitId, 'sessions'),
          where('status', '==', 'submitted')
        )
      )
      await Promise.all(
        sessSnap.docs.map(async s => {
          const rSnap = await getDocs(
            collection(db, 'schoolVisits', visitId, 'sessions', s.id, 'responses')
          )
          rSnap.docs.forEach(r => {
            const code = r.id
            const data = r.data()
            if (!result[schoolId].indicators[code]) {
              result[schoolId].indicators[code] = { levels: [], observations: [] }
            }
            if (data.descriptorLevel) {
              result[schoolId].indicators[code].levels.push(data.descriptorLevel)
            }
            if (data.observation) {
              result[schoolId].indicators[code].observations.push(data.observation)
            }
          })
        })
      )
    })
  )
  return result
}

export function calcHeatmap(agregadas) {
  const heatmap = {}
  Object.entries(agregadas).forEach(([schoolId, { indicators }]) => {
    heatmap[schoolId] = {}
    Object.entries(indicators).forEach(([code, { levels }]) => {
      if (levels.length > 0) {
        heatmap[schoolId][code] = levels.reduce((a, b) => a + b, 0) / levels.length
      }
    })
  })
  return heatmap
}

export const ALL_INDICATORS = METAS_EI.flatMap(m =>
  m.indicadores.map(i => ({ ...i, metaCode: m.code, metaLabel: m.label }))
)

export async function fetchHistoricoEscola(schoolId) {
  const vSnap = await getDocs(
    query(
      collection(db, 'schoolVisits'),
      where('schoolId', '==', schoolId),
      orderBy('createdAt', 'asc')
    )
  )
  const pontos = []
  await Promise.all(
    vSnap.docs.map(async v => {
      const date = v.data().createdAt?.toDate?.() ?? null
      const sSnap = await getDocs(
        query(
          collection(db, 'schoolVisits', v.id, 'sessions'),
          where('status', '==', 'submitted')
        )
      )
      await Promise.all(
        sSnap.docs.map(async s => {
          const sessDate = s.data().date?.toDate?.() ?? date
          const rSnap = await getDocs(
            collection(db, 'schoolVisits', v.id, 'sessions', s.id, 'responses')
          )
          rSnap.docs.forEach(r => {
            const d = r.data()
            if (d.descriptorLevel) {
              pontos.push({ date: sessDate, indicatorCode: r.id, level: d.descriptorLevel })
            }
          })
        })
      )
    })
  )
  return pontos.sort((a, b) => a.date - b.date)
}

// visitas = array de objetos com { id, schoolName, cre }
export async function fetchPlanosCRE(visitas) {
  const plans = await Promise.all(
    visitas.map(v =>
      getDocs(collection(db, 'schoolVisits', v.id, 'actionPlans'))
        .then(s => s.docs.map(d => ({
          id: d.id,
          visitId: v.id,
          schoolName: v.schoolName,
          cre: v.cre,
          ...d.data(),
        })))
    )
  )
  return plans.flat()
}
