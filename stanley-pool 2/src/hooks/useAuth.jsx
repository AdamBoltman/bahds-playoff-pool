import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, ADMIN_EMAIL } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      }
    })
    return { error }
  }

  const signOut = () => supabase.auth.signOut()

  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
