// src/contexts/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode')
        return saved !== null ? saved === 'true' : false
    })

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode)
        localStorage.setItem('darkMode', darkMode)
    }, [darkMode])

    const toggleDarkMode = () => setDarkMode(prev => !prev)

    return (
        <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)