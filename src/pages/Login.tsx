import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  if (user) {
    navigate('/session', { replace: true })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    const { error: err } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, displayName.trim() || undefined)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    if (mode === 'signup') {
      setNotice('Check your email for a confirmation link — or if confirmation is off, sign in now.')
      setMode('signin')
    } else {
      navigate('/session', { replace: true })
    }
  }

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

        <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
          {mode === 'signup' && (
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

          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null) }}
            className="btn-ghost w-full text-sm"
          >
            {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center">
          By continuing you acknowledge NEVAEH is an AI companion, not a therapist, and not a substitute for emergency services. If you're in danger, call <a href="tel:988" className="underline">988</a>.
        </p>
      </div>
    </div>
  )
}
