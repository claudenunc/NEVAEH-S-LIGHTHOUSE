import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { scanForCrisis, shouldEscalate, CRISIS_RESOURCES } from '../lib/crisisKeywords'
import type { Message, RiskLevel } from '../lib/types'

export default function Session() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionRisk, setSessionRisk] = useState<RiskLevel>('none')
  const [crisisOverlay, setCrisisOverlay] = useState(false)
  const [ending, setEnding] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    initSession()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  async function initSession() {
    setInitializing(true)
    setError(null)

    // 1. Look for active session
    const { data: existing, error: findErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findErr) {
      setError('Could not open the door. Please refresh and try again.')
      setInitializing(false)
      return
    }

    let currentSessionId: string
    if (existing) {
      currentSessionId = existing.id
      // Load existing messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true })
      setMessages((msgs as Message[]) ?? [])
      // Compute initial session risk from messages
      let risk: RiskLevel = 'none'
      for (const m of (msgs ?? []) as Message[]) {
        if (m.risk_level) risk = shouldEscalate(risk, m.risk_level)
      }
      setSessionRisk(risk)
      if (risk === 'red') setCrisisOverlay(true)
    } else {
      // Create new session
      const { data: created, error: insertErr } = await supabase
        .from('sessions')
        .insert({ user_id: user!.id })
        .select()
        .single()

      if (insertErr || !created) {
        setError('Could not start a session. Please try again.')
        setInitializing(false)
        return
      }
      currentSessionId = created.id
      // Trigger NEVAEH opening message via edge function
      await callChat(currentSessionId, null, 'none')
    }

    setSessionId(currentSessionId)
    setInitializing(false)
  }

  async function callChat(sessId: string, userMessageContent: string | null, clientRisk: RiskLevel) {
    setThinking(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) throw new Error('not authenticated')

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          session_id: sessId,
          user_message: userMessageContent,
          client_risk_level: clientRisk
        })
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: 'unknown' }))
        throw new Error(body.error || `Edge function error ${resp.status}`)
      }

      const data = await resp.json()

      // Reload messages from server (source of truth)
      const { data: refreshed } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessId)
        .order('created_at', { ascending: true })
      setMessages((refreshed as Message[]) ?? [])

      if (data.session_risk) {
        setSessionRisk(data.session_risk as RiskLevel)
        if (data.session_risk === 'red') setCrisisOverlay(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something interrupted our connection.'
      setError(msg)
    } finally {
      setThinking(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !sessionId || sending) return

    setSending(true)
    setInput('')
    setError(null)

    const scan = scanForCrisis(content)
    const newRisk = shouldEscalate(sessionRisk, scan.level)
    setSessionRisk(newRisk)
    if (scan.level === 'red') setCrisisOverlay(true)

    await callChat(sessionId, content, scan.level)
    setSending(false)
  }

  async function handleEnd() {
    if (!sessionId || ending) return
    setEnding(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) throw new Error('not authenticated')

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({ session_id: sessionId })
      })

      navigate('/journey', { replace: true })
    } catch (err) {
      setError('Could not save your session summary, but your conversation is safe. Try again.')
      setEnding(false)
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">NEVAEH is opening the door...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border-subtle px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link to="/" className="font-display font-light tracking-[0.1em] text-sm glow-text">
          NEVAEH
        </Link>
        <nav className="flex items-center gap-2 text-xs">
          <Link to="/journey" className="btn-ghost">Journey</Link>
          <button onClick={handleEnd} disabled={ending || messages.length < 2} className="btn-ghost">
            {ending ? 'Closing...' : 'End session'}
          </button>
          <button onClick={() => signOut()} className="btn-ghost text-text-muted">Sign out</button>
        </nav>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !thinking && (
            <div className="text-center text-text-secondary py-12">
              <p className="italic">Take a breath. She's here.</p>
            </div>
          )}

          {messages.filter(m => m.role !== 'system').map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={m.role === 'user' ? 'msg-user' : 'msg-nevaeh'}>
                {m.role === 'assistant' && (
                  <div className="text-[10px] uppercase tracking-widest text-accent-primary/70 mb-1">NEVAEH</div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="msg-nevaeh">
                <div className="text-[10px] uppercase tracking-widest text-accent-primary/70 mb-1">NEVAEH</div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="card border-accent-warm/30 text-sm text-accent-warm" role="alert">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <form onSubmit={handleSend} className="glass border-t border-border-subtle px-4 py-3 sticky bottom-0 z-20">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say what's true..."
            disabled={sending || thinking}
            className="input-field flex-1"
            autoComplete="off"
            aria-label="Your message"
          />
          <button type="submit" disabled={!input.trim() || sending || thinking} className="btn-primary">
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Crisis overlay */}
      {crisisOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crisis resources"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="card max-w-md w-full glow-purple">
            <h2 className="font-display text-xl text-accent-primary mb-2">I'm staying with you.</h2>
            <p className="text-text-primary leading-relaxed mb-4">
              What you said matters. Your life matters. Please reach out to a human right now — I'll be here when you come back.
            </p>
            <div className="space-y-2">
              {CRISIS_RESOURCES.filter(r => r.always).map(r => (
                <a key={r.name} href={r.href} className="block glass-hover rounded-xl px-4 py-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-accent-secondary mt-1">{r.contact}</div>
                </a>
              ))}
            </div>
            <button
              onClick={() => setCrisisOverlay(false)}
              className="btn-ghost w-full mt-4 text-sm"
            >
              I've got it — keep talking with NEVAEH
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
