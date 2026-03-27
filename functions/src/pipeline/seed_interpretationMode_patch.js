/**
 * pipeline/seed_interpretationMode_patch.js
 *
 * Patch para adicionar o campo interpretationMode a todos os elementos
 * já existentes no Firestore (checklist_definitions).
 *
 * Execute uma única vez via Firebase Admin SDK local:
 *   node functions/src/pipeline/seed_interpretationMode_patch.js
 *
 * Ou inclua no seed.js original para novas instalações.
 *
 * Mapeamento de modos:
 *
 *   strict   — elementos estruturais/formais (capa, sumário, referências)
 *              verificação literal: ou está ou não está
 *
 *   moderate — conteúdo normativo com terminologia específica
 *              (projetos obrigatórios, seções pedagógicas definidas por portaria)
 *
 *   liberal  — conteúdo pedagógico integrado e difuso
 *              (avaliação, metodologias, princípios, organização do trabalho)
 *              frequentemente distribuído ao longo de todo o documento
 */

'use strict'

// ─── Mapeamento elementId → interpretationMode ────────────────────────────────

const INTERPRETATION_MAP = {

  // ── B1: Pré-textuais — estruturais → strict ──────────────────────────────
  'B1_1_capa':               'strict',
  'B1_2_sumario':            'strict',
  'B1_3_apresentacao':       'moderate',   // apresentação tem conteúdo autoral

  // ── B2: Identidade — mistura de formal e pedagógico ───────────────────────
  'B2_1_historico':          'moderate',   // histórico pode ser narrativo
  'B2_2_diagnostico':        'moderate',
  'B2_3_funcao_social':      'liberal',    // função social é construção coletiva
  'B2_4_missao':             'moderate',
  'B2_5_principios':         'liberal',    // princípios são filosóficos/pedagógicos

  // ── B3: Planejamento — núcleo pedagógico → liberal ────────────────────────
  'B3_1_metas':              'moderate',
  'B3_2_objetivos':          'moderate',
  'B3_3_fundamentos':        'liberal',    // fundamentos teóricos: linguagem própria
  'B3_4_org_curricular':     'liberal',    // organização curricular: muito integrado
  'B3_5_org_trabalho':       'liberal',    // trabalho pedagógico: difuso

  // ── B4: Ensino Médio — normativo específico → moderate ───────────────────
  'B4_1_itinerario':         'moderate',
  'B4_2_percursos':          'moderate',
  'B4_3_ifi':                'moderate',

  // ── B5: Projetos — 2026 são obrigatórios → moderate/strict ───────────────
  'B5_1_prog_institucionais': 'moderate',
  'B5_2_proj_especificos':   'moderate',
  'B5_2A_proj_etnorracial':  'moderate',   // obrigatório mas pode ter linguagem própria
  'B5_2B_proj_maria_penha':  'moderate',   // idem — exigência legal com espaço criativo
  'B5_3_parcerias':          'liberal',    // parcerias: pode ser descrito de várias formas

  // ── B6: Avaliação e suporte — pedagógico difuso → liberal ─────────────────
  'B6_1_avaliacao':          'liberal',    // avaliação: tema transversal em PPPs
  'B6_2_seaa':               'moderate',   // serviço específico: terminologia existe
  'B6_3_oe':                 'moderate',
  'B6_4_aee':                'moderate',   // AEE: terminologia técnica clara

  // ── B7: Profissionais — referências funcionais → moderate ─────────────────
  'B7_1_apoio_escolar':      'moderate',
  'B7_2_biblioteca':         'liberal',    // biblioteca: pode ser descrita de forma ampla
  'B7_3_conselho_escolar':   'moderate',
  'B7_4_readaptados':        'moderate',
  'B7_5_coord_pedagogica':   'liberal',    // coordenação: muito integrada ao texto

  // ── B8: Gestão — processo → liberal ──────────────────────────────────────
  'B8_1_permanencia':        'liberal',    // permanência: tema transversal
  'B8_2_implementacao':      'moderate',
  'B8_3_monitoramento':      'liberal',    // monitoramento: pode estar diluído

  // ── B9: Pós-textuais — estruturais → strict ──────────────────────────────
  'B9_1_referencias':        'strict',
  'B9_2_apendices':          'strict',
  'B9_3_anexos':             'strict',
}

// ─── Script de patch ──────────────────────────────────────────────────────────

async function runPatch() {
  const admin = require('firebase-admin')

  if (!admin.apps.length) {
    admin.initializeApp()
  }

  const db = admin.firestore()

  const snap = await db.collection('checklist_definitions')
    .where('active', '==', true)
    .get()

  const batch = db.batch()
  let updated = 0

  snap.docs.forEach(doc => {
    const mode = INTERPRETATION_MAP[doc.id]
    if (mode) {
      batch.update(doc.ref, {
        interpretationMode: mode,
        updatedAt: admin.firestore.Timestamp.now(),
      })
      updated++
    } else {
      // Fallback para elementos não mapeados
      batch.update(doc.ref, {
        interpretationMode: 'moderate',
        updatedAt: admin.firestore.Timestamp.now(),
      })
      console.warn(`[WARN] interpretationMode não definido para ${doc.id} — usando 'moderate'`)
      updated++
    }
  })

  await batch.commit()
  console.log(`✓ ${updated} elementos atualizados com interpretationMode`)
}

// Executa se chamado diretamente
if (require.main === module) {
  runPatch()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1) })
}

module.exports = { INTERPRETATION_MAP }
