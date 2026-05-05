import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Session, SessionSummary } from '../lib/types'

interface GrowthArc {
  anchor_phrases?: string[]
  themes?: string[]
  total_sessions?: number
}

interface Formulation {
  presenting_concerns?: string | null
  core_patterns?: string | null
  strengths?: string | null
  working_hypothesis?: string | null
  what_has_helped?: string | null
  what_has_not_helped?: string | null
  next_focus?: string | null
}

interface Profile {
  total_sessions: number
  identity_graph?: Record<string, unknown> | null
}

interface BreakthroughEntry {
  text: string
  date: string
}

export default function Moments() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [anchors, setAnchors] = useState<string[]>([])
  const [breakthroughs, setBreakthroughs] = useState<BreakthroughEntry[]>([])
  const [formulation, setFormulation] = useState<Formulation | null>(null)
  const [arc, setArc] = useState<GrowthArc | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)

    // Fetch in parallel — all independent
    const [arcResult, sessionsResult, formulationResult, profileResult] = await Promise.all([
      supabase
        .from('growth_arc')
        .select('arc')
        .eq('user_id', user!.id)
        .maybeSingle(),
      supabase
        .from('sessions')
        .select('id, started_at, ended_at, summary')
        .eq('user_id', user!.id)
        .eq('is_active', false)
        .not('summary', 'is', null)
        .order('started_at', { ascending: true }),
      supabase
        .from('formulation')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('total_sessions, identity_graph')
        .eq('id', user!.id)
        .maybeSingle(),
    ])

    // Growth arc
    const arcData = arcResult.data?.arc as GrowthArc | undefined
    setArc(arcData ?? null)
    setAnchors(arcData?.anchor_phrases ?? [])

    // Breakthroughs — extracted from each completed session
    const sessions = (sessionsResult.data ?? []) as Pick<Session, 'id' | 'started_at' | 'ended_at' | 'summary'>[]
    const allBreakthroughs: BreakthroughEntry[] = []
    for (const s of sessions) {
      const summary = s.summary as SessionSummary | null
      const items = summary?.breakthroughs
      if (Array.isArray(items) && items.length > 0) {
        const date = new Date(s.started_at).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
        for (const b of items) {
          if (typeof b === 'string' && b.trim()) {
            allBreakthroughs.push({ text: b.trim(), date })
          }
        }
      }
    }
    setBreakthroughs(allBreakthroughs)

    // Formulation
    const f = formulationResult.data as Formulation | null
    setFormulation(f)

    // Profile
    const p = profileResult.data as Profile | null
    setProfile(p)

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">Gathering what matters...</div>
      </div>
    )
  }

  const totalSessions = profile?.total_sessions ?? 0
  const themes = arc?.themes ?? []

  // Arc summary sentences
  const arcSentences: string[] = []
  if (totalSessions > 0) {
    arcSentences.push(
      totalSessions === 1
        ? "We've talked once."
        : `We've talked ${totalSessions} time${totalSessions === 1 ? '' : 's'}.`
    )
  }
  if (themes.length > 0) {
    arcSentences.push(
      `The themes that come up most: ${themes.join(', ')}.`
    )
  }
  if (anchors.length > 0) {
    arcSentences.push(
      anchors.length === 1
        ? "I've been holding one of your words."
        : `I've been holding ${anchors.length} of your words.`
    )
  }

  // Formulation field mapping
  const formulationFields: { key: keyof Formulation; label: string }[] = [
    { key: 'presenting_concerns', label: 'What brings you here' },
    { key: 'core_patterns', label: 'Patterns I\'ve noticed' },
    { key: 'strengths', label: 'What I see in you' },
    { key: 'working_hypothesis', label: 'What I think is underneath' },
    { key: 'what_has_helped', label: 'What\'s been helping' },
    { key: 'what_has_not_helped', label: 'What hasn\'t landed' },
    { key: 'next_focus', label: 'What I\'m holding for next time' },
  ]

  const hasFormulationData = formulation !== null &&
    formulationFields.some(f => formulation[f.key])

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="glass border-b border-border-subtle px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link to="/" className="font-display font-light tracking-[0.1em] text-sm glow-text">
          NEVAEH
        </Link>
        <nav className="flex items-center gap-2 text-xs">
          <Link to="/journey" className="btn-ghost">Journey</Link>
          <Link to="/session" className="btn-ghost">Session</Link>
          <Link to="/settings" className="btn-ghost">Settings</Link>
          <button onClick={() => signOut()} className="btn-ghost text-text-muted">Sign out</button>
        </nav>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 space-y-16">
        {/* Page title */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl tracking-wide glow-text">Your Moments</h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase">The things worth keeping.</p>
        </div>

        {/* Section 1 — Your Words */}
        <section className="space-y-6">
          <h2
            className="font-display text-xs uppercase tracking-widest text-text-muted border-b border-border-subtle pb-3"
          >
            Your Words
          </h2>

          {anchors.length === 0 ? (
            <p className="text-text-secondary text-sm italic">
              Your breakthroughs will appear here as we talk.
            </p>
          ) : (
            <ul className="space-y-5">
              {anchors.map((phrase, i) => (
                <li
                  key={i}
                  className="glass rounded-2xl px-8 py-7 text-center border border-accent-primary/20"
                  style={{ boxShadow: '0 0 24px rgba(191,64,255,0.06)' }}
                >
                  <p className="font-display text-xl text-text-primary italic leading-relaxed">
                    &ldquo;{phrase}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 2 — Breakthrough Moments */}
        <section className="space-y-6">
          <h2
            className="font-display text-xs uppercase tracking-widest text-text-muted border-b border-border-subtle pb-3"
          >
            Breakthrough Moments
          </h2>

          {breakthroughs.length === 0 ? (
            <p className="text-text-secondary text-sm italic">
              Your breakthroughs will appear here as we talk.
            </p>
          ) : (
            <ul className="space-y-4">
              {breakthroughs.map((b, i) => (
                <li key={i} className="glass rounded-2xl px-6 py-5 space-y-2">
                  <p className="text-xs text-text-muted tracking-wide">{b.date}</p>
                  <p className="text-text-primary leading-relaxed">{b.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 3 — How NEVAEH understands you */}
        <section className="space-y-6">
          <h2
            className="font-display text-xs uppercase tracking-widest text-text-muted border-b border-border-subtle pb-3"
          >
            How NEVAEH understands you
          </h2>

          {!hasFormulationData ? (
            <p className="text-text-secondary text-sm italic">
              As we talk, I'll build a picture of who you are and what you're carrying. It will appear here.
            </p>
          ) : (
            <div className="space-y-5">
              {formulationFields.map(({ key, label }) => {
                const value = formulation?.[key]
                if (!value) return null
                return (
                  <div key={key} className="glass rounded-2xl px-6 py-5 space-y-2">
                    <p className="text-xs text-text-muted tracking-widest uppercase">{label}</p>
                    <p className="text-text-primary leading-relaxed">{value}</p>
                  </div>
                )
              })}
              <p className="text-text-secondary text-xs italic pt-2">
                This is how I'm understanding you right now. If anything here feels off, tell me in our next session and I'll update it.
              </p>
            </div>
          )}
        </section>

        {/* Section 4 — Your Arc */}
        <section className="space-y-6">
          <h2
            className="font-display text-xs uppercase tracking-widest text-text-muted border-b border-border-subtle pb-3"
          >
            Your Arc
          </h2>

          {arcSentences.length === 0 ? (
            <p className="text-text-secondary text-sm italic">
              Your arc will take shape as we keep talking.
            </p>
          ) : (
            <div className="glass rounded-2xl px-7 py-6">
              <p className="text-text-primary leading-loose">
                {arcSentences.join(' ')}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
