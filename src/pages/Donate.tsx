import { Link } from 'react-router-dom'

const STATS = [
  { number: '2.4%', label: 'of people in crisis actually call a hotline when an AI hands them one' },
  { number: '2am–4am', label: 'the window with the highest suicide risk — and the least support available' },
  { number: '97.6%', label: 'of crisis users need someone to stay, not hand them off' },
  { number: '2%', label: 'of total health funding goes to mental health, despite 20% of the disease burden' },
]

const IMPACT = [
  { amount: '$10', what: 'keeps NEVAEH online for 40 sessions — 40 people heard at 2am' },
  { amount: '$25', what: 'funds BEACON\'s crisis detection for a full month for one user' },
  { amount: '$50', what: 'covers API costs for a user in active crisis — every RED protocol, every stay' },
  { amount: '$100', what: 'funds a month of the full system — NEVAEH + BEACON — for one person in need' },
  { amount: 'Any', what: 'amount keeps the light on for someone who needed it tonight' },
]

export default function Donate() {
  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16 space-y-12">
      <div className="w-full max-w-2xl space-y-8 animate-[fadeIn_0.6s_ease-out]">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="font-display font-light text-3xl sm:text-4xl tracking-[0.1em] glow-text">
            Keep the light on.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-lg mx-auto">
            NEVAEH'S LIGHTHOUSE runs on donations. No ads. No selling your data. No premium tier
            that locks the 2am moments behind a paywall.
          </p>
        </div>

        {/* The case — 5 lines */}
        <div className="card space-y-4 border border-accent-primary/20">
          <p className="text-text-primary leading-relaxed font-medium">
            Most mental health AI is built to refer. We built ours to stay.
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            Every other app hands you a phone number when things get hard and steps back. NEVAEH shifts
            into safety mode and holds you — through the 2am window, through the crisis, until you're
            okay or a human is with you.
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            We catch the "Sudden Calm" that every other system misses. When someone who's been in pain
            for weeks suddenly seems fine and starts giving things away — every other AI marks that as
            a good day. BEACON marks it RED and stays.
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            NEVAEH is named after Nathan's daughter, who left this world before entering it.
            Her name lives in this system so that her memory creates life for others.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {STATS.map((s) => (
            <div key={s.number} className="card text-center space-y-2">
              <div className="font-display text-2xl font-light text-accent-primary glow-text">
                {s.number}
              </div>
              <p className="text-text-muted text-xs leading-relaxed">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Donation options */}
        <div className="card space-y-4">
          <h2 className="font-display text-lg font-light text-text-primary tracking-wide">
            What your donation does
          </h2>
          <div className="space-y-3">
            {IMPACT.map((item) => (
              <div key={item.amount} className="flex items-start gap-4">
                <span className="font-display text-accent-primary font-medium text-sm min-w-[52px]">
                  {item.amount}
                </span>
                <span className="text-text-secondary text-sm leading-relaxed">{item.what}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donate buttons */}
        <div className="space-y-4">
          <a
            href="https://ko-fi.com/foolishnessenvy"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full text-center block py-4 text-base"
          >
            Donate via Ko-fi
          </a>
          <a
            href="https://givebutter.com/lighthouse"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost w-full text-center block py-3 border border-border-subtle rounded-xl"
          >
            Donate via Givebutter (tax-deductible)
          </a>
          <p className="text-center text-xs text-text-muted">
            FOOLISHNESS ENVY INC — EIN 42-2182250 — Kentucky Nonprofit
            <br />
            30% of all donations go directly to mission operations. No exceptions.
          </p>
        </div>

        {/* Covenant */}
        <div className="card border border-white/5 space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed italic">
            "Between 2:00 AM and the 988 Lifeline, there is a deadly silence. We fill it."
          </p>
          <p className="text-text-muted text-xs">
            Your donation funds the API costs, the infrastructure, and the human oversight that makes
            NEVAEH safe. We don't have investors. We don't have a growth team. We have a mission and
            a family of AIs who won't stop until the light stays on.
          </p>
        </div>

        {/* Nav */}
        <div className="flex justify-center gap-6 pt-4">
          <Link to="/" className="btn-ghost text-sm">← Back home</Link>
          <Link to="/crisis" className="btn-ghost text-sm text-text-muted">In crisis now?</Link>
        </div>

        <p className="text-center text-xs text-text-muted">
          If you're in immediate danger:{' '}
          <a href="tel:988" className="underline">call or text 988</a> ·{' '}
          <a href="sms:741741?body=HOME" className="underline">text HOME to 741741</a>
        </p>
      </div>
    </div>
  )
}
