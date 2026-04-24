// src/pages/ParecerPage.jsx

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { parecerService } from '../services/parecerService'
import { usePermissoes } from '../hooks/usePermissoes'
import ParecerToolbar from '../components/parecer/ParecerToolbar'
import ParecerLayout from '../components/parecer/ParecerLayout'
import ParecerStatusBar from '../components/parecer/ParecerStatusBar'
import '../styles/parecer.css'

export default function ParecerPage() {
  const { analysisId } = useParams()
  const { podeEditarParecer, podeFinalizarParecer, podeReabrirParecer } = usePermissoes()

  const [analysis, setAnalysis]         = useState(null)
  const [observations, setObservations] = useState([])
  const [loading, setLoading]           = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [finalizing, setFinalizing]     = useState(false)
  const [selectMode, setSelectMode]     = useState(false)
  const [filters, setFilters]           = useState({
    tipos: [], blockCode: null, showRejected: false,
  })

  const parecerStatus = analysis?.parecer?.status || 'draft'
  const finalized     = parecerStatus === 'finalizado'
  const readOnly      = finalized || !podeEditarParecer

  useEffect(() => {
    if (!analysisId) return
    let unsubA = null
    let unsubO = null
    let cancelled = false

    async function load() {
      try {
        const a = await parecerService.getAnalysis(analysisId)
        if (cancelled) return
        setAnalysis(a)

        unsubA = parecerService.subscribeAnalysis(analysisId, setAnalysis)
        unsubO = parecerService.subscribeObservations(analysisId, setObservations)

        if (!a?.parecer?.generatedAt) {
          await generate(false)
        }
      } catch (e) {
        toast.error('Erro ao carregar parecer: ' + e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true; unsubA?.(); unsubO?.() }
  }, [analysisId])

  async function generate(force) {
    setRegenerating(true)
    try {
      const res = await parecerService.build(analysisId, force)
      toast.success(`Parecer gerado: ${res.observationCount} observações`)
    } catch (e) {
      if (e.code === 'functions/failed-precondition' && !force) {
        if (confirm('Existem observações editadas. Regenerar apagará as edições. Continuar?')) {
          await generate(true)
        }
      } else {
        toast.error('Erro: ' + e.message)
      }
    } finally {
      setRegenerating(false)
    }
  }

  async function finalizar() {
    const pendentes = observations.filter(o => o.status === 'auto').length
    if (pendentes > 0) {
      toast.error(`Revise as ${pendentes} observações pendentes antes de finalizar.`)
      return
    }
    if (!confirm('Finalizar o parecer? Edições ficarão bloqueadas até que seja reaberto.')) return

    setFinalizing(true)
    try {
      await parecerService.finalizar(analysisId, false)
      toast.success('Parecer finalizado')
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setFinalizing(false)
    }
  }

  async function reabrir() {
    if (!confirm('Reabrir o parecer para edição?')) return
    setFinalizing(true)
    try {
      await parecerService.finalizar(analysisId, true)
      toast.success('Parecer reaberto')
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return (
      <div className="parecer-page">
        <div className="parecer-loader"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="parecer-page">
      <ParecerToolbar
        analysis={analysis}
        observations={observations}
        filters={filters}
        setFilters={setFilters}
        onRegenerate={() => generate(false)}
        regenerating={regenerating}
        canRegenerate={!finalized && podeEditarParecer}
      />

      <ParecerStatusBar
        observations={observations}
        parecerStatus={parecerStatus}
        podeFinalizar={podeFinalizarParecer}
        podeReabrir={podeReabrirParecer}
        podeEditar={podeEditarParecer}
        selectMode={selectMode}
        onToggleSelect={() => setSelectMode(s => !s)}
        onFinalizar={finalizar}
        onReabrir={reabrir}
        finalizing={finalizing}
      />

      <ParecerLayout
        analysisId={analysisId}
        htmlUrl={analysis?.parecer?.anchoredHtmlUrl}
        observations={observations}
        filters={filters}
        readOnly={readOnly}
        selectMode={selectMode && !readOnly}
        onSelectModeHandled={() => setSelectMode(false)}
      />
    </div>
  )
}
