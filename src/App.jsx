// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import AnalysisReview from './pages/AnalysisReview'
import AnalysisList from './pages/AnalysisList'
import AnalysisNew from './pages/AnalysisNew'
import ReportPage from './pages/ReportPage'
import LoginPage from './pages/LoginPage'
import SchoolsPage from './pages/SchoolsPage'
import './styles/globals.css'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loader"><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <RequireAuth><AppLayout /></RequireAuth>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"           element={<Dashboard />} />
            <Route path="schools"             element={<SchoolsPage />} />
            <Route path="analyses"            element={<AnalysisList />} />
            <Route path="analyses/new"        element={<AnalysisNew />} />
            <Route path="analyses/:analysisId" element={<AnalysisReview />} />
            <Route path="analyses/:analysisId/report" element={<ReportPage />} />
            <Route path="reports"  element={<div>Reports — em breve</div>} />
            <Route path="settings" element={<div>Settings — em breve</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{
        style: { fontFamily: 'DM Sans, sans-serif', fontSize: 13 }
      }}/>
    </AuthProvider>
  )
}
