// src/components/ThemeToggle.jsx
import { useTheme } from '../contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import './ThemeToggle.css'

export default function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button className="theme-toggle" onClick={toggle} title="Alternar tema">
      {dark
        ? <Sun size={15} className="theme-toggle__icon" />
        : <Moon size={15} className="theme-toggle__icon" />}
      <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>
    </button>
  )
}
