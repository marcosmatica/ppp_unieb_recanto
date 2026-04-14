// src/App.jsx - versão com lazy loading
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegionalSelector from './components/RegionalSelector'
import './styles/globals.css'
import SettingsPage from './pages/SettingsPage'

import VisitasPage      from './pages/VisitasPage'
import VisitaDetailPage from './pages/VisitaDetailPage'

// Lazy loading das páginas que não são críticas
const Dashboard = lazy(() => import('./pages/Dashboard'))
const SchoolsPage = lazy(() => import('./pages/SchoolsPage'))
const AnalysisList = lazy(() => import('./pages/AnalysisList'))
const AnalysisNew = lazy(() => import('./pages/AnalysisNew'))
const AnalysisReview = lazy(() => import('./pages/AnalysisReview'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))

// Loader componente
function PageLoader() {
  return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading, showRegionalSelector } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (showRegionalSelector) return <RegionalSelector />
  return children
}

export default function App() {
  return (
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={
                  <RequireAuth><AppLayout /></RequireAuth>
                }>
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
                  <Route path="visitas/:visitId" element={<VisitaDetailPage />} />
                  <Route path="visitas/:visitId/sessoes/:sessionId" element={<SessaoPage />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster position="bottom-right" toastOptions={{
            style: { fontFamily: 'DM Sans, sans-serif', fontSize: 13 }
          }} />
        </AuthProvider>
      </ThemeProvider>
  )
}