// src/pages/SettingsPage.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { usePermissoes } from '../hooks/usePermissoes'
import { functions, db } from '../services/firebase'
import { httpsCallable } from 'firebase/functions'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { REGIONALS } from '../constants/regionals'
import { LogOut, Moon, Sun, User, Bell, BellOff, Users, UserPlus, Mail, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import './SettingsPage.css'

export default function SettingsPage() {
    const { user, profile, logout } = useAuth()
    const { darkMode, toggleDarkMode } = useTheme()
    const { isAdmin } = usePermissoes()
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
                            <span className="info-value">{profile?.role === 'analyst' ? 'Analista' : profile?.role === 'supervisor' ? 'Supervisor' : 'Administrador'}</span>
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="card-header">
                        {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                        <h2>Aparência</h2>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Tema</span>
                            <span className="setting-description">{darkMode ? 'Escuro' : 'Claro'}</span>
                        </div>
                        <button className="theme-toggle-btn" onClick={toggleDarkMode}>
                            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                            {darkMode ? 'Modo claro' : 'Modo escuro'}
                        </button>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="card-header">
                        {notifications ? <Bell size={18} /> : <BellOff size={18} />}
                        <h2>Notificações</h2>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Alertas e lembretes</span>
                            <span className="setting-description">Receber notificações sobre análises e pareceres</span>
                        </div>
                        <button
                            className={`notification-toggle ${notifications ? 'on' : 'off'}`}
                            onClick={handleNotificationsToggle}
                        >
                            {notifications ? 'Ativado' : 'Desativado'}
                        </button>
                    </div>
                </div>

                {isAdmin && <UsersCard defaultCre={profile?.cre} />}

                <div className="settings-card danger-zone">
                    <div className="card-header">
                        <LogOut size={18} />
                        <h2>Sessão</h2>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Sair da conta</span>
                            <span className="setting-description">Encerrar sessão atual</span>
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

function UsersCard({ defaultCre }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('analyst')
    const [cre, setCre] = useState(defaultCre || 'REmas')
    const [sending, setSending] = useState(false)
    const [invites, setInvites] = useState([])

    useEffect(() => {
        const q = query(collection(db, 'pending_invites'), orderBy('createdAt', 'desc'))
        return onSnapshot(q, snap => {
            setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }, err => console.error('invites', err))
    }, [])

    const handleInvite = async (e) => {
        e.preventDefault()
        if (sending) return
        setSending(true)
        try {
            const fn = httpsCallable(functions, 'inviteUser')
            const res = await fn({ name: name.trim(), email: email.trim(), role, cre })
            if (res.data?.emailSent === false) {
                toast.success('Convite salvo (SMTP não configurado)')
            } else {
                toast.success('Convite enviado por email')
            }
            setName(''); setEmail('')
        } catch (err) {
            toast.error(err.message || 'Erro ao convidar')
        } finally {
            setSending(false)
        }
    }

    const handleRevoke = async (inviteEmail) => {
        if (!confirm(`Revogar convite de ${inviteEmail}?`)) return
        try {
            const fn = httpsCallable(functions, 'revokeInvite')
            await fn({ email: inviteEmail })
            toast.success('Convite revogado')
        } catch (err) {
            toast.error(err.message || 'Erro ao revogar')
        }
    }

    return (
        <div className="settings-card">
            <div className="card-header">
                <Users size={18} />
                <h2>Usuários do projeto</h2>
            </div>

            <form className="invite-form" onSubmit={handleInvite}>
                <div className="invite-grid">
                    <div className="field">
                        <label>Nome</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" required />
                    </div>
                    <div className="field">
                        <label>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@exemplo.com" required />
                    </div>
                    <div className="field">
                        <label>Função</label>
                        <select value={role} onChange={e => setRole(e.target.value)}>
                            <option value="analyst">Analista</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>CRE</label>
                        <select value={cre} onChange={e => setCre(e.target.value)}>
                            {REGIONALS.map(r => (
                                <option key={r.code} value={r.code}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button type="submit" className="invite-btn" disabled={sending}>
                    {sending ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                    {sending ? 'Enviando…' : 'Convidar usuário'}
                </button>
            </form>

            {invites.length > 0 && (
                <div className="invites-list">
                    <div className="invites-list-title">Convites pendentes ({invites.length})</div>
                    {invites.map(inv => (
                        <div key={inv.id} className="invite-item">
                            <div className="invite-info">
                                <Mail size={14} />
                                <div>
                                    <div className="invite-name">{inv.name}</div>
                                    <div className="invite-meta">{inv.email} · {inv.role} · {inv.cre}</div>
                                </div>
                            </div>
                            <button className="invite-revoke" onClick={() => handleRevoke(inv.email)} title="Revogar convite">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
