// src/components/ThemeToggle.jsx
import { useTheme } from '../contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import './ThemeToggle.css'

export default function ThemeToggle() {
    const { darkMode, toggleDarkMode } = useTheme()
    return (
        <button className="theme-toggle" onClick={toggleDarkMode} title="Alternar tema">
            {darkMode
                ? <Sun size={15} className="theme-toggle__icon" />
                : <Moon size={15} className="theme-toggle__icon" />}
            <span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
    )
}