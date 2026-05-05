import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { scanForCrisis, shouldEscalate, CRISIS_RESOURCES } from '../lib/crisisKeywords'
import type { Message, RiskLevel, VoiceFeatures } from '../lib/types'

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
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voiceConsented, setVoiceConsented] = useState(() =>
    localStorage.getItem('nevaeh_voice_consent') === 'true'
  )
  const [showVoiceConsent, setShowVoiceConsent] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // Prosodic tracking
  const energySamplesRef = useRef<number[]>([])
  const wordCountRef = useRef(0)
  const pauseCountRef = useRef(0)
  const silenceStartRef = useRef<number | null>(null)
  const recordingStartRef = useRef<number>(0)
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

  async function callChat(sessId: string, userMessageContent: string | null, clientRisk: RiskLevel, voiceFeatures?: VoiceFeatures) {
    setThinking(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) throw new Error('not authenticated')

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          session_id: sessId,
          user_message: userMessageContent,
          client_risk_level: clientRisk,
          ...(voiceFeatures ? { voice_features: voiceFeatures } : {})
        })
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: 'unknown' }))
        throw new Error(body.error || `Edge function error ${resp.status}`)
      }

      const data = await resp.json()

      // Slow mode: if NEVAEH signals a pause, keep the thinking indicator
      // visible for that duration before revealing her response.
      // High-distress inputs get 6-8 seconds — the presence that was always
      // there now has time to land.
      if (data.pause_ms > 0) {
        await new Promise(r => setTimeout(r, data.pause_ms))
      }

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

  async function startRecording() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Voice input requires Chrome, Edge, or Safari.')
      return
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream
    recordingStartRef.current = Date.now()
    energySamplesRef.current = []
    wordCountRef.current = 0
    pauseCountRef.current = 0
    silenceStartRef.current = null

    // Web Audio for prosodic features
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser

    // Sample energy every 100ms
    const sampleInterval = setInterval(() => {
      if (!analyserRef.current) { clearInterval(sampleInterval); return }
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteTimeDomainData(buf)
      const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length)
      energySamplesRef.current.push(rms)
      // Pause detection: silence if rms < 5
      if (rms < 5) {
        if (!silenceStartRef.current) silenceStartRef.current = Date.now()
        else if (Date.now() - silenceStartRef.current > 1500) {
          pauseCountRef.current++
          silenceStartRef.current = null
        }
      } else {
        silenceStartRef.current = null
      }
    }, 100)

    // Web Speech for transcription
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) { final += t; wordCountRef.current += t.split(/\s+/).filter(Boolean).length }
        else interim += t
      }
      setTranscript(prev => prev + final)
      setInput(prev => (prev + final + interim).trim())
    }

    recognition.onerror = () => stopRecording(false)
    recognition.start()

    setRecording(true)
    // Store interval ref for cleanup
    ;(recognitionRef.current as any)._sampleInterval = sampleInterval
  }

  function stopRecording(submit = false) {
    const sampleInterval = (recognitionRef.current as any)?._sampleInterval
    if (sampleInterval) clearInterval(sampleInterval)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    audioContextRef.current?.close()
    audioContextRef.current = null
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    mediaStreamRef.current = null

    // Compute voice features
    const samples = energySamplesRef.current
    const avgEnergy = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0
    const maxEnergy = samples.length ? Math.max(...samples) : 0
    const durationMs = Date.now() - recordingStartRef.current
    const words = wordCountRef.current

    const energy: VoiceFeatures['energy'] = avgEnergy < 3 ? 'low' : avgEnergy < 8 ? 'moderate' : avgEnergy < 15 ? 'high' : 'dysregulated'
    const rate: VoiceFeatures['rate'] = durationMs < 1000 ? 'normal' : words / (durationMs / 1000) < 1.5 ? 'slow' : words / (durationMs / 1000) > 3.5 ? 'fast' : 'normal'
    const pitchVariance: VoiceFeatures['pitch_variance'] = maxEnergy - avgEnergy < 2 ? 'flat' : maxEnergy - avgEnergy < 8 ? 'normal' : 'variable'

    const features: VoiceFeatures = {
      energy,
      rate,
      pauses: pauseCountRef.current,
      pitch_variance: pitchVariance,
      duration_ms: durationMs
    }

    setRecording(false)
    setTranscript('')

    if (submit) {
      // Submit with voice features
      const content = input.trim()
      if (content && sessionId) {
        handleSendWithVoice(content, features)
      }
    }
  }

  async function handleSendWithVoice(content: string, voiceFeatures: VoiceFeatures) {
    setSending(true)
    setInput('')
    setError(null)

    const scan = scanForCrisis(content)
    const newRisk = shouldEscalate(sessionRisk, scan.level)
    setSessionRisk(newRisk)
    if (scan.level === 'red') setCrisisOverlay(true)

    await callChat(sessionId!, content, scan.level, voiceFeatures)
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
          Authorization: `Bearer ${authSession.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
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
          <Link to="/moments" className="btn-ghost">Moments</Link>
          <Link to="/settings" className="btn-ghost">Settings</Link>
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
          {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
            <button
              type="button"
              onClick={() => {
                if (recording) { stopRecording(true) }
                else if (!voiceConsented) { setShowVoiceConsent(true) }
                else { startRecording() }
              }}
              disabled={sending || thinking}
              className={`btn-ghost px-3 ${recording ? 'text-accent-primary animate-pulse' : 'text-text-muted'}`}
              aria-label={recording ? 'Stop and send' : 'Voice input'}
            >
              {recording ? '⏹' : '🎙'}
            </button>
          )}
          <button type="submit" disabled={!input.trim() || sending || thinking} className="btn-primary">
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Voice consent modal */}
      {showVoiceConsent && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card max-w-md w-full">
            <h2 className="font-display text-xl text-accent-primary mb-3">Before I can hear you</h2>
            <p className="text-text-secondary leading-relaxed mb-4 text-sm">
              When you use voice, I'll hear your words and also notice how you sound — your pace, energy, and whether you go quiet. I analyze these immediately and then discard the audio. I never store recordings. Only the words you said and a few numbers about tone are saved.
            </p>
            <p className="text-text-muted text-xs mb-6">You can turn this off anytime in Settings.</p>
            <div className="flex gap-2">
              <button onClick={() => {
                localStorage.setItem('nevaeh_voice_consent', 'true')
                setVoiceConsented(true)
                setShowVoiceConsent(false)
                startRecording()
              }} className="btn-primary flex-1">I understand — use voice</button>
              <button onClick={() => setShowVoiceConsent(false)} className="btn-ghost">Not now</button>
            </div>
          </div>
        </div>
      )}

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
