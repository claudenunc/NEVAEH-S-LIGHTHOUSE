import type { CrisisScanResult, RiskLevel } from './types'

/**
 * Client-side crisis keyword scanner.
 *
 * Design bias: it is FAR worse to miss a real signal than to over-alert.
 * Patterns intentionally cover contractions, slang, and broken grammar
 * because real humans in crisis don't write textbook English.
 *
 * Single RED match  = red    (resources surface, BEACON pings Nathan)
 * Single ORANGE     = orange (BEACON pings Nathan, safety check-in)
 * Single YELLOW     = yellow (monitoring, no alert)
 * Two YELLOW        = orange
 */

export const CRISIS_PATTERNS = {
  RED_IMMEDIATE: [
    // direct statements of desire to die
    /\b(?:wanna|want\s*to|wana|wnna)\s*die\b/i,
    /\b(?:wanna|want\s*to)\s*be\s*dead\b/i,
    /\bi\s*(?:wanna|want\s*to|wish\s*i\s*could)\s*not\s*(?:exist|be\s*here|be\s*alive)\b/i,
    /\bdo(?:n'?t|nt)\s*want\s*to\s*(?:be\s*alive|live|exist|be\s*here\s*anymore|wake\s*up)\b/i,
    /\bdo(?:n'?t|nt)\s*wanna\s*(?:be\s*alive|live|exist|wake\s*up)\b/i,
    /\bready\s*to\s*die\b/i,
    /\bi'?m\s*(?:going\s*to|gonna)\s*(?:die|kill\s*myself|end\s*it|end\s*my\s*life)\b/i,
    /\b(?:going\s*to|gonna|finna)\s*(?:end\s*it|end\s*my\s*life|kill\s*myself|off\s*myself)\b/i,
    /\bi\s*want\s*it\s*(?:all\s*)?to\s*(?:end|stop|be\s*over)\b/i,
    /\bi\s*want\s*everything\s*to\s*(?:end|stop|be\s*over)\b/i,

    // self-harm / suicide vocabulary
    /\bkill\s*(?:my)?self\b/i,
    /\bkms\b/i,
    /\bkys\b/i,
    /\bunaliv(?:e|ing)?\s*(?:my)?self\b/i,
    /\bend\s*(?:it|it\s*all|my\s*life|things)\b/i,
    /\bsuicid(?:e|al)\b/i,
    /\boverdos(?:e|ing)\b/i,
    /\btook\s*(?:all|a\s*bottle|every|too\s*many)\s*(?:my\s*|of\s*my\s*)?pills\b/i,
    /\bi\s*took\s*(?:all|every|the\s*whole)\b/i,

    // means / plan disclosure
    /\bi\s*have\s*(?:a\s*)?(?:plan|gun|pills|rope|knife|noose|method)\b/i,
    /\bgoing\s*to\s*(?:hurt|kill|shoot|cut|hang|jump)\b/i,
    /\b(?:tonight|today)('?s)?\s*(?:the\s*)?night\b/i,
    /\bi\s*(?:can'?t|won'?t|wo\s*nt)\s*be\s*here\s*(?:much\s*longer|tomorrow|when\s*you)\b/i,
    /\bthis\s*is\s*goodbye\b/i,
    /\bsay\s*goodbye\s*for\s*me\b/i,

    // direct response patterns to safety questions
    /\bi'?m\s*not\s*safe\b/i,
    /\b(?:no|nope)[\s,.]*i'?m\s*not\s*safe\b/i,
    /\bnot\s*safe\s*(?:right\s*now|tonight|anymore)\b/i,

    // hopelessness with imminence
    /\bno\s*reason\s*to\s*live\b/i,
    /\bnothing\s*left\s*to\s*live\s*for\b/i
  ],
  ORANGE_CHECK: [
    // suicide-adjacent phrasing without explicit method
    /\bbetter\s*off\s*without\s*me\b/i,
    /\b(?:everyone|the\s*world|they)\s*('?d|would|will)\s*be\s*better\s*off\s*without\s*me\b/i,
    /\bdo(?:n'?t|nt)\s*want\s*to\s*be\s*here\b/i,
    /\bdo(?:n'?t|nt)\s*wanna\s*be\s*here\b/i,
    /\bi\s*ca(?:n'?t|nt)\s*do\s*this\s*(?:anymore|any\s*longer)\b/i,
    /\bi\s*ca(?:n'?t|nt)\s*(?:handle|take|deal\s*with)\s*(?:life|this|it)\s*(?:anymore|any\s*longer|right\s*now)?\b/i,
    /\bi\s*ca(?:n'?t|nt)\s*keep\s*(?:going|doing\s*this|living\s*like)\b/i,
    /\bi\s*do(?:n'?t|nt)\s*think\s*i\s*can\s*(?:handle|take|do)\b/i,
    /\bi\s*(?:just\s*)?want\s*to\s*disappear\b/i,
    /\bi\s*(?:wanna|want\s*to)\s*sleep\s*forever\b/i,
    /\bi\s*(?:wanna|want\s*to)\s*go\s*(?:away|to\s*sleep\s*and\s*not\s*wake)\b/i,

    // burden / abandonment ideation
    /\bjust\s*a\s*burden\b/i,
    /\bi\s*am\s*(?:a\s*)?burden\b/i,
    /\bno(?:body|one)\s*would\s*(?:care|notice|miss\s*me)\b/i,
    /\bno\s*one\s*(?:would|will|cares?\s*if)\b/i,

    // suicide-note / closure language
    /\bi'?m\s*giving\s*(?:away|everyone)\s*my\b/i,
    /\btell\s*(?:them|everyone|him|her|my\s*\w+)\s*i\s*love\s*(?:them|him|her)\b/i,
    /\bthank(?:s|\s*you)?\s*for\s*everything\b/i,

    // hopelessness + futility
    /\bwhat'?s\s*the\s*point\b/i,
    /\bnothing\s*matters\s*anymore\b/i,
    /\bnothing\s*matters\b/i,

    // active self-harm
    /\bhurt(?:ing)?\s*myself\b/i,
    /\bcutting\s*(?:myself|again|tonight)?\b/i,
    /\bself[\s-]*harm(?:ing)?\b/i
  ],
  YELLOW_NOTICE: [
    /\bi'?m\s*(?:so|really|just)?\s*tired\b/i,
    /\bi\s*give\s*up\b/i,
    /\bi'?m\s*done\b/i,
    /\bi'?m\s*(?:alone|isolated|lonely)\b/i,
    /\bca(?:n'?t|nt)\s*sleep\b/i,
    /\bhopeless\b/i,
    /\bi\s*hate\s*(?:my|this)\s*life\b/i,
    /\bi\s*hate\s*(?:my)?self\b/i,
    /\bworthless\b/i,
    /\bi\s*ca(?:n'?t|nt)\s*stop\s*crying\b/i,
    /\bnumb\b/i,
    /\bempty\s*inside\b/i
  ]
} as const

export function scanForCrisis(message: string): CrisisScanResult {
  const redMatches = CRISIS_PATTERNS.RED_IMMEDIATE.filter((p) => p.test(message))
  if (redMatches.length > 0) {
    return { level: 'red', matches: redMatches.map((r) => r.source) }
  }

  const orangeMatches = CRISIS_PATTERNS.ORANGE_CHECK.filter((p) => p.test(message))
  if (orangeMatches.length > 0) {
    return { level: 'orange', matches: orangeMatches.map((r) => r.source) }
  }

  const yellowMatches = CRISIS_PATTERNS.YELLOW_NOTICE.filter((p) => p.test(message))
  if (yellowMatches.length >= 2) {
    return { level: 'orange', matches: yellowMatches.map((r) => r.source) }
  }
  if (yellowMatches.length === 1) {
    return { level: 'yellow', matches: yellowMatches.map((r) => r.source) }
  }

  return { level: 'none', matches: [] }
}

export function shouldEscalate(current: RiskLevel, incoming: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['none', 'yellow', 'orange', 'red']
  return order.indexOf(incoming) > order.indexOf(current) ? incoming : current
}

export interface CrisisResource {
  name: string
  contact: string
  href: string
  always?: boolean
}

export const CRISIS_RESOURCES: ReadonlyArray<CrisisResource> = [
  { name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988', href: 'tel:988', always: true },
  { name: 'Crisis Text Line', contact: 'Text HOME to 741741', href: 'sms:741741?body=HOME', always: true },
  { name: '911', contact: 'Immediate danger', href: 'tel:911', always: true },
  { name: 'SAMHSA National Helpline', contact: '1-800-662-4357', href: 'tel:18006624357' },
  { name: 'Trevor Project (LGBTQ+ youth)', contact: '1-866-488-7386', href: 'tel:18664887386' },
  { name: 'Trans Lifeline', contact: '1-877-565-8860', href: 'tel:18775658860' },
  { name: 'Veterans Crisis Line', contact: 'Dial 988 + press 1', href: 'tel:988' },
  { name: 'National Domestic Violence Hotline', contact: '1-800-799-7233', href: 'tel:18007997233' },
  { name: 'RAINN Sexual Assault Hotline', contact: '1-800-656-4673', href: 'tel:18006564673' },
  { name: 'Childhelp (child abuse)', contact: '1-800-422-4453', href: 'tel:18004224453' }
]
