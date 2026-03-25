// src/pages/LoginPage.jsx
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn } from 'lucide-react'
import './LoginPage.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  async function handleLogin() {
    try {
      await login()
      navigate('/dashboard')
    } catch { /* erro de login */ }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">PPP</div>
          <div>
            <h1 className="login-title">Analisador de PPP</h1>
            <p className="login-sub">SEEDF · Distrito Federal</p>
          </div>
        </div>
        <p className="login-desc">
          Plataforma de análise e validação de Projetos Político-Pedagógicos
          conforme a Portaria SEEDF nº 139/2024 e Portaria 174/2026.
        </p>
        <button className="login-btn" onClick={handleLogin}>
          <LogIn size={17}/>
          Entrar com conta Google (SEEDF)
        </button>
      </div>
    </div>
  )
}
