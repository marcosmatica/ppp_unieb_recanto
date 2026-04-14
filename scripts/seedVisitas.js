// scripts/seedVisitas.js
// Uso: node scripts/seedVisitas.js
// Requer: GOOGLE_APPLICATION_CREDENTIALS apontando para a service account
// OU rodar com: firebase functions:shell  (não recomendado)
// Melhor: firebase-admin via service account baixada do console

const admin = require('firebase-admin')

// Cole o path do seu serviceAccountKey.json baixado do Firebase Console
// Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

async function seed() {
  const visitRef = await db.collection('schoolVisits').add({
    schoolId:    '_seed',
    schoolName:  '_seed',
    cre:         '_seed',
    ciId:        '_seed',
    ciName:      '_seed',
    status:      'open',
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log('schoolVisits criada, doc:', visitRef.id)

  const sessionRef = await db
    .collection('schoolVisits').doc(visitRef.id)
    .collection('sessions').add({
      metasCodes: ['M1'],
      date:       admin.firestore.Timestamp.now(),
      status:     'draft',
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    })
  console.log('sessions criada, doc:', sessionRef.id)

  await db
    .collection('schoolVisits').doc(visitRef.id)
    .collection('sessions').doc(sessionRef.id)
    .collection('responses').doc('1.1').set({
      descriptorLevel: 1,
      observation:     '_seed',
      evidenceUrls:    [],
      createdAt:       admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
    })
  console.log('responses criada')

  await db
    .collection('schoolVisits').doc(visitRef.id)
    .collection('actionPlans').add({
      visitId:          visitRef.id,
      schoolId:         '_seed',
      schoolName:       '_seed',
      cre:              '_seed',
      indicatorCode:    '1.1',
      indicatorLabel:   '_seed',
      metaCode:         'M1',
      descriptorLevel:  1,
      goal:             '_seed',
      deadline:         '2025-01-01',
      responsibleSchool:'_seed',
      responsibleCI:    '_seed',
      ciId:             '_seed',
      observation:      '_seed',
      status:           'pending',
      createdAt:        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    })
  console.log('actionPlans criada')

  console.log('\nColeções criadas. Agora crie os índices no Firebase Console:')
  console.log('schoolVisits: ciId ASC + updatedAt DESC')
  console.log('schoolVisits: schoolId ASC + createdAt DESC')
  console.log('schoolVisits: cre ASC + createdAt DESC')
  console.log('sessions (subcoleção): status ASC + date DESC')
  console.log('\nApós criar os índices, delete o doc _seed manualmente.')

  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
