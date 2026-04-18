import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, Session as AuthSession } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface SignUpConsent {
  version: string
  acceptedAt: string // ISO timestamp
}

interface AuthContextValue {
  user: User | null
  session: AuthSession | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    displayName: string | undefined,
    consent: SignUpConsent
  ) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp(
    email: string,
    password: string,
    displayName: string | undefined,
    consent: SignUpConsent
  ) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...(displayName ? { display_name: displayName } : {}),
          consent_version: consent.version,
          consent_accepted_at: consent.acceptedAt
        }
      }
    })
    return { error: error?.message ?? null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
