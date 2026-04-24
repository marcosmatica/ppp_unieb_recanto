// src/components/parecer/ExportParecerButton.jsx

import { useState } from 'react'
import { Download, FileText, Loader2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { parecerService } from '../../services/parecerService'

export default function ExportParecerButton({ analysisId, pdfUrl, pdfGeneratedAt, disabled }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    const t = toast.loading('Gerando PDF… pode levar até 1 minuto.')
    try {
      const res = await parecerService.exportPdf(analysisId)
      toast.success('PDF gerado com sucesso', { id: t })
      const a = document.createElement('a')
      a.href = res.downloadUrl
      a.download = res.fileName
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e.message || 'desconhecido'), { id: t })
    } finally {
      setExporting(false)
    }
  }

  if (pdfUrl && !exporting) {
    return (
      <div className="export-group">
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
          <FileText size={13} /> Abrir PDF <ExternalLink size={11} />
        </a>
        <button className="btn-ghost" onClick={handleExport} disabled={disabled || exporting} title="Regenerar PDF">
          <Download size={13} /> Regenerar
        </button>
      </div>
    )
  }

  return (
    <button className="btn-primary" onClick={handleExport} disabled={disabled || exporting}>
      {exporting
        ? <><Loader2 size={13} className="is-spinning" /> Gerando…</>
        : <><Download size={13} /> Exportar PDF</>
      }
    </button>
  )
}
