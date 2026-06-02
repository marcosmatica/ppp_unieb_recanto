/**
 * src/components/ReanalysisUpload.jsx
 *
 * Permite ao analista enviar uma versão atualizada do PPP para reanálise.
 * Apenas os elementos não confirmados como adequados são reanalisados.
 *
 * Props:
 *   analysis    — objeto da análise (com analysis.reanalysis)
 *   analysisId  — string
 */

import { useState, useRef } from 'react'
import {
  Upload, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, FileText, X,
} from 'lucide-react'
import { uploadService, reanalysisService } from '../services/firebase'
import toast from 'react-hot-toast'
import './ReanalysisUpload.css'

const PROCESSING_STEPS = [
  { key: 'extracting', label: 'Extraindo texto do documento atualizado…' },
  { key: 'analyzing',  label: 'Reanalisando elementos com IA (Haiku)…' },
]

export default function ReanalysisUpload({ analysis, analysisId }) {
  const [expanded,        setExpanded]        = useState(false)
  const [file,            setFile]            = useState(null)
  const [dragOver,        setDragOver]        = useState(false)
  const [uploadProgress,  setUploadProgress]  = useState(null)
  const [running,         setRunning]         = useState(false)
  const inputRef = useRef(null)

  const reanalysis  = analysis?.reanalysis
  const isRunning   = reanalysis?.status === 'extracting' || reanalysis?.status === 'analyzing'
  const isDone      = reanalysis?.status === 'complete'
  const isError     = reanalysis?.status === 'error'
  const currentStep = PROCESSING_STEPS.findIndex(s => s.key === reanalysis?.status)

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx'].includes(ext)) {
      toast.error('Somente arquivos PDF ou DOCX são aceitos.')
      return
    }
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleStart = async () => {
    if (!file || running) return
    setRunning(true)
    setUploadProgress(0)
    try {
      const { path } = await uploadService.uploadUpdatedPPP({
        analysisId,
        file,
        onProgress: setUploadProgress,
      })
      setUploadProgress(null)
      // A callable function atualiza reanalysis.status em tempo real via Firestore;
      // o componente pai já tem onSnapshot — não é necessário esperar o retorno
      reanalysisService.trigger(analysisId, path).catch(err => {
        toast.error('Erro na reanálise: ' + (err.message || 'tente novamente'))
      })
      toast.success('Reanálise iniciada!')
      setFile(null)
      setExpanded(false)
    } catch (err) {
      toast.error('Erro ao enviar arquivo: ' + (err.message || 'tente novamente'))
    } finally {
      setRunning(false)
      setUploadProgress(null)
    }
  }

  return (
    <div className="rau-wrap">

      {/* ── Gatilho / Cabeçalho ─────────────────────────────────────────── */}
      <button
        className={`rau-trigger${expanded ? ' rau-trigger--open' : ''}${isRunning ? ' rau-trigger--running' : ''}`}
        onClick={() => !isRunning && setExpanded(v => !v)}
        disabled={isRunning}
        aria-expanded={expanded}
      >
        <div className="rau-trig-left">
          {isRunning
            ? <Loader2 size={14} className="rau-spin" />
            : isDone
              ? <CheckCircle2 size={14} className="rau-icon--done" />
              : isError
                ? <AlertCircle size={14} className="rau-icon--error" />
                : <RefreshCw size={14} />
          }
          <div className="rau-trig-text">
            <span className="rau-trig-title">
              {isRunning ? 'Reanálise em andamento…'
               : isDone  ? `Versão atualizada analisada · ${reanalysis.reanalyzedCount} elemento${reanalysis.reanalyzedCount !== 1 ? 's' : ''} revistos`
               : isError ? 'Erro na reanálise — tentar novamente'
               :           'Enviar versão atualizada do PPP'}
            </span>
            {!isRunning && !isDone && !isError && (
              <span className="rau-trig-sub">
                Apenas elementos críticos, em atenção ou não revisados serão reanalisados
              </span>
            )}
            {isError && reanalysis?.error && (
              <span className="rau-trig-sub rau-trig-sub--error">{reanalysis.error}</span>
            )}
          </div>
        </div>
        {!isRunning && (
          expanded
            ? <ChevronUp  size={14} className="rau-chevron" />
            : <ChevronDown size={14} className="rau-chevron" />
        )}
      </button>

      {/* ── Status de processamento (em tempo real) ─────────────────────── */}
      {isRunning && (
        <div className="rau-processing">
          {PROCESSING_STEPS.map((step, i) => {
            const done    = i < currentStep
            const current = i === currentStep
            return (
              <div key={step.key} className={`rau-step${done ? ' rau-step--done' : ''}${current ? ' rau-step--active' : ''}`}>
                <div className="rau-step-dot">
                  {done    && <CheckCircle2 size={12} />}
                  {current && <Loader2 size={12} className="rau-spin" />}
                </div>
                <span>{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Área de upload ───────────────────────────────────────────────── */}
      {expanded && !isRunning && (
        <div className="rau-body">
          <p className="rau-hint">
            Envie a versão corrigida do PPP. O sistema irá reanalizar
            <strong> apenas os elementos ainda críticos, em atenção ou pendentes</strong>.
            Elementos já confirmados como adequados pelo analista permanecem inalterados.
          </p>

          {/* Drop zone */}
          <div
            className={`rau-dropzone${dragOver ? ' rau-dropzone--over' : ''}${file ? ' rau-dropzone--selected' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="rau-dz-file">
                <FileText size={18} />
                <div className="rau-dz-file-info">
                  <span className="rau-dz-name">{file.name}</span>
                  <span className="rau-dz-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <button
                  className="rau-dz-clear"
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  title="Remover arquivo"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="rau-dz-empty">
                <Upload size={20} />
                <p>Arraste o PPP atualizado aqui ou <span className="rau-dz-link">clique para selecionar</span></p>
                <span className="rau-dz-types">PDF ou DOCX</span>
              </div>
            )}
          </div>

          {/* Barra de progresso do upload */}
          {uploadProgress !== null && (
            <div className="rau-progress-wrap">
              <div className="rau-progress-bar">
                <div className="rau-progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="rau-progress-label">Enviando… {uploadProgress}%</span>
            </div>
          )}

          <div className="rau-footer">
            <button className="rau-cancel" onClick={() => { setExpanded(false); setFile(null) }}>
              Cancelar
            </button>
            <button
              className="rau-submit"
              onClick={handleStart}
              disabled={!file || running}
            >
              {running
                ? <><Loader2 size={13} className="rau-spin" /> Enviando…</>
                : <><RefreshCw size={13} /> Iniciar reanálise</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
