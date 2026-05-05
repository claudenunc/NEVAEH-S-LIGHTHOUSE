import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
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

async function postAuthEvent(accessToken: string, event: 'signup' | 'signin') {
  // Fire-and-forget — never throw, never bubble errors to the UI.
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ event })
    })
  } catch {
    // intentional: notifications must not break auth UX
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  // Hint set when the user explicitly calls signUp/signIn from our wrappers.
  // The actual notification fires from onAuthStateChange (which catches
  // both auto-signed-up users AND email-confirmation-flow signins).
  const pendingAuthHint = useRef<'signup' | 'signin' | null>(null)

  // Dedupe — we only want to notify ONCE per user_id per page load,
  // not on every token refresh / tab focus event Supabase fires.
  const notifiedUserIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      // Mark existing session as already-notified so a page reload doesn't ping Nathan.
      if (data.session?.user?.id) {
        notifiedUserIds.current.add(data.session.user.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      // Only fire on genuine SIGNED_IN events with a fresh session.
      // Skip INITIAL_SESSION (page load with existing session) and TOKEN_REFRESHED.
      if (event === 'SIGNED_IN' && newSession?.user?.id && newSession.access_token) {
        const userId = newSession.user.id
        if (notifiedUserIds.current.has(userId)) return
        notifiedUserIds.current.add(userId)

        const hint = pendingAuthHint.current ?? 'signin'
        pendingAuthHint.current = null
        postAuthEvent(newSession.access_token, hint)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp(
    email: string,
    password: string,
    displayName: string | undefined,
    consent: SignUpConsent
  ) {
    pendingAuthHint.current = 'signup'
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://nevaeh-s-lighthouse.vercel.app',
        data: {
          ...(displayName ? { display_name: displayName } : {}),
          consent_version: consent.version,
          consent_accepted_at: consent.acceptedAt
        }
      }
    })
    if (error) pendingAuthHint.current = null
    return { error: error?.message ?? null }
  }

  async function signIn(email: string, password: string) {
    pendingAuthHint.current = 'signin'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) pendingAuthHint.current = null
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
