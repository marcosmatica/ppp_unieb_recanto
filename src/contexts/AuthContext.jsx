// src/contexts/AuthContext.jsx (modificado)
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, googleProvider, functions } from '../services/firebase'
import { REGIONALS } from '../constants/regionals' // Importar regionais

const AuthContext = createContext(null)

// src/contexts/AuthContext.jsx

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      try {
        if (!firebaseUser) {
          setUser(null)
          setProfile(null)
          setUnauthorized(false)
          setLoading(false)
          return
        }

        const ref  = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)

        if (!snap.exists()) {
          // Tenta reivindicar convite pendente pelo email
          try {
            const claim = httpsCallable(functions, 'claimInvite')
            await claim({})
            const snap2 = await getDoc(ref)
            if (snap2.exists()) {
              setUser(firebaseUser)
              setProfile({ uid: firebaseUser.uid, ...snap2.data() })
              setUnauthorized(false)
              setLoading(false)
              return
            }
          } catch (e) {
            // sem convite ou falha — segue fluxo de não autorizado
          }
          await signOut(auth)
          setUser(null)
          setProfile(null)
          setUnauthorized(true)
          setLoading(false)
          return
        }

        setUser(firebaseUser)
        setProfile({ uid: firebaseUser.uid, ...snap.data() })
        setUnauthorized(false)
      } catch (err) {
        console.error("Erro ao carregar perfil:", err)
        setUser(null)
        setProfile(null)
        setUnauthorized(false)
      }

      setLoading(false)
    })
  }, [])

  const login = async () => {
    try {
      setUnauthorized(false)
      const result = await signInWithPopup(auth, googleProvider)
      return result
    } catch (err) {
      console.error("Erro login:", err)
      throw err
    }
  }

  const logout = () => {
    setUnauthorized(false)
    return signOut(auth)
  }

  return (
      <AuthContext.Provider value={{
        user, profile, loading, login, logout,
        unauthorized,
        showRegionalSelector: false,
        completeProfile: async () => {},
      }}>
        {children}
      </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)