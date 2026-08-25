// src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
//import RegionalSelector from './components/RegionalSelector'
import './styles/globals.css'
import SettingsPage from './pages/SettingsPage'
import Dashboard from './pages/Dashboard'
import VisitasPage from './pages/VisitasPage'
import VisitaDetailPage from './pages/VisitaDetailPage'
import SessaoPage from './pages/SessaoPage'
import PlanoAcaoPage from './pages/PlanoAcaoPage'
import DashboardEIPage from './pages/DashboardEIPage'
import EscolaDetailPage from './pages/EscolaDetailPage'
import { useServiceWorker } from './hooks/useServiceWorker'

// Recarrega a página quando um chunk hasheado deixa de existir (deploy novo).
// Só recarrega 1x por sessão para não entrar em loop.
function lazyRetry(loader) {
  return loader().catch(err => {
    const isChunkErr =
      err?.name === 'ChunkLoadError' ||
      /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(String(err?.message || ''))
    if (isChunkErr && !sessionStorage.getItem('__chunk_reload__')) {
      sessionStorage.setItem('__chunk_reload__', '1')
      window.location.reload()
      return new Promise(() => {}) // trava o render até o reload
    }
    throw err
  })
}

const SchoolsPage    = lazy(() => lazyRetry(() => import('./pages/SchoolsPage')))
const AnalysisList   = lazy(() => lazyRetry(() => import('./pages/AnalysisList')))
const AnalysisNew    = lazy(() => lazyRetry(() => import('./pages/AnalysisNew')))
const AnalysisReview = lazy(() => lazyRetry(() => import('./pages/AnalysisReview')))
const ReportPage     = lazy(() => lazyRetry(() => import('./pages/ReportPage')))
const ReportsPage    = lazy(() => lazyRetry(() => import('./pages/ReportsPage')))
const ParecerPage    = lazy(() => lazyRetry(() => import('./pages/ParecerPage')))

const FeiraListPage       = lazy(() => lazyRetry(() => import('./pages/feira/FeiraListPage')))
const FeiraConfigPage     = lazy(() => lazyRetry(() => import('./pages/feira/FeiraConfigPage')))
const FeiraLinksPage      = lazy(() => lazyRetry(() => import('./pages/feira/FeiraLinksPage')))
const FeiraInscricaoPage  = lazy(() => lazyRetry(() => import('./pages/feira/FeiraInscricaoPage')))
const FeiraAnalisePage    = lazy(() => lazyRetry(() => import('./pages/feira/FeiraAnalisePage')))
const FeiraAvaliacaoPage  = lazy(() => lazyRetry(() => import('./pages/feira/FeiraAvaliacaoPage')))
const FeiraResultadosPage = lazy(() => lazyRetry(() => import('./pages/feira/FeiraResultadosPage')))
const FeiraRecursosPage   = lazy(() => lazyRetry(() => import('./pages/feira/FeiraRecursosPage')))
const FeiraPortal          = lazy(() => lazyRetry(() => import('./pages/feira-publica/FeiraPortal')))
const EscolaPortal        = lazy(() => lazyRetry(() => import('./pages/feira-publica/EscolaPortal')))
const ProjetoInscricao    = lazy(() => lazyRetry(() => import('./pages/feira-publica/ProjetoInscricao')))
const ProjetoStatus       = lazy(() => lazyRetry(() => import('./pages/feira-publica/ProjetoStatus')))

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  )
}

function UnauthorizedPage() {
  return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <p style={{ fontFamily: 'Sora, sans-serif', color: '#0b2d5b', fontSize: 16 }}>
          E-mail não autorizado. Contate o administrador da UNIEB.
        </p>
      </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading, unauthorized } = useAuth()
  if (loading) return <PageLoader />
  if (unauthorized) return <UnauthorizedPage />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  useServiceWorker()
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route path="/analyses/:analysisId/parecer" element={
                <RequireAuth><ParecerPage /></RequireAuth>
              } />

              {/* Feira de Ciências — rotas públicas */}
              <Route path="/inscricao" element={<FeiraPortal />} />
              <Route path="/inscricao/:tokenEscola" element={<EscolaPortal />} />
              <Route path="/inscricao/:tokenEscola/novo" element={<ProjetoInscricao />} />
              <Route path="/inscricao/:tokenEscola/projeto/:rascunhoId" element={<ProjetoInscricao />} />
              <Route path="/inscricao/:tokenEscola/projeto/:rascunhoId/status" element={<ProjetoStatus />} />

              <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="schools" element={<SchoolsPage />} />
                <Route path="analyses" element={<AnalysisList />} />
                <Route path="analyses/new" element={<AnalysisNew />} />
                <Route path="analyses/:analysisId" element={<AnalysisReview />} />
                <Route path="analyses/:analysisId/report" element={<ReportPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />

                <Route path="feira" element={<FeiraListPage />} />
                <Route path="feira/config" element={<FeiraConfigPage />} />
                <Route path="feira/links" element={<FeiraLinksPage />} />
                <Route path="feira/resultados" element={<FeiraResultadosPage />} />
                <Route path="feira/recursos" element={<FeiraRecursosPage />} />
                <Route path="feira/inscricao/:id" element={<FeiraInscricaoPage />} />
                <Route path="feira/inscricao/:id/analise" element={<FeiraAnalisePage />} />
                <Route path="feira/inscricao/:id/avaliacao" element={<FeiraAvaliacaoPage />} />

                <Route path="visitas" element={<VisitasPage />} />
                <Route path="visitas/dashboard" element={<DashboardEIPage />} />
                <Route path="visitas/escola/:schoolId" element={<EscolaDetailPage />} />
                <Route path="visitas/:visitId" element={<VisitaDetailPage />} />
                <Route path="visitas/:visitId/sessoes/:sessionId" element={<SessaoPage />} />
                <Route path="visitas/:visitId/planos" element={<PlanoAcaoPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{ style: { fontFamily: 'DM Sans, sans-serif', fontSize: 13 } }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}
