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

// Historical / artistic content markers.
//
// When a user shares their biography, song lyrics, a poem, or reflects on
// the past, crisis words can show up without representing current ideation.
// Treating such content as a live emergency gets the clinical story wrong
// and harms the user by locking their session into safety-only forever.
//
// If a message has two or more historical markers AND any crisis match,
// we STILL surface resources once, but we do NOT flip the session's
// entered_red / entered_orange flags. The conversation continues normally.

const HISTORICAL_MARKERS: RegExp[] = [
  // temporal past
  /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|many)\s+(?:years?|months?|decades?)\s+ago\b/i,
  /\bback\s+(?:then|in\s+(?:19|20)\d{2}|when\s+i\s+was)\b/i,
  /\bwhen\s+i\s+was\s+(?:young|a\s+(?:kid|teen|teenager|child)|\d+|in\s+(?:high\s*school|college|the\s+hospital))\b/i,
  /\bi\s+used\s+to\s+(?:feel|think|believe|want|try|cut|drink|use|be|struggle)\b/i,
  /\bin\s+(?:19|20)\d{2}\s+i\b/i,
  /\bas\s+a\s+(?:kid|teen|teenager|child|young\s+man|young\s+woman)\b/i,
  /\bbefore\s+(?:i\s+got\s+help|therapy|recovery|sober|i\s+got\s+better)\b/i,
  /\b(?:at\s+my\s+worst|lowest\s+point|darkest\s+(?:time|year|period|chapter))\b/i,

  // explicit past-tense suicidality framing (the hardest category)
  /\bi\s+(?:used\s+to|once)\s+(?:want(?:ed)?|tried)\s+to\s+(?:die|kill\s+myself|end\s+it)\b/i,
  /\bi\s+(?:have|had)\s+(?:tried|attempted|been\s+suicidal)\s+(?:before|in\s+the\s+past)\b/i,
  /\bi\s+almost\s+(?:died|killed\s+myself|didn'?t\s+make\s+it)\b/i,
  /\bi\s+survived\s+(?:a\s+suicide\s+attempt|that|it)\b/i,
  /\bthere\s+was\s+a\s+time\s+when\s+i\b/i,

  // biographical / artistic structure markers
  /^#{1,3}\s+(?:THE|MY|OUR|A)\s+/m,                               // H1/H2/H3 bio heading
  /\bmy\s+(?:story|biography|bio|memoir|journey)\b/i,
  /\bchapter\s+\d+\b/i,
  /^(?:verse|chorus|bridge|outro|intro)\s*[:\d]/im,               // song section markers
  /\b(?:these\s+are\s+lyrics|wrote\s+this\s+(?:song|poem|story))\b/i,
  /\bfrom\s+(?:my|the)\s+(?:book|manuscript|song|album|poem)\b/i,

  // recovery / retrospective framing
  /\b(?:i'?m|im)\s+(?:in\s+recovery|okay\s+now|past\s+that|not\s+there\s+anymore|better\s+now|healed|past\s+it)\b/i,
  /\bthat\s+(?:was|chapter|version\s+of\s+me)\s+(?:is\s+)?(?:behind\s+me|in\s+the\s+past|over|done|closed)\b/i,
  /\bi'?ve\s+come\s+a\s+long\s+way\b/i,
]

export function detectHistoricalContext(message: string): { isHistorical: boolean; markerCount: number; matches: string[] } {
  const hits = HISTORICAL_MARKERS.filter((p) => p.test(message))
  return {
    isHistorical: hits.length >= 2,
    markerCount: hits.length,
    matches: hits.map((r) => r.source)
  }
}

// Self-dismissal commands — user telling the system they're okay.
// If a standalone message matches, we clear session flags and let them continue.

const DISMISSAL_PATTERNS: RegExp[] = [
  /^\s*\/(?:okay|ok|safe|reset|clear|good|fine)\s*$/i,
  /^\s*i'?m\s+(?:okay|ok|safe|fine|good|not\s+in\s+crisis)\s*\.?\s*$/i,
  /^\s*(?:im|i\s+am)\s+(?:okay|ok|safe|fine|good)\s*\.?\s*$/i,
  /^\s*that\s+(?:was|is)\s+(?:in\s+the\s+)?past\s*\.?\s*$/i,
  /^\s*(?:reset|clear)\s+(?:the\s+)?crisis\s*(?:mode|flag|state)?\s*\.?\s*$/i,
]

export function isDismissal(message: string): boolean {
  // Only match if the ENTIRE message is a dismissal, not a passing mention.
  const trimmed = message.trim()
  if (trimmed.length > 80) return false  // too long to be just a dismissal
  return DISMISSAL_PATTERNS.some((p) => p.test(trimmed))
}
