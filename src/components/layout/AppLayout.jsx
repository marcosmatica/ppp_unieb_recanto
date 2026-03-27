// src/components/layout/AppLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, School, FolderOpen,
  FileText, Settings, LogOut, ChevronRight
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import ThemeToggle from '../ThemeToggle'
import './AppLayout.css'

const NAV = [
  { to: '/dashboard',  label: 'Painel',         icon: LayoutDashboard },
  { to: '/schools',    label: 'Escolas',         icon: School },
  { to: '/analyses',   label: 'Análises',        icon: FolderOpen },
  { to: '/reports',    label: 'Pareceres',       icon: FileText },
  { to: '/settings',   label: 'Configurações',   icon: Settings },
]

export default function AppLayout() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
    toast.success('Sessão encerrada')
  }

  return (
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-mark">PPP</div>
            <div>
              <p className="brand-name">Analisador</p>
              <p className="brand-sub">SEEDF · DF</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                }>
                  <Icon size={17} />
                  <span>{label}</span>
                  <ChevronRight size={13} className="nav-arrow" />
                </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <ThemeToggle />

            {profile && (
                <div className="user-info">
                  <div className="user-avatar">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt={profile.name} />
                    ) : (
                        <span>{profile.name?.[0] ?? '?'}</span>
                    )}
                  </div>
                  <div className="user-meta">
                    <p className="user-name">{profile.name}</p>
                    <p className="user-cre">{profile.cre}</p>
                  </div>
                </div>
            )}

            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={15} />
              Sair
            </button>
          </div>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
  )
}