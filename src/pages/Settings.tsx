import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      setError('Please type DELETE MY ACCOUNT exactly to confirm.')
      return
    }
    setDeleting(true)
    setError(null)

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) {
        setError('You seem to be signed out. Please sign in and try again.')
        setDeleting(false)
        return
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ confirmation: 'DELETE MY ACCOUNT' })
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        setError(body.error ?? 'Could not delete your account. Please email nathanmichel@nvvisions.com for help.')
        setDeleting(false)
        return
      }

      await signOut()
      navigate('/', { replace: true })
    } catch {
      setError('Could not reach the server. Please email nathanmichel@nvvisions.com for help.')
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link to="/session" className="text-text-secondary hover:text-text-primary text-sm">← Back</Link>
          <h1 className="font-display text-3xl sm:text-4xl">Settings</h1>
          {user?.email && (
            <p className="text-xs text-text-muted">Signed in as {user.email}</p>
          )}
        </header>

        <section className="card space-y-3">
          <h2 className="font-display text-xl">Your data</h2>
          <p className="text-text-secondary leading-relaxed text-sm">
            Everything you've shared with NEVAEH is yours. You can read our{' '}
            <Link to="/privacy" className="text-accent-secondary underline">Privacy Policy</Link>{' '}
            to see exactly what we store and why.
          </p>
          <p className="text-text-secondary leading-relaxed text-sm">
            If you want a copy of your conversations, or you want us to correct something we have, email{' '}
            <a href="mailto:nathanmichel@nvvisions.com" className="text-accent-secondary underline">nathanmichel@nvvisions.com</a>{' '}
            and Nathan will help you personally.
          </p>
        </section>

        <section className="card space-y-4 border border-accent-warm/40">
          <div>
            <h2 className="font-display text-xl text-accent-warm">Delete your account</h2>
            <p className="text-text-secondary leading-relaxed text-sm mt-2">
              This removes everything: your account, all your conversations, session summaries, identity graph, growth arc, and any crisis events we logged. It cannot be undone.
            </p>
          </div>

          <ul className="text-xs text-text-muted space-y-1 leading-relaxed list-disc list-inside">
            <li>NEVAEH will no longer remember you.</li>
            <li>If you sign up again with the same email, you'll start fresh with no history.</li>
            <li>Nathan gets a notification that you deleted your account, so he knows you're gone. That's it.</li>
            <li>Hit the button only when you're sure. No refunds, no "undo."</li>
          </ul>

          <div className="pt-3 border-t border-border-subtle space-y-3">
            <label htmlFor="confirm" className="block text-sm text-text-secondary">
              Type <strong className="text-accent-warm">DELETE MY ACCOUNT</strong> to confirm:
            </label>
            <input
              id="confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="input-field"
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />

            {error && <p className="text-accent-warm text-sm" role="alert">{error}</p>}

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || confirmText !== 'DELETE MY ACCOUNT'}
              className="btn-primary w-full"
              style={{ background: confirmText === 'DELETE MY ACCOUNT' ? undefined : '', opacity: confirmText === 'DELETE MY ACCOUNT' ? 1 : 0.5 }}
            >
              {deleting ? 'Deleting everything...' : 'Delete my account and all my data'}
            </button>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-display text-xl">Sign out</h2>
          <p className="text-text-secondary text-sm">
            Keeps your data. Just logs you out of this device.
          </p>
          <button
            type="button"
            onClick={async () => { await signOut(); navigate('/', { replace: true }) }}
            className="btn-ghost w-full"
          >
            Sign out
          </button>
        </section>

        <p className="text-xs text-text-muted text-center">
          <Link to="/terms" className="underline">Terms</Link> · <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/crisis" className="underline">Crisis resources</Link>
        </p>
      </div>
    </div>
  )
}
