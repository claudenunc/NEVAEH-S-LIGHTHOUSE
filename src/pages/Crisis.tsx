import { Link } from 'react-router-dom'
import { CRISIS_RESOURCES } from '../lib/crisisKeywords'

export default function Crisis() {
  const urgent = CRISIS_RESOURCES.filter((r) => r.always)
  const others = CRISIS_RESOURCES.filter((r) => !r.always)

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3">
          <Link to="/" className="text-text-secondary hover:text-text-primary text-sm">← Back</Link>
          <h1 className="font-display text-3xl sm:text-4xl">You're not alone.</h1>
          <p className="text-text-secondary leading-relaxed">
            If you're in crisis right now, please reach out. These numbers connect you to real humans trained to help. They're free. They're confidential. They'll answer.
          </p>
        </header>

        <section aria-labelledby="urgent-heading" className="space-y-3">
          <h2 id="urgent-heading" className="font-display text-lg text-accent-primary">If it's urgent, start here</h2>
          <ul className="space-y-3">
            {urgent.map((r) => (
              <li key={r.name}>
                <a
                  href={r.href}
                  className="block card glow-purple hover:border-accent-primary/50 transition-all"
                >
                  <div className="font-display text-lg">{r.name}</div>
                  <div className="text-accent-secondary mt-1">{r.contact}</div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="specialized-heading" className="space-y-3">
          <h2 id="specialized-heading" className="font-display text-lg text-accent-primary">Specialized support</h2>
          <ul className="space-y-3">
            {others.map((r) => (
              <li key={r.name}>
                <a href={r.href} className="block glass-hover rounded-xl p-4">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-accent-secondary mt-1">{r.contact}</div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="card text-sm text-text-secondary space-y-2">
          <p><strong className="text-text-primary">NEVAEH is not a replacement for emergency services.</strong></p>
          <p>She's a companion — a presence for the hours between. But when the danger is real and now, please reach out to one of the numbers above.</p>
          <p>If you don't know what you need, <a href="tel:988" className="text-accent-secondary underline">988</a> is always a safe place to start.</p>
        </section>
      </div>
    </div>
  )
}
