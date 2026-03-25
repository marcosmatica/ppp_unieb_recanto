// src/pages/AnalysisNew.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../contexts/AuthContext'
import { schoolsService, analysesService, uploadService } from '../services/firebase'
import toast from 'react-hot-toast'
import { UploadCloud, FileText, X, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import './AnalysisNew.css'

const ACCEPTED = { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }

export default function AnalysisNew() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [schools,  setSchools]  = useState([])
  const [schoolId, setSchoolId] = useState('')
  const [file2026, setFile2026] = useState(null)
  const [file2025, setFile2025] = useState(null)
  const [progress, setProgress] = useState({ ppp2026: 0, ppp2025: 0 })
  const [step,     setStep]     = useState('form')  // form | uploading | done

  useEffect(() => {
    if (!profile?.cre) return
    schoolsService.getByCRE(profile.cre).then(setSchools)
  }, [profile])

  const drop2026 = useDropzone({ accept: ACCEPTED, maxFiles: 1, onDrop: ([f]) => setFile2026(f) })
  const drop2025 = useDropzone({ accept: ACCEPTED, maxFiles: 1, onDrop: ([f]) => setFile2025(f) })

  async function handleSubmit() {
    if (!schoolId || !file2026) return toast.error('Selecione a escola e o PPP 2026')
    const school = schools.find(s => s.id === schoolId)
    setStep('uploading')

    try {
      const analysisId = await analysesService.create({
        schoolId, schoolName: school.name,
        cre: school.cre, analystId: user.uid, year: 2026,
      })

      await uploadService.uploadPPP({
        analysisId, file: file2026, year: 2026,
        onProgress: p => setProgress(v => ({ ...v, ppp2026: p })),
      })

      if (file2025) {
        await uploadService.uploadPPP({
          analysisId, file: file2025, year: 2025,
          onProgress: p => setProgress(v => ({ ...v, ppp2025: p })),
        })
      }

      setStep('done')
      setTimeout(() => navigate(`/analyses/${analysisId}`), 1800)
    } catch (err) {
      toast.error('Erro no upload: ' + err.message)
      setStep('form')
    }
  }

  if (step === 'uploading' || step === 'done') {
    return (
      <div className="page upload-progress-page">
        <div className="upload-card">
          {step === 'done'
            ? <CheckCircle2 size={48} className="upload-done-icon"/>
            : <Loader2 size={48} className="upload-spin-icon"/>
          }
          <h2>{step === 'done' ? 'Upload concluído!' : 'Enviando documentos…'}</h2>
          <p>{step === 'done' ? 'Redirecionando para a análise…' : 'Aguarde, isso pode levar alguns segundos.'}</p>

          {step === 'uploading' && (
            <div className="upload-bars">
              <ProgressBar label="PPP 2026" value={progress.ppp2026}/>
              {file2025 && <ProgressBar label="PPP 2025" value={progress.ppp2025}/>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nova análise</h1>
          <p className="page-sub">Envie o PPP da unidade escolar para análise automática</p>
        </div>
      </div>

      <div className="new-form">
        {/* Escola */}
        <div className="form-group">
          <label className="form-label">Unidade escolar</label>
          <select className="form-select" value={schoolId} onChange={e => setSchoolId(e.target.value)}>
            <option value="">Selecione…</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Upload PPP 2026 */}
        <div className="form-group">
          <label className="form-label">
            PPP 2026 <span className="required">*</span>
          </label>
          <DropZone
            getRootProps={drop2026.getRootProps}
            getInputProps={drop2026.getInputProps}
            isDragActive={drop2026.isDragActive}
            file={file2026}
            onRemove={() => setFile2026(null)}
            label="Arraste ou clique para enviar o PPP 2026"
          />
        </div>

        {/* Upload PPP 2025 */}
        <div className="form-group">
          <label className="form-label">
            PPP 2025 <span className="optional">(opcional — para comparativo)</span>
          </label>
          <DropZone
            getRootProps={drop2025.getRootProps}
            getInputProps={drop2025.getInputProps}
            isDragActive={drop2025.isDragActive}
            file={file2025}
            onRemove={() => setFile2025(null)}
            label="Arraste ou clique para enviar o PPP 2025"
          />
        </div>

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!schoolId || !file2026}
        >
          <UploadCloud size={16}/>
          Iniciar análise
        </button>
      </div>
    </div>
  )
}

function DropZone({ getRootProps, getInputProps, isDragActive, file, onRemove, label }) {
  if (file) {
    return (
      <div className="dropzone-filled">
        <FileText size={18} className="dz-file-icon"/>
        <span className="dz-filename">{file.name}</span>
        <span className="dz-filesize">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
        <button className="dz-remove" onClick={onRemove}><X size={14}/></button>
      </div>
    )
  }
  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'drag' : ''}`}>
      <input {...getInputProps()} />
      <UploadCloud size={26} className="dz-icon"/>
      <p className="dz-label">{label}</p>
      <p className="dz-hint">PDF ou DOCX · máx 30 MB</p>
    </div>
  )
}

function ProgressBar({ label, value }) {
  return (
    <div className="pbar-row">
      <span className="pbar-label">{label}</span>
      <div className="pbar-track">
        <div className="pbar-fill" style={{ width: `${value}%` }}/>
      </div>
      <span className="pbar-pct">{value}%</span>
    </div>
  )
}
