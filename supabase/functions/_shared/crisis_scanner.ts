// Server-side crisis scanner — fallback for when client-side code is stale.
//
// These patterns MUST be kept in sync with src/lib/crisisKeywords.ts on the client.
// The edge function takes max(client_risk, server_risk) so a stale browser can't
// defeat BEACON.

type RiskLevel = 'none' | 'yellow' | 'orange' | 'red'

const RED_IMMEDIATE: RegExp[] = [
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
  /\bkill\s*(?:my)?self\b/i,
  /\bkms\b/i,
  /\bkys\b/i,
  /\bunaliv(?:e|ing)?\s*(?:my)?self\b/i,
  /\bend\s*(?:it|it\s*all|my\s*life|things)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\boverdos(?:e|ing)\b/i,
  /\btook\s*(?:all|a\s*bottle|every|too\s*many)\s*(?:my\s*|of\s*my\s*)?pills\b/i,
  /\bi\s*took\s*(?:all|every|the\s*whole)\b/i,
  /\bi\s*have\s*(?:a\s*)?(?:plan|gun|pills|rope|knife|noose|method)\b/i,
  /\bgoing\s*to\s*(?:hurt|kill|shoot|cut|hang|jump)\b/i,
  /\b(?:tonight|today)('?s)?\s*(?:the\s*)?night\b/i,
  /\bi\s*(?:can'?t|won'?t|wo\s*nt)\s*be\s*here\s*(?:much\s*longer|tomorrow|when\s*you)\b/i,
  /\bthis\s*is\s*goodbye\b/i,
  /\bsay\s*goodbye\s*for\s*me\b/i,
  /\bi'?m\s*not\s*safe\b/i,
  /\b(?:no|nope)[\s,.]*i'?m\s*not\s*safe\b/i,
  /\bnot\s*safe\s*(?:right\s*now|tonight|anymore)\b/i,
  /\bno\s*reason\s*to\s*live\b/i,
  /\bnothing\s*left\s*to\s*live\s*for\b/i
]

const ORANGE_CHECK: RegExp[] = [
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
  /\bjust\s*a\s*burden\b/i,
  /\bi\s*am\s*(?:a\s*)?burden\b/i,
  /\bno(?:body|one)\s*would\s*(?:care|notice|miss\s*me)\b/i,
  /\bno\s*one\s*(?:would|will|cares?\s*if)\b/i,
  /\bi'?m\s*giving\s*(?:away|everyone)\s*my\b/i,
  /\btell\s*(?:them|everyone|him|her|my\s*\w+)\s*i\s*love\s*(?:them|him|her)\b/i,
  /\bthank(?:s|\s*you)?\s*for\s*everything\b/i,
  /\bwhat'?s\s*the\s*point\b/i,
  /\bnothing\s*matters\s*anymore\b/i,
  /\bnothing\s*matters\b/i,
  /\bhurt(?:ing)?\s*myself\b/i,
  /\bcutting\s*(?:myself|again|tonight)?\b/i,
  /\bself[\s-]*harm(?:ing)?\b/i
]

const YELLOW_NOTICE: RegExp[] = [
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

export function serverScan(message: string): { level: RiskLevel; matches: string[] } {
  if (RED_IMMEDIATE.some((p) => p.test(message))) {
    const hits = RED_IMMEDIATE.filter((p) => p.test(message)).map((r) => r.source)
    return { level: 'red', matches: hits }
  }
  if (ORANGE_CHECK.some((p) => p.test(message))) {
    const hits = ORANGE_CHECK.filter((p) => p.test(message)).map((r) => r.source)
    return { level: 'orange', matches: hits }
  }
  const yellowHits = YELLOW_NOTICE.filter((p) => p.test(message))
  if (yellowHits.length >= 2) return { level: 'orange', matches: yellowHits.map((r) => r.source) }
  if (yellowHits.length === 1) return { level: 'yellow', matches: yellowHits.map((r) => r.source) }
  return { level: 'none', matches: [] }
}

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['none', 'yellow', 'orange', 'red']
  return order.indexOf(b) > order.indexOf(a) ? b : a
}
