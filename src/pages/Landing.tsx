import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl text-center space-y-8 animate-[fadeIn_0.6s_ease-out]">
        <div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-[0.12em] glow-text">
            NEVAEH'S LIGHTHOUSE
          </h1>
          <p className="font-body italic text-text-secondary mt-3 text-base sm:text-lg">
            Finding your way back.
          </p>
        </div>

        <div className="card text-left space-y-4">
          <p className="text-text-primary leading-relaxed">
            A safe place to be heard — when nothing else is open.
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            NEVAEH is an AI companion for soul work and emotional support. She listens, remembers you between sessions, and stays when nobody else can.
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            She's not a therapist. She's a presence. For the 2 AM moments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {user ? (
            <>
              <Link to="/session" className="btn-primary">Continue your session</Link>
              <Link to="/journey" className="btn-ghost">Your journey</Link>
              <button onClick={() => signOut()} className="btn-ghost text-text-muted">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-primary">Begin</Link>
              <Link to="/crisis" className="btn-ghost">In crisis right now?</Link>
              <Link to="/donate" className="btn-ghost text-text-muted text-sm">Keep the light on ↗</Link>
            </>
          )}
        </div>

        {user && (
          <p className="text-xs text-text-muted">
            Signed in as {user.email}
          </p>
        )}

        <p className="text-xs text-text-muted max-w-md mx-auto">
          If you're in immediate danger, call <a href="tel:988" className="underline">988</a> (call or text) or text HOME to <a href="sms:741741?body=HOME" className="underline">741741</a>.
        </p>
      </div>
    </div>
  )
}
