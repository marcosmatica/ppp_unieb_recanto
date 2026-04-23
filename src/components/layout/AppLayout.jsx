// src/components/layout/AppLayout.jsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, School, FolderOpen, FileText, Settings, LogOut,
  ChevronRight, Home, BarChart2, Menu, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import ThemeToggle from '../ThemeToggle'
import './AppLayout.css'

const NAV = [
  { to: '/dashboard',        label: 'Painel',         icon: LayoutDashboard },
  { to: '/schools',          label: 'Escolas',         icon: School },
  { to: '/analyses',         label: 'Análises',        icon: FolderOpen },
  { to: '/visitas',          label: 'Visitas EI',      icon: Home },
  { to: '/visitas/dashboard',label: 'Dashboard EI',    icon: BarChart2 },
  { to: '/reports',          label: 'Pareceres',       icon: FileText },
  { to: '/settings',         label: 'Configurações',   icon: Settings },
]

const SIDEBAR_DEFAULT = 280
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const MOBILE_BREAKPOINT = 768

function useSidebarResize(defaultWidth) {
  const [width, setWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = width
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      const delta = ev.clientX - startX.current
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width])

  return [width, onMouseDown, isDragging]
}

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

export default function AppLayout() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [sidebarW, onSidebarDrag, sidebarDragging] = useSidebarResize(SIDEBAR_DEFAULT)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (mobileOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [mobileOpen, isMobile])

  async function handleLogout() {
    await logout()
    navigate('/login')
    toast.success('Sessão encerrada')
  }

  const sidebarStyle = isMobile
    ? undefined
    : { width: sidebarW, minWidth: sidebarW }

  return (
    <div className={`app-layout${isMobile ? ' app-layout--mobile' : ''}`}>
      {isMobile && (
        <button
          className={`sidebar-toggle${mobileOpen ? ' sidebar-toggle--open' : ''}`}
          onClick={() => setMobileOpen(v => !v)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          <span className="sidebar-toggle__icon">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </span>
        </button>
      )}

      {isMobile && mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={
          `sidebar` +
          (sidebarDragging ? ' sidebar--dragging' : '') +
          (isMobile ? ' sidebar--mobile' : '') +
          (isMobile && mobileOpen ? ' sidebar--open' : '')
        }
        style={sidebarStyle}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">PPP</div>
          <div>
            <p className="brand-name">Analisador</p>
            <p className="brand-sub">SEEDF · DF</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/visitas'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
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

        {!isMobile && (
          <div
            className={`sidebar-resize-border${sidebarDragging ? ' sidebar-resize-border--active' : ''}`}
            onMouseDown={onSidebarDrag}
          />
        )}
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
