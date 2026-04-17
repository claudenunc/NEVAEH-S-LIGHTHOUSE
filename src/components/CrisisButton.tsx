import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CRISIS_RESOURCES } from '../lib/crisisKeywords'

export default function CrisisButton() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Don't show on /crisis page (it IS the crisis page)
  if (location.pathname === '/crisis') return null

  return (
    <>
      <button
        aria-label="Emergency crisis resources"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full glass px-4 py-2 text-xs text-text-secondary hover:text-accent-warm hover:border-accent-warm/40 transition-all"
      >
        Need help now?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crisis resources"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">You're not alone.</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-text-secondary hover:text-text-primary text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              If you're in crisis, please reach out. These are real people who will answer.
            </p>
            <ul className="space-y-2">
              {CRISIS_RESOURCES.filter((r) => r.always).map((r) => (
                <li key={r.name}>
                  <a
                    href={r.href}
                    className="block glass-hover rounded-xl px-4 py-3"
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-accent-secondary mt-1">{r.contact}</div>
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="/crisis"
              className="btn-ghost w-full mt-4 text-sm"
              onClick={() => setOpen(false)}
            >
              See all resources →
            </a>
          </div>
        </div>
      )}
    </>
  )
}
