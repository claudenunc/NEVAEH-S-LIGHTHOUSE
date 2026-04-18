import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Session } from '../lib/types'

export default function Journey() {
  const { user, signOut } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [anchors, setAnchors] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user!.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })

    setSessions((data as Session[]) ?? [])

    const { data: arc } = await supabase
      .from('growth_arc')
      .select('arc')
      .eq('user_id', user!.id)
      .maybeSingle()

    const arcData = arc?.arc as { anchor_phrases?: string[] } | undefined
    setAnchors(arcData?.anchor_phrases ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">Gathering your story...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Top nav — consistent with Session page */}
      <header className="glass border-b border-border-subtle px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link to="/" className="font-display font-light tracking-[0.1em] text-sm glow-text">
          NEVAEH
        </Link>
        <nav className="flex items-center gap-2 text-xs">
          <Link to="/session" className="btn-ghost">Session</Link>
          <Link to="/settings" className="btn-ghost">Settings</Link>
          <button onClick={() => signOut()} className="btn-ghost text-text-muted">Sign out</button>
        </nav>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl">Your journey</h1>
          <p className="text-text-secondary text-sm">
            {sessions.length === 0
              ? 'No completed sessions yet. After your first session ends, it will live here.'
              : `${sessions.length} session${sessions.length === 1 ? '' : 's'} held.`}
          </p>
          {user?.email && (
            <p className="text-xs text-text-muted">Signed in as {user.email}</p>
          )}
        </header>

        {anchors.length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-display text-lg text-accent-primary">Your own wisdom</h2>
            <p className="text-text-secondary text-sm">Words you said that we're holding for you.</p>
            <ul className="space-y-2 mt-2">
              {anchors.map((phrase, i) => (
                <li key={i} className="text-text-primary italic border-l-2 border-accent-primary/40 pl-4 py-1">
                  "{phrase}"
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          {sessions.map((s) => {
            const date = new Date(s.started_at).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })
            const isOpen = expanded === s.id
            return (
              <article
                key={s.id}
                className="glass rounded-2xl p-5"
                aria-expanded={isOpen}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full text-left"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="text-text-secondary text-sm">{date}</div>
                      <div className="font-display text-lg mt-1">
                        {s.summary?.summary ?? 'A session held with care.'}
                      </div>
                    </div>
                    {s.entered_red && (
                      <span className="text-xs px-2 py-1 rounded-full bg-accent-warm/20 text-accent-warm border border-accent-warm/30">
                        held through crisis
                      </span>
                    )}
                  </div>

                  {s.summary?.emotional_tags && s.summary.emotional_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {s.summary.emotional_tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 rounded-full bg-accent-primary/15 text-accent-primary border border-accent-primary/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {isOpen && s.summary && (
                  <div className="mt-4 pt-4 border-t border-border-subtle space-y-3 text-sm">
                    {s.summary.themes_surfaced && s.summary.themes_surfaced.length > 0 && (
                      <div>
                        <div className="text-text-secondary mb-1">Themes</div>
                        <div className="text-text-primary">{s.summary.themes_surfaced.join(' · ')}</div>
                      </div>
                    )}
                    {s.summary.breakthroughs && s.summary.breakthroughs.length > 0 && (
                      <div>
                        <div className="text-text-secondary mb-1">Breakthroughs</div>
                        <ul className="list-disc list-inside text-text-primary space-y-1">
                          {s.summary.breakthroughs.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}
                    {s.summary.plant_for_next_session && (
                      <div>
                        <div className="text-text-secondary mb-1">What NEVAEH is holding for you</div>
                        <div className="text-text-primary italic">{s.summary.plant_for_next_session}</div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}

// (main max-w wrapper closed above)
