// src/contexts/AuthContext.jsx (modificado)
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'
import { REGIONALS } from '../constants/regionals' // Importar regionais

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showRegionalSelector, setShowRegionalSelector] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser)

          const ref = doc(db, 'users', firebaseUser.uid)
          const snap = await getDoc(ref)

          if (snap.exists()) {
            setProfile(snap.data())
          } else {
            // Novo usuário - precisa selecionar a CRE
            setShowRegionalSelector(true)
            setProfile(null)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err)
        setProfile(null)
      }

      setLoading(false)
    })
  }, [])

  const completeProfile = async (selectedCre) => {
    if (!user) return

    const newProfile = {
      name: user.displayName,
      email: user.email,
      cre: selectedCre, // Usar a CRE selecionada
      role: 'analyst',
      createdAt: new Date()
    }

    const ref = doc(db, 'users', user.uid)
    await setDoc(ref, newProfile)
    setProfile(newProfile)
    setShowRegionalSelector(false)
  }

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      return result
    } catch (err) {
      console.error("Erro login:", err)
      throw err
    }
  }

  const logout = () => signOut(auth)

  return (
      <AuthContext.Provider value={{
        user, profile, loading, login, logout,
        showRegionalSelector, completeProfile
      }}>
        {children}
      </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)