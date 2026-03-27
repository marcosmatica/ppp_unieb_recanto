// src/pages/SettingsPage.jsx
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { LogOut, Moon, Sun, User, Mail, MapPin, Bell, BellOff } from 'lucide-react'
import toast from 'react-hot-toast'
import './SettingsPage.css'

export default function SettingsPage() {
    const { user, profile, logout } = useAuth()
    const { darkMode, toggleDarkMode } = useTheme()
    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('notifications')
        return saved !== null ? saved === 'true' : true
    })

    const handleLogout = async () => {
        try {
            await logout()
            toast.success('Logout realizado com sucesso')
        } catch (err) {
            toast.error('Erro ao sair')
        }
    }

    const handleNotificationsToggle = () => {
        const newValue = !notifications
        setNotifications(newValue)
        localStorage.setItem('notifications', newValue)
        toast.success(newValue ? 'Notificações ativadas' : 'Notificações desativadas')
    }

    return (
        <div className="page settings-page">
            <div className="page-header">
                <h1 className="page-title">Configurações</h1>
                <p className="page-sub">Preferências e informações da conta</p>
            </div>

            <div className="settings-grid">
                {/* Perfil */}
                <div className="settings-card">
                    <div className="card-header">
                        <User size={18} />
                        <h2>Perfil</h2>
                    </div>
                    <div className="profile-info">
                        <div className="info-row">
                            <span className="info-label">Nome</span>
                            <span className="info-value">{profile?.name || user?.displayName || '—'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">E-mail</span>
                            <span className="info-value">{user?.email || '—'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">CRE</span>
                            <span className="info-value">{profile?.cre || '—'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Função</span>
                            <span className="info-value">{profile?.role === 'analyst' ? 'Analista' : 'Administrador'}</span>
                        </div>
                    </div>
                </div>

                {/* Aparência */}
                <div className="settings-card">
                    <div className="card-header">
                        {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                        <h2>Aparência</h2>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Tema</span>
                            <span className="setting-description">
                {darkMode ? 'Escuro' : 'Claro'}
              </span>
                        </div>
                        <button className="theme-toggle-btn" onClick={toggleDarkMode}>
                            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                            {darkMode ? 'Modo claro' : 'Modo escuro'}
                        </button>
                    </div>
                </div>

                {/* Notificações */}
                <div className="settings-card">
                    <div className="card-header">
                        {notifications ? <Bell size={18} /> : <BellOff size={18} />}
                        <h2>Notificações</h2>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Alertas e lembretes</span>
                            <span className="setting-description">
                Receber notificações sobre análises e pareceres
              </span>
                        </div>
                        <button
                            className={`notification-toggle ${notifications ? 'on' : 'off'}`}
                            onClick={handleNotificationsToggle}
                        >
                            {notifications ? 'Ativado' : 'Desativado'}
                        </button>
                    </div>
                </div>

                {/* Sessão */}
                <div className="settings-card danger-zone">
                    <div className="card-header">
                        <LogOut size={18} />
                        <h2>Sessão</h2>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Sair da conta</span>
                            <span className="setting-description">
                Encerrar sessão atual
              </span>
                        </div>
                        <button className="logout-btn" onClick={handleLogout}>
                            <LogOut size={16} /> Sair
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}