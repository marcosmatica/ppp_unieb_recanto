// src/components/ThemeToggle.jsx
import { useTheme } from '../contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import './ThemeToggle.css'

export default function ThemeToggle() {
    const { darkMode, toggleDarkMode } = useTheme()

    return (
        <button className="theme-toggle" onClick={toggleDarkMode} aria-label="Alternar tema">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
    )
}