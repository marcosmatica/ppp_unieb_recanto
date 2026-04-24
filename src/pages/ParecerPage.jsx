// src/pages/ParecerPage.jsx

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { parecerService } from '../services/parecerService'
import ParecerToolbar from '../components/parecer/ParecerToolbar'
import ParecerLayout from '../components/parecer/ParecerLayout'
import '../styles/parecer.css'

export default function ParecerPage() {
  const { analysisId } = useParams()
  const [analysis, setAnalysis]         = useState(null)
  const [observations, setObservations] = useState([])
  const [htmlUrl, setHtmlUrl]           = useState(null)
  const [loading, setLoading]           = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [filters, setFilters]           = useState({ tipos: [], blockCode: null })

  useEffect(() => {
    if (!analysisId) return
    let unsub = null

    async function load() {
      try {
        const a = await parecerService.getAnalysis(analysisId)
        setAnalysis(a)
        setHtmlUrl(a?.parecer?.anchoredHtmlUrl || null)

        unsub = parecerService.subscribeObservations(analysisId, setObservations)

        if (!a?.parecer?.generatedAt) {
          await generate(false)
        }
      } catch (e) {
        toast.error('Erro ao carregar parecer: ' + e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => { if (unsub) unsub() }
  }, [analysisId])

  async function generate(force) {
    setRegenerating(true)
    try {
      const res = await parecerService.build(analysisId, force)
      toast.success(`Parecer gerado: ${res.observationCount} observações`)
      const a = await parecerService.getAnalysis(analysisId)
      setAnalysis(a)
      setHtmlUrl(a?.parecer?.anchoredHtmlUrl || null)
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
      />
      <ParecerLayout
        htmlUrl={htmlUrl}
        observations={observations}
        filters={filters}
      />
    </div>
  )
}
