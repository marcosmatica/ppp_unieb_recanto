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

const SchoolsPage    = lazy(() => import('./pages/SchoolsPage'))
const AnalysisList   = lazy(() => import('./pages/AnalysisList'))
const AnalysisNew    = lazy(() => import('./pages/AnalysisNew'))
const AnalysisReview = lazy(() => import('./pages/AnalysisReview'))
const ReportPage     = lazy(() => import('./pages/ReportPage'))
const ReportsPage    = lazy(() => import('./pages/ReportsPage'))
const ParecerPage    = lazy(() => import('./pages/ParecerPage'))

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
