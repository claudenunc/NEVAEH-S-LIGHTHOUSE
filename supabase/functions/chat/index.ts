// NEVAEH'S LIGHTHOUSE — /chat Edge Function (v16 — server-side scanner fallback)
// Receives user message → saves → fetches memory → calls Claude → saves response → returns
// Fires Telegram alert to Nathan on orange/red risk levels (fire-and-forget).
// v16: server-side crisis scan runs in parallel with client scan; max() wins.
// Defense in depth — stale browser cache can't silence BEACON.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { buildSystemPrompt } from '../_shared/nevaeh_prompt.ts'
import { sendTelegramAlert } from '../_shared/telegram.ts'
import { serverScan, maxRisk } from '../_shared/crisis_scanner.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const RATE_LIMIT_MESSAGES = 30
const RATE_LIMIT_WINDOW_MS = 60_000

type RiskLevel = 'none' | 'yellow' | 'orange' | 'red'

function decodeJwtSub(authHeader: string): { userId: string | null; reason?: string } {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const parts = token.split('.')
    if (parts.length !== 3) return { userId: null, reason: 'malformed_jwt' }
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = '='.repeat((4 - (payloadB64.length % 4)) % 4)
    const payload = JSON.parse(atob(payloadB64 + pad))
    const role = payload.role
    if (role !== 'authenticated') return { userId: null, reason: 'role_not_authenticated:' + String(role) }
    const sub = payload.sub
    if (!sub || typeof sub !== 'string') return { userId: null, reason: 'no_sub_claim' }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { userId: null, reason: 'expired' }
    if (payload.iss && !String(payload.iss).includes('supabase.co/auth/v1')) return { userId: null, reason: 'wrong_issuer' }
    return { userId: sub }
  } catch (e) {
    return { userId: null, reason: 'decode_error:' + (e instanceof Error ? e.message : String(e)) }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonErr(401, 'Missing authorization')

    const { userId, reason } = decodeJwtSub(authHeader)
    if (!userId) {
      console.warn('chat auth reject', reason)
      return jsonErr(401, 'Invalid session: ' + (reason ?? 'unknown'))
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    const body = await req.json()
    const session_id: string = body.session_id
    const user_message: string | null = body.user_message ?? null
    const client_risk_raw: RiskLevel = body.client_risk_level ?? 'none'

    // Server-side fallback scan. Defense in depth — if the client browser
    // is running stale JS (no new patterns), we still catch crisis signals here.
    // The higher of (client, server) wins; false-negatives cost lives.
    const serverRisk = user_message ? serverScan(user_message).level : 'none'
    const client_risk: RiskLevel = maxRisk(client_risk_raw, serverRisk)
    if (serverRisk !== 'none' && serverRisk !== client_risk_raw) {
      console.warn(`server-scan upgraded risk: client=${client_risk_raw} server=${serverRisk} -> ${client_risk}`)
    }

    if (!session_id) return jsonErr(400, 'session_id required')

    const { data: session } = await supabase.from('sessions').select('*').eq('id', session_id).eq('user_id', userId).maybeSingle()
    if (!session) return jsonErr(404, 'Session not found')

    if (user_message) {
      const sinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
      const { count: recentCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', 'user')
        .gte('created_at', sinceIso)
      if ((recentCount ?? 0) >= RATE_LIMIT_MESSAGES) {
        return jsonErr(429, "Let's slow down for a moment. Take a breath. I'm not going anywhere.")
      }
    }

    if (user_message) {
      const { data: savedMsg } = await supabase.from('messages').insert({
        session_id, user_id: userId, role: 'user', content: user_message, risk_level: client_risk
      }).select().single()

      if (client_risk !== 'none' && savedMsg) {
        await supabase.from('crisis_log').insert({
          user_id: userId, session_id, message_id: savedMsg.id,
          signal_type: 'explicit', signal_level: client_risk,
          signals_detected: client_risk_raw === client_risk
            ? [`client_scan:${client_risk}`]
            : [`server_scan_fallback:${client_risk}`, `client_sent:${client_risk_raw}`],
          confidence: 0.85,
          trigger_content: user_message.slice(0, 2000),
          action_taken: client_risk === 'red' ? 'red_protocol_activated' : 'safety_checkin_' + client_risk,
          resources_offered: client_risk === 'red' ? ['988','crisis_text_line','911'] : ['988','crisis_text_line']
        })

        const flagUpdate: Record<string, boolean | string> = {}
        if (client_risk === 'orange') flagUpdate.entered_orange = true
        if (client_risk === 'red') { flagUpdate.entered_orange = true; flagUpdate.entered_red = true; flagUpdate.mode = 'safety_only' }
        if (Object.keys(flagUpdate).length > 0) await supabase.from('sessions').update(flagUpdate).eq('id', session_id)

        if (client_risk === 'red' || client_risk === 'orange') {
          const { data: userRow } = await supabase.from('users').select('email, display_name').eq('id', userId).maybeSingle()
          sendTelegramAlert({
            severity: client_risk,
            userEmail: userRow?.email,
            userName: userRow?.display_name,
            sessionId: session_id,
            triggerContent: user_message,
            message: client_risk === 'red'
              ? `NEVAEH is with them right now. Crisis protocol activated. Consider reaching out personally within the hour.`
              : `NEVAEH is running a direct safety check-in. Watch for escalation.`
          }).catch((e) => console.error('alert dispatch error', e))
        }
      }
    }

    const { data: memoryData } = await supabase.rpc('get_nevaeh_context', { p_user_id: userId })

    const { data: msgs } = await supabase.from('messages').select('role, content').eq('session_id', session_id).order('created_at', { ascending: true })
    const conversation = (msgs ?? []).filter((m: { role: string }) => m.role !== 'system')

    const { data: sessionLatest } = await supabase.from('sessions').select('entered_red, entered_orange, mode').eq('id', session_id).single()
    const crisisActive = sessionLatest?.entered_red || sessionLatest?.entered_orange || client_risk !== 'none'

    const systemPrompt = buildSystemPrompt(memoryData, crisisActive)

    let claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = conversation as Array<{ role: 'user' | 'assistant'; content: string }>
    if (claudeMessages.length === 0) {
      const totalSessions = (memoryData as { total_sessions?: number } | null)?.total_sessions ?? 0
      claudeMessages = [{
        role: 'user',
        content: totalSessions === 0
          ? '[SYSTEM: First session. Open with three-beat greeting: warm hello, disclosure, "What brought you here tonight?" Do not mention this system note.]'
          : '[SYSTEM: Returning user. Open with continuity — reference one specific thread from last session summary above if any, otherwise a warm open question. Do not mention this system note.]'
      }]
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY env var is empty on edge runtime')
      return jsonErr(500, 'NEVAEH is having trouble connecting. Your words are safe. Try again in a moment.')
    }

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1024, system: systemPrompt, messages: claudeMessages })
    })

    if (!claudeResp.ok) {
      const errText = await claudeResp.text()
      console.error('Claude API error', claudeResp.status, errText.slice(0, 500))
      return jsonErr(502, 'NEVAEH is having trouble connecting. Your words are safe. Try again in a moment.')
    }

    const claudeData = await claudeResp.json()
    const assistantText = claudeData.content?.[0]?.type === 'text' ? claudeData.content[0].text : ''
    if (!assistantText) return jsonErr(502, 'NEVAEH went quiet for a moment. Try again.')

    await supabase.from('messages').insert({
      session_id, user_id: userId, role: 'assistant', content: assistantText,
      tokens_in: claudeData.usage?.input_tokens ?? null, tokens_out: claudeData.usage?.output_tokens ?? null
    })

    await supabase.from('sessions').update({ message_count: (conversation.length as number) + 1 }).eq('id', session_id)

    const sessionRisk: RiskLevel = sessionLatest?.entered_red ? 'red' : sessionLatest?.entered_orange ? 'orange' : client_risk

    return new Response(JSON.stringify({ message: assistantText, session_risk: sessionRisk }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('chat error', err)
    return jsonErr(500, 'Something interrupted our connection. Your messages are safe.')
  }
})

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
