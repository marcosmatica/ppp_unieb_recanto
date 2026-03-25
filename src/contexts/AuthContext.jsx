// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)  // dados /users/{uid}
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
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
            const newProfile = {
              name: firebaseUser.displayName,
              email: firebaseUser.email,
              cre: 'CRE-01',
              role: 'analyst',
              createdAt: new Date()
            }

            await setDoc(ref, newProfile)
            setProfile(newProfile)
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
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
