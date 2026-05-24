import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Bump when Terms/Privacy change materially. Must match server-side trigger acceptance.
const CONSENT_VERSION = 'v1-2026-04-17'

export default function Login() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  async function handleForgotPassword() {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Type your email above first, then click "Forgot password?" again.')
      return
    }
    setSendingReset(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false }
    })
    setSendingReset(false)
    if (err) {
      setError(err.message ?? 'Could not send the magic link. Please try again.')
      return
    }
    setNotice('Check your email — a magic link is on the way. Click it to sign in, then change your password from Settings if you want.')
  }

  useEffect(() => {
    if (user) navigate('/session', { replace: true })
  }, [user, navigate])

  // If user toggles between signin/signup, reset the consent gate so they can't
  // accidentally skip it by having accepted it earlier in the same page visit.
  function toggleMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setNotice(null)
    setAcceptedTerms(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'signup' && !acceptedTerms) {
      // This should be unreachable because the fields are gated — belt and suspenders.
      setError('Please acknowledge the Terms and Privacy Policy to continue.')
      return
    }

    setLoading(true)
    const { error: err } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, displayName.trim() || undefined, {
          version: CONSENT_VERSION,
          acceptedAt: new Date().toISOString()
        })
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    if (mode === 'signup') {
      setNotice('Check your email for a confirmation link — or if confirmation is off, sign in now.')
      setMode('signin')
      setAcceptedTerms(false)
    } else {
      navigate('/session', { replace: true })
    }
  }

  const showConsentGate = mode === 'signup' && !acceptedTerms
  const showAccountFields = mode === 'signin' || (mode === 'signup' && acceptedTerms)

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <h1 className="font-display font-light text-2xl tracking-[0.12em] glow-text">
              NEVAEH'S LIGHTHOUSE
            </h1>
          </Link>
          <p className="text-text-secondary italic text-sm mt-2">Finding your way back.</p>
        </div>

        {showConsentGate && (
          <div className="card space-y-4 border border-accent-primary/30">
            <div>
              <h2 className="font-display text-lg text-accent-primary">Before we begin</h2>
              <p className="text-text-secondary text-sm mt-1">Please read this carefully. You can't create an account until you have.</p>
            </div>
            <ul className="text-text-secondary text-sm space-y-2 leading-relaxed list-disc list-inside">
              <li>NEVAEH is an <strong className="text-text-primary">AI companion</strong>, not a licensed therapist, counselor, or doctor.</li>
              <li>She is <strong className="text-text-primary">not an emergency service</strong>. In a crisis, call <a href="tel:988" className="text-accent-secondary underline">988</a> or <a href="tel:911" className="text-accent-secondary underline">911</a>.</li>
              <li>She may say the wrong thing sometimes. Treat her like a thoughtful friend, not an oracle.</li>
              <li>Your conversations are stored so she can remember you. Nathan (the builder) may review them during beta to keep you safe.</li>
              <li>You must be <strong className="text-text-primary">18 or older</strong>, or have a parent/guardian's consent.</li>
            </ul>
            <p className="text-text-secondary text-sm">
              Read the full <Link to="/terms" target="_blank" className="text-accent-secondary underline">Terms</Link> and{' '}
              <Link to="/privacy" target="_blank" className="text-accent-secondary underline">Privacy Policy</Link>.
            </p>
            <label className="flex items-start gap-3 text-sm text-text-primary cursor-pointer select-none pt-2 border-t border-border-subtle">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 accent-accent-primary w-4 h-4"
                aria-describedby="consent-label"
              />
              <span id="consent-label">
                I've read and understood the above. I acknowledge the <Link to="/terms" target="_blank" className="text-accent-secondary underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-accent-secondary underline">Privacy Policy</Link>, and I agree that if I'm in crisis I'll also reach out to a human via 988 or 911.
              </span>
            </label>
            <button
              type="button"
              onClick={toggleMode}
              className="btn-ghost w-full text-sm"
            >
              Already have an account? Sign in instead
            </button>
          </div>
        )}

        {showAccountFields && (
          <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
            {mode === 'signup' && (
              <>
                <div className="text-xs text-accent-secondary flex items-center gap-1">
                  <span aria-hidden="true">✓</span>
                  <span>Terms acknowledged — let's create your account</span>
                </div>
                <div>
                  <label htmlFor="displayName" className="block text-sm text-text-secondary mb-2">What should NEVAEH call you?</label>
                  <input
                    id="displayName"
                    type="text"
                    autoComplete="given-name"
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field"
                    placeholder="Your first name, or whatever you'd like"
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="email" className="block text-sm text-text-secondary mb-2">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-text-secondary mb-2">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder={mode === 'signup' ? 'at least 6 characters' : ''}
              />
            </div>

            {error && (
              <p className="text-accent-warm text-sm" role="alert">{error}</p>
            )}
            {notice && (
              <p className="text-accent-secondary text-sm" role="status">{notice}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Opening...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            {mode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={sendingReset}
                className="btn-ghost w-full text-xs text-text-secondary"
              >
                {sendingReset ? 'Sending magic link...' : 'Forgot password? Email me a magic link'}
              </button>
            )}

            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => setAcceptedTerms(false)}
                className="btn-ghost w-full text-xs"
              >
                ← Review terms again
              </button>
            )}

            <button
              type="button"
              onClick={toggleMode}
              className="btn-ghost w-full text-sm"
            >
              {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </button>
          </form>
        )}

        <p className="text-xs text-text-muted text-center">
          <Link to="/terms" className="underline">Terms</Link> · <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/crisis" className="underline">Crisis resources</Link>
        </p>
      </div>
    </div>
  )
}
