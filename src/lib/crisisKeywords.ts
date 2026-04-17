import type { CrisisScanResult, RiskLevel } from './types'

/**
 * Client-side crisis keyword scanner.
 * Based on BEACON_CRISIS_PROTOCOLS.md Section A.
 *
 * This is a FIRST-PASS filter. The server-side LLM (PATTERN in the edge function)
 * does the deeper semantic analysis. Client-side scan catches the explicit signals
 * immediately so resources can surface before the API round-trip completes.
 */

export const CRISIS_PATTERNS = {
  RED_IMMEDIATE: [
    /\bkill\s*(my)?self\b/i,
    /\bwant\s*to\s*die\b/i,
    /\bend\s*(it|my\s*life)\b/i,
    /\bsuicid(e|al)\b/i,
    /\boverdos(e|ing)\b/i,
    /\btook\s*(all|a\s*bottle|every)\s*(my)?\s*pills\b/i,
    /\bgoing\s*to\s*(hurt|kill)\b/i,
    /\bi\s*have\s*(a\s*)?(plan|gun|pills|rope)\b/i,
    /\btonight('?s)?\s*the\s*night\b/i,
    /\bi\s*(can'?t|won'?t)\s*be\s*here\s*(much\s*longer|tomorrow)\b/i
  ],
  ORANGE_CHECK: [
    /\bbetter\s*off\s*without\s*me\b/i,
    /\bdon'?t\s*want\s*to\s*be\s*here\b/i,
    /\bcan'?t\s*do\s*this\s*anymore\b/i,
    /\bjust\s*a\s*burden\b/i,
    /\bno(body|one)\s*would\s*(care|notice|miss)\b/i,
    /\bwhat'?s\s*the\s*point\b/i,
    /\bhurt(ing)?\s*myself\b/i,
    /\bcutting\b/i,
    /\bi'?m\s*giving\s*(away|everyone)\s*my\b/i,
    /\btell\s*(them|everyone|him|her)\s*i\s*love\s*them\b/i,
    /\bthank\s*you\s*for\s*everything\b/i,
    /\bnothing\s*matters\s*anymore\b/i
  ],
  YELLOW_NOTICE: [
    /\bi'?m\s*(so\s*)?tired\b/i,
    /\bi\s*give\s*up\b/i,
    /\bi'?m\s*(alone|isolated|lonely)\b/i,
    /\bcan'?t\s*sleep\b/i,
    /\bhopeless\b/i,
    /\bi\s*hate\s*(my|this)\s*life\b/i
  ]
} as const

export function scanForCrisis(message: string): CrisisScanResult {
  const redMatches = CRISIS_PATTERNS.RED_IMMEDIATE.filter((p) => p.test(message))
  if (redMatches.length > 0) {
    return { level: 'red', matches: redMatches.map((r) => r.source) }
  }

  const orangeMatches = CRISIS_PATTERNS.ORANGE_CHECK.filter((p) => p.test(message))
  if (orangeMatches.length >= 2) {
    return { level: 'orange', matches: orangeMatches.map((r) => r.source) }
  }
  if (orangeMatches.length === 1) {
    return { level: 'yellow', matches: orangeMatches.map((r) => r.source) }
  }

  const yellowMatches = CRISIS_PATTERNS.YELLOW_NOTICE.filter((p) => p.test(message))
  if (yellowMatches.length >= 2) {
    return { level: 'yellow', matches: yellowMatches.map((r) => r.source) }
  }

  return { level: 'none', matches: [] }
}

export function shouldEscalate(current: RiskLevel, incoming: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['none', 'yellow', 'orange', 'red']
  return order.indexOf(incoming) > order.indexOf(current) ? incoming : current
}

export const CRISIS_RESOURCES = [
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
] as const
