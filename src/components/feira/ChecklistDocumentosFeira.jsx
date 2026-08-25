import { useCallback, useState } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../../services/firebase'
import { MAX_FILE_SIZE } from '../../constants/feiraConstants'
import DocPreview from './DocPreview'

const TIPOS_PROJETO = ['application/pdf']
const TIPOS_TERMO = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']

export const CONFIRMACOES_PROJETO = [
  { key: 'formato_arquivo', label: 'Arquivo em PDF, no máximo 10 MB, folha A4, margens 2x2x2x2 cm, fonte Arial, espaçamento simples.' },
  { key: 'limite_paginas', label: 'Projeto com no mínimo 5 e no máximo 10 páginas.' },
  { key: 'topicos_obrigatorios', label: 'Contém todos os tópicos obrigatórios: Título; Autores e instituição; Resumo; Palavras-chave; Introdução; Metodologia; Resultados e Discussão; Conclusões; Referências Bibliográficas.' },
  { key: 'legendas_titulos', label: 'Figuras e gráficos possuem legendas abaixo; tabelas possuem títulos acima; todos citados no texto antes de aparecerem.' },
  { key: 'resultados_apresentados', label: 'O projeto apresenta resultados (não é apenas relato de experiência ou descrição de eventos) e evidencia a participação efetiva dos estudantes.' },
  { key: 'sem_plagio_ia', label: 'O projeto não contém plágio e não foi elaborado exclusiva ou majoritariamente por IA. Usos de IA como suporte estão devidamente citados.' },
  { key: 'impacto_etica', label: 'O projeto explicita o impacto social da investigação e respeita as normas éticas de pesquisa com seres humanos e biodiversidade.' },
  { key: 'nome_social', label: 'O direito ao uso do nome social de estudantes e orientadores foi respeitado na identificação da equipe.' },
  { key: 'autores_cientes', label: 'Todos os autores têm conhecimento das normas do Regulamento e o(a) professor(a)-orientador(a) é responsável legal pelo conteúdo.' },
]

export default function ChecklistDocumentosFeira({ edicaoId, escolaInep, projetoId, documentos, estudantes, modeloAutorizacao, confirmacoes, onConfirmacoesChange, onChange, disabled }) {
  const [uploading, setUploading] = useState({})

  const upload = useCallback(async (file, campo, estudanteIdx) => {
    const isProjeto = campo === 'projeto_pesquisa'
    const tipos = isProjeto ? TIPOS_PROJETO : TIPOS_TERMO
    if (!tipos.includes(file.type)) {
      return alert(isProjeto
        ? 'Apenas arquivos PDF são aceitos para o Projeto de Pesquisa.'
        : 'Envie um arquivo PDF ou uma foto (JPG/PNG) do termo assinado.')
    }
    if (file.size > MAX_FILE_SIZE) return alert('Arquivo excede 15 MB.')

    const uploadKey = isProjeto ? 'projeto_pesquisa' : `termo_${estudanteIdx}`
    setUploading(u => ({ ...u, [uploadKey]: 0 }))

    const ts = Date.now()
    const subdir = isProjeto ? 'projeto' : `termo_est_${estudanteIdx}`
    const path = `feira/${edicaoId}/${escolaInep}/${projetoId}/${subdir}/${ts}_${file.name}`
    const storageRef = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)

    task.on('state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        setUploading(u => ({ ...u, [uploadKey]: pct }))
      },
      () => {
        setUploading(u => { const n = { ...u }; delete n[uploadKey]; return n })
        alert('Erro no upload. Tente novamente.')
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        const info = { url, path, nome: file.name, tamanho: file.size, tipo: file.type, enviado_em: new Date().toISOString() }
        if (isProjeto) {
          onChange({ ...documentos, projeto_pesquisa: info })
        } else {
          const arr = Array.isArray(documentos?.termos_autorizacao) ? [...documentos.termos_autorizacao] : []
          arr[estudanteIdx] = info
          onChange({ ...documentos, termos_autorizacao: arr })
        }
        setUploading(u => { const n = { ...u }; delete n[uploadKey]; return n })
      }
    )
  }, [edicaoId, escolaInep, projetoId, documentos, onChange])

  const projOk = !!documentos?.projeto_pesquisa?.url
  const termosArr = Array.isArray(documentos?.termos_autorizacao) ? documentos.termos_autorizacao : []
  // Retrocompat: se existe apenas o termo único antigo, exibe como referência mas exige upload individual.
  const termoLegado = documentos?.termo_autorizacao

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DocItem
        label="Projeto de Pesquisa (PDF)"
        ok={projOk}
        progress={uploading.projeto_pesquisa}
        fileName={documentos?.projeto_pesquisa?.nome}
        url={documentos?.projeto_pesquisa?.url}
        onFile={f => upload(f, 'projeto_pesquisa')}
        disabled={disabled}
        accept=".pdf"
      />

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Termos de Autorização de Uso de Imagem e Voz</div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 8px' }}>
          Anexo VIII — <strong>um documento assinado por estudante</strong>. Aceito em PDF ou foto (JPG/PNG).
        </p>
        {modeloAutorizacao?.url && (
          <a
            href={modeloAutorizacao.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: '#2563eb', display: 'inline-block', marginBottom: 8 }}
          >
            ↓ Baixar modelo de autorização
          </a>
        )}
        {termoLegado?.url && !termosArr.length && (
          <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', padding: 8, borderRadius: 6, marginBottom: 8 }}>
            Um termo único foi enviado anteriormente. A partir desta edição é necessário enviar um termo por estudante.
          </div>
        )}
        {(estudantes || []).map((est, idx) => {
          const info = termosArr[idx]
          return (
            <div key={idx} style={{ marginBottom: 8 }}>
              <DocItem
                label={`Termo — ${est?.nome || `Estudante ${idx + 1}`}`}
                ok={!!info?.url}
                progress={uploading[`termo_${idx}`]}
                fileName={info?.nome}
                url={info?.url}
                onFile={f => upload(f, 'termo_autorizacao', idx)}
                disabled={disabled}
                accept=".pdf,image/*"
                captureHint
              />
            </div>
          )
        })}
        {!(estudantes || []).length && (
          <p style={{ fontSize: 12, color: '#dc2626' }}>Cadastre os estudantes na etapa anterior para anexar as autorizações.</p>
        )}
      </div>

      <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Conformidade do Projeto de Pesquisa com o Regulamento</div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
          A escola deve confirmar que o Projeto de Pesquisa enviado está de acordo com as orientações do Anexo I e demais itens do Regulamento.
          Todos os itens abaixo precisam ser marcados para enviar a inscrição.
        </p>
        {CONFIRMACOES_PROJETO.map(item => (
          <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, marginBottom: 8, lineHeight: 1.35 }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={!!confirmacoes?.[item.key]}
              onChange={e => onConfirmacoesChange?.({ ...(confirmacoes || {}), [item.key]: e.target.checked })}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function DocItem({ label, ok, progress, fileName, url, onFile, disabled, accept, captureHint }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 10,
      border: `1px solid ${ok ? 'var(--success, #16a34a)' : 'var(--border, #d1d5db)'}`,
      background: ok ? 'rgba(22,163,74,.04)' : 'transparent',
    }}>
      <span style={{ fontSize: 16 }}>{ok ? '✓' : '○'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {fileName && <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>}
        {progress != null && <div style={{ fontSize: 11, color: '#2563eb' }}>Enviando... {progress}%</div>}
      </div>
      {url && <DocPreview url={url} nome={fileName} />}
      {!disabled && (
        <label style={{
          padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          border: '1px solid var(--border, #d1d5db)', cursor: 'pointer',
          color: 'var(--primary, #2563eb)',
        }}>
          {ok ? 'Substituir' : (captureHint ? 'Enviar / Tirar foto' : 'Enviar')}
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = '' }}
          />
        </label>
      )}
    </div>
  )
}
