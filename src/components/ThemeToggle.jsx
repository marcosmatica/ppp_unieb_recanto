// src/components/ThemeToggle.jsx
import { useTheme } from '../contexts/ThemeContext'
import { Moon, Sun } from 'lucide-react'
import './ThemeToggle.css'

export default function ThemeToggle() {
    const { darkMode, toggleDarkMode } = useTheme()

    return (
        <button
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span className="theme-toggle-text">
        {darkMode ? 'Tema claro' : 'Tema escuro'}
      </span>
        </button>
    )
}