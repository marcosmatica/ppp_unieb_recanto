// src/components/visitas/GaleriaEvidencias.jsx

import { useState, useRef } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../../services/firebase'
import './GaleriaEvidencias.css'

export default function GaleriaEvidencias({
  visitId, sessionId, indicatorCode, urls = [], onChange, readOnly = false,
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]  = useState(0)
  const [lightbox, setLightbox]  = useState(null)
  const inputRef = useRef()

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true)
    const newUrls = [...urls]
    for (const file of Array.from(files)) {
      const path = `visitas/${visitId}/${sessionId}/${indicatorCode}/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file)
        task.on(
          'state_changed',
          snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref)
            newUrls.push(url)
            resolve()
          }
        )
      })
    }
    onChange(newUrls)
    setUploading(false)
    setProgress(0)
  }

  return (
    <div className="ge-root">
      <div className="ge-grid">
        {urls.map((url, i) => (
          <button key={url} className="ge-thumb" onClick={() => setLightbox(i)}>
            <img src={url} alt={`Evidência ${i + 1}`} loading="lazy" />
          </button>
        ))}

        {!readOnly && (
          <button
            className="ge-add"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <span className="ge-progress">{progress}%</span>
            ) : (
              <span className="ge-add__icon">+</span>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {lightbox !== null && (
        <div className="ge-lightbox" onClick={() => setLightbox(null)}>
          <img src={urls[lightbox]} alt="" />
          <div className="ge-lightbox__nav">
            <button
              disabled={lightbox === 0}
              onClick={e => { e.stopPropagation(); setLightbox(i => i - 1) }}
            >←</button>
            <span>{lightbox + 1} / {urls.length}</span>
            <button
              disabled={lightbox === urls.length - 1}
              onClick={e => { e.stopPropagation(); setLightbox(i => i + 1) }}
            >→</button>
          </div>
        </div>
      )}
    </div>
  )
}
