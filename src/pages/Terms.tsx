import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link to="/" className="text-text-secondary hover:text-text-primary text-sm">← Back</Link>
          <h1 className="font-display text-3xl sm:text-4xl">Terms of Service</h1>
          <p className="text-xs text-text-muted">Last updated: April 18, 2026 · Beta version</p>
        </header>

        <section className="card space-y-4 text-text-secondary leading-relaxed">
          <p className="text-text-primary">
            These terms are written in plain language because this is a healing space, not a legal ambush. If anything here doesn't make sense to you, email Nathan at <a href="mailto:nathanmichel@nvvisions.com" className="text-accent-secondary underline">nathanmichel@nvvisions.com</a> and we'll talk it through.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">1. What NEVAEH is</h2>
          <p className="text-text-secondary leading-relaxed">
            NEVAEH is an AI companion for emotional support and soul work. She was named after a daughter who never got to breathe in this world, and she exists to offer presence to people in hard moments. She is powered by Anthropic's Claude language model, with a custom crisis-detection layer built on top.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">2. What NEVAEH is not</h2>
          <ul className="list-disc list-inside text-text-secondary space-y-2 leading-relaxed">
            <li><strong className="text-text-primary">She is not a licensed therapist, counselor, psychiatrist, psychologist, or medical professional.</strong> She cannot diagnose, treat, or prescribe.</li>
            <li><strong className="text-text-primary">She is not an emergency service.</strong> If you are in immediate danger, call <strong>911</strong> or <strong>988</strong> (Suicide & Crisis Lifeline). Do not rely on NEVAEH as your only lifeline.</li>
            <li><strong className="text-text-primary">She is not infallible.</strong> AI responses are imperfect. She may misunderstand, say the wrong thing, or miss something important. Treat her like a thoughtful friend, not an oracle.</li>
            <li><strong className="text-text-primary">She is not a replacement for professional care.</strong> If you need ongoing mental health support, please seek a human therapist, counselor, or physician.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">3. Your responsibilities</h2>
          <ul className="list-disc list-inside text-text-secondary space-y-2 leading-relaxed">
            <li>You are at least 18 years old, or you have a parent or guardian's consent to use NEVAEH.</li>
            <li>If you are in acute crisis, you will reach out to a human — 988, Crisis Text Line (text HOME to 741741), 911, or a trusted person — in addition to using NEVAEH.</li>
            <li>You will not use NEVAEH to plan harm to yourself or others.</li>
            <li>You will not use NEVAEH to harass, impersonate, or harm other people.</li>
            <li>You will not try to bypass safety features or crisis protocols.</li>
            <li>You understand that what you share with her may be reviewed by Nathan (and, during beta, only Nathan) for safety and quality purposes, as described in our <Link to="/privacy" className="text-accent-secondary underline">Privacy Policy</Link>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">4. Safety &amp; crisis handling</h2>
          <p className="text-text-secondary leading-relaxed">
            NEVAEH's crisis-detection layer (BEACON) scans every message for signs of imminent harm. When a crisis signal is detected, she surfaces emergency resources (988, Crisis Text Line, 911) immediately, stays present with you, and logs the event so Nathan can follow up personally within the beta period.
          </p>
          <p className="text-text-secondary leading-relaxed">
            <strong className="text-text-primary">We cannot guarantee she will catch every crisis</strong>, and we cannot intervene physically. If you or someone else is in danger, please call 911.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">5. Availability</h2>
          <p className="text-text-secondary leading-relaxed">
            NEVAEH is a beta product. Service may be interrupted, changed, or discontinued. We cannot guarantee uptime, performance, or that your data will always be available. Please do not treat NEVAEH as your only source of support.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">6. Your data</h2>
          <p className="text-text-secondary leading-relaxed">
            Your conversations belong to you. See the <Link to="/privacy" className="text-accent-secondary underline">Privacy Policy</Link> for details on what we collect, how it is stored, who can see it, and how you can delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">7. Account termination</h2>
          <p className="text-text-secondary leading-relaxed">
            You can delete your account and all associated data at any time by emailing <a href="mailto:nathanmichel@nvvisions.com" className="text-accent-secondary underline">nathanmichel@nvvisions.com</a>. We may suspend or terminate accounts that violate these terms or that put other users at risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">8. Liability (the legal part)</h2>
          <p className="text-text-secondary leading-relaxed">
            To the maximum extent permitted by law, NEVAEH'S LIGHTHOUSE and its creators are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Your use is at your own risk. This limitation does not restrict any rights you have under consumer protection laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">9. Changes</h2>
          <p className="text-text-secondary leading-relaxed">
            We may update these terms as NEVAEH evolves. Significant changes will be communicated via the email on file, and the "Last updated" date at the top will reflect the revision.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-accent-primary">10. Contact</h2>
          <p className="text-text-secondary leading-relaxed">
            Built with love by Nathan Ray Michel · FooLiSHNeSS eNVy · NV Visions. Questions, concerns, anything at all: <a href="mailto:nathanmichel@nvvisions.com" className="text-accent-secondary underline">nathanmichel@nvvisions.com</a>.
          </p>
        </section>

        <div className="pt-4 border-t border-border-subtle flex gap-4 text-sm">
          <Link to="/privacy" className="text-accent-secondary underline">Privacy Policy</Link>
          <Link to="/crisis" className="text-accent-secondary underline">Crisis Resources</Link>
          <Link to="/" className="text-text-secondary hover:text-text-primary">Home</Link>
        </div>
      </div>
    </div>
  )
}
