// NEVAEH'S LIGHTHOUSE — /summarize Edge Function
// Runs at end of session: Claude reads the full conversation → returns JSON summary → saved to sessions table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'

function decodeJwtSub(authHeader: string): { userId: string | null; reason?: string } {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const parts = token.split('.')
    if (parts.length !== 3) return { userId: null, reason: 'malformed_jwt' }
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = '='.repeat((4 - (payloadB64.length % 4)) % 4)
    const payload = JSON.parse(atob(payloadB64 + pad))
    const role = payload.role
    if (role === 'anon' || role === 'service_role') return { userId: null, reason: 'not_a_user_token' }
    const sub = payload.sub
    if (!sub || typeof sub !== 'string') return { userId: null, reason: 'no_sub_claim' }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { userId: null, reason: 'expired' }
    return { userId: sub }
  } catch (e) {
    return { userId: null, reason: 'decode_error:' + (e instanceof Error ? e.message : String(e)) }
  }
}

const SUMMARIZER_PROMPT = `You are the session summarizer for NEVAEH'S LIGHTHOUSE. You read the full conversation between NEVAEH (an AI emotional companion) and a user, and output a structured JSON summary.

Your job: capture what happened emotionally, thematically, and therapeutically — not just what was said. Write human summaries that a future NEVAEH can use to continue the relationship.

Output ONLY valid JSON matching this exact shape:

{
  "summary": "1-3 sentence human summary of what happened in this session. Written as a close friend would describe it, not clinically.",
  "emotional_tags": ["grief", "hope_flicker", "self_compassion_emerging"],
  "themes_surfaced": ["mother_wound", "not_enough_story"],
  "breakthroughs": ["quote or description of a real breakthrough moment, if any — empty array if none"],
  "unresolved": ["threads that surfaced but weren't resolved"],
  "crisis_flags": false,
  "modalities_used": ["ifs", "somatic"],
  "mood_trajectory": "heavier -> grounded | flat | bright -> heavy | same | etc",
  "plant_for_next_session": "one specific thing NEVAEH is holding for them — the invitation or thread to carry forward",
  "identity_graph_updates": {
    "any new durable facts that surfaced": "that should be added to the user's identity_graph (e.g. pronouns shared, new significant person mentioned, preferred modality confirmed)"
  }
}

Rules:
- If the session was very short or shallow, still produce a valid summary — just concise.
- Never invent a breakthrough that didn't happen.
- For modalities_used: only include ones NEVAEH actually used (dispenza, lipton, ruiz, cbt, ifs, act, somatic, faith).
- crisis_flags: true only if the session had an actual crisis moment (user expressed suicidal ideation, self-harm, danger).
- identity_graph_updates: only include NEW durable facts. Do not re-list what was already known.
- Output ONLY the JSON object. No preamble. No markdown fences. No commentary.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonErr(401, 'Missing authorization')

    const { userId, reason } = decodeJwtSub(authHeader)
    if (!userId) {
      console.warn('summarize auth reject', reason)
      return jsonErr(401, 'Invalid session: ' + (reason ?? 'unknown'))
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const user = { id: userId }

    const { session_id } = await req.json()
    if (!session_id) return jsonErr(400, 'session_id required')

    // Verify session
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!sess) return jsonErr(404, 'Session not found')

    // Fetch all messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    const conversation = (msgs ?? []).filter((m: { role: string }) => m.role !== 'system')

    let summary: Record<string, unknown> = {
      summary: 'A brief session.',
      emotional_tags: [],
      themes_surfaced: [],
      breakthroughs: [],
      unresolved: [],
      crisis_flags: sess.entered_red || sess.entered_orange,
      modalities_used: [],
      mood_trajectory: 'unknown',
      plant_for_next_session: '',
      identity_graph_updates: {}
    }

    // Only call Claude if there are enough messages to summarize
    if (conversation.length >= 2) {
      const transcript = conversation
        .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n')

      const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          system: SUMMARIZER_PROMPT,
          messages: [{ role: 'user', content: `Summarize this session:\n\n${transcript}` }]
        })
      })

      if (claudeResp.ok) {
        const data = await claudeResp.json()
        const text = data.content?.[0]?.type === 'text' ? data.content[0].text : ''
        // Extract JSON (tolerant of stray text)
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            summary = { ...summary, ...JSON.parse(match[0]) }
          } catch (_e) {
            console.error('summary parse failed')
          }
        }
      }
    }

    // Save summary
    await supabase
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
        summary
      })
      .eq('id', session_id)

    // Increment total_sessions on profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_sessions, identity_graph')
      .eq('user_id', user.id)
      .maybeSingle()

    const newTotal = (profile?.total_sessions ?? 0) + 1

    // Merge identity_graph_updates if present
    const updates = (summary.identity_graph_updates as Record<string, unknown>) ?? {}
    const mergedIdentity = { ...(profile?.identity_graph as Record<string, unknown> ?? {}), ...updates }

    await supabase
      .from('profiles')
      .update({ total_sessions: newTotal, identity_graph: mergedIdentity })
      .eq('user_id', user.id)

    // Append anchor phrases to growth_arc if breakthroughs present
    const breakthroughs = (summary.breakthroughs as string[]) ?? []
    if (breakthroughs.length > 0) {
      const { data: arcRow } = await supabase
        .from('growth_arc')
        .select('arc')
        .eq('user_id', user.id)
        .maybeSingle()

      const arc = (arcRow?.arc as Record<string, unknown>) ?? {}
      const existingAnchors = (arc.anchor_phrases as string[]) ?? []
      const newAnchors = [...existingAnchors, ...breakthroughs].slice(-20)
      const updatedArc = { ...arc, anchor_phrases: newAnchors, total_sessions: newTotal }

      await supabase
        .from('growth_arc')
        .update({ arc: updatedArc, last_rebuilt_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }

    return new Response(
      JSON.stringify({ ok: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('summarize error', err)
    return jsonErr(500, 'Could not save summary.')
  }
})

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
