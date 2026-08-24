import { useCallback, useState } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../../services/firebase'
import { MAX_FILE_SIZE } from '../../constants/feiraConstants'

export default function ChecklistDocumentosFeira({ edicaoId, escolaInep, projetoId, documentos, estudantes, onChange, disabled }) {
  const [uploading, setUploading] = useState({})

  const upload = useCallback(async (file, campo, estudanteIdx) => {
    if (file.type !== 'application/pdf') return alert('Apenas arquivos PDF são aceitos.')
    if (file.size > MAX_FILE_SIZE) return alert('Arquivo excede 15 MB.')

    const key = estudanteIdx != null ? `termo_${estudanteIdx}` : campo
    setUploading(u => ({ ...u, [key]: 0 }))

    const ts = Date.now()
    const path = `feira/${edicaoId}/${escolaInep}/${projetoId}/${ts}_${file.name}`
    const storageRef = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)

    task.on('state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        setUploading(u => ({ ...u, [key]: pct }))
      },
      () => {
        setUploading(u => { const n = { ...u }; delete n[key]; return n })
        alert('Erro no upload. Tente novamente.')
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        const info = { url, path, nome: file.name, tamanho: file.size, enviado_em: new Date().toISOString() }

        if (campo === 'projeto_pesquisa') {
          onChange({ ...documentos, projeto_pesquisa: info })
        } else {
          const termos = [...(documentos?.termos_autorizacao || [])]
          termos[estudanteIdx] = { ...info, estudante_nome: estudantes[estudanteIdx]?.nome || '' }
          onChange({ ...documentos, termos_autorizacao: termos })
        }
        setUploading(u => { const n = { ...u }; delete n[key]; return n })
      }
    )
  }, [edicaoId, escolaInep, projetoId, documentos, estudantes, onChange])

  const projOk = !!documentos?.projeto_pesquisa?.url

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DocItem
        label="Projeto de Pesquisa (PDF)"
        ok={projOk}
        progress={uploading.projeto_pesquisa}
        fileName={documentos?.projeto_pesquisa?.nome}
        onFile={f => upload(f, 'projeto_pesquisa')}
        disabled={disabled}
      />

      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>
        Termos de Autorização de Imagem e Voz
      </div>
      {(estudantes || []).map((est, i) => {
        const termo = documentos?.termos_autorizacao?.[i]
        return (
          <DocItem
            key={i}
            label={est.nome || `Estudante ${i + 1}`}
            ok={!!termo?.url}
            progress={uploading[`termo_${i}`]}
            fileName={termo?.nome}
            onFile={f => upload(f, 'termos_autorizacao', i)}
            disabled={disabled}
          />
        )
      })}
    </div>
  )
}

function DocItem({ label, ok, progress, fileName, onFile, disabled }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 8,
      border: `1px solid ${ok ? 'var(--success, #16a34a)' : 'var(--border, #d1d5db)'}`,
      background: ok ? 'rgba(22,163,74,.04)' : 'transparent',
    }}>
      <span style={{ fontSize: 16 }}>{ok ? '✓' : '○'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {fileName && <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>}
        {progress != null && <div style={{ fontSize: 11, color: '#2563eb' }}>Enviando... {progress}%</div>}
      </div>
      {!disabled && (
        <label style={{
          padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          border: '1px solid var(--border, #d1d5db)', cursor: 'pointer',
          color: 'var(--primary, #2563eb)',
        }}>
          {ok ? 'Substituir' : 'Enviar'}
          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = '' }} />
        </label>
      )}
    </div>
  )
}
