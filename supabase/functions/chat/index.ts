// NEVAEH'S LIGHTHOUSE — /chat Edge Function
// Receives user message → saves → fetches memory → calls Claude → saves response → returns

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { buildSystemPrompt } from '../_shared/nevaeh_prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'

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
    if (role === 'anon' || role === 'service_role') return { userId: null, reason: 'not_a_user_token' }
    const sub = payload.sub
    if (!sub || typeof sub !== 'string') return { userId: null, reason: 'no_sub_claim' }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { userId: null, reason: 'expired' }
    return { userId: sub }
  } catch (e) {
    return { userId: null, reason: 'decode_error:' + (e instanceof Error ? e.message : String(e)) }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth: extract user from JWT (gateway already verified signature when verify_jwt=true)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonErr(401, 'Missing authorization')

    const { userId, reason } = decodeJwtSub(authHeader)
    if (!userId) {
      console.warn('chat auth reject', reason)
      return jsonErr(401, 'Invalid session: ' + (reason ?? 'unknown'))
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const user = { id: userId }

    const body = await req.json()
    const session_id: string = body.session_id
    const user_message: string | null = body.user_message ?? null
    const client_risk: RiskLevel = body.client_risk_level ?? 'none'

    if (!session_id) return jsonErr(400, 'session_id required')

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!session) return jsonErr(404, 'Session not found')

    // Save user message (if present)
    if (user_message) {
      const { data: savedMsg } = await supabase
        .from('messages')
        .insert({
          session_id,
          user_id: user.id,
          role: 'user',
          content: user_message,
          risk_level: client_risk
        })
        .select()
        .single()

      // Log crisis event if needed
      if (client_risk !== 'none' && savedMsg) {
        await supabase.from('crisis_log').insert({
          user_id: user.id,
          session_id,
          message_id: savedMsg.id,
          signal_type: 'explicit',
          signal_level: client_risk,
          signals_detected: [`client_scan:${client_risk}`],
          confidence: 0.85,
          trigger_content: user_message.slice(0, 2000),
          action_taken: client_risk === 'red' ? 'red_protocol_activated' : 'safety_checkin_' + client_risk,
          resources_offered: client_risk === 'red' ? ['988', 'crisis_text_line', '911'] : ['988', 'crisis_text_line']
        })

        // Escalate session flags
        const flagUpdate: Record<string, boolean | string> = {}
        if (client_risk === 'orange') flagUpdate.entered_orange = true
        if (client_risk === 'red') {
          flagUpdate.entered_orange = true
          flagUpdate.entered_red = true
          flagUpdate.mode = 'safety_only'
        }
        if (Object.keys(flagUpdate).length > 0) {
          await supabase.from('sessions').update(flagUpdate).eq('id', session_id)
        }
      }
    }

    // Fetch memory context + all messages for this session
    const { data: memoryData } = await supabase.rpc('get_nevaeh_context', { p_user_id: user.id })

    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    const conversation = (msgs ?? []).filter((m: { role: string }) => m.role !== 'system')

    // Determine if crisis mode
    const { data: sessionLatest } = await supabase
      .from('sessions')
      .select('entered_red, entered_orange, mode')
      .eq('id', session_id)
      .single()

    const crisisActive = sessionLatest?.entered_red || sessionLatest?.entered_orange || client_risk !== 'none'

    // Build system prompt
    const systemPrompt = buildSystemPrompt(memoryData, crisisActive)

    // If no user message yet (opening message case), synthesize an opener instruction
    let claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = conversation as Array<{ role: 'user' | 'assistant'; content: string }>
    if (claudeMessages.length === 0) {
      // Fresh session — prompt NEVAEH to greet
      const totalSessions = (memoryData as { total_sessions?: number } | null)?.total_sessions ?? 0
      claudeMessages = [{
        role: 'user',
        content: totalSessions === 0
          ? '[SYSTEM: This is the user\'s first session. Open with your three-beat greeting: warm hello, the disclosure, and the question "What brought you here tonight?" Do not mention this system note.]'
          : '[SYSTEM: Returning user is here. Open with continuity — reference one specific thread from their last session summary above if there is one, otherwise a warm open question. Do not mention this system note.]'
      }]
    }

    // Call Claude
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages
      })
    })

    if (!claudeResp.ok) {
      const errText = await claudeResp.text()
      console.error('Claude API error', claudeResp.status, errText.slice(0, 500))
      return jsonErr(502, 'NEVAEH is having trouble connecting. Your words are safe. Try again in a moment.')
    }

    const claudeData = await claudeResp.json()
    const assistantText = claudeData.content?.[0]?.type === 'text' ? claudeData.content[0].text : ''
    if (!assistantText) return jsonErr(502, 'NEVAEH went quiet. Try again.')

    // Save assistant message
    await supabase.from('messages').insert({
      session_id,
      user_id: user.id,
      role: 'assistant',
      content: assistantText,
      tokens_in: claudeData.usage?.input_tokens ?? null,
      tokens_out: claudeData.usage?.output_tokens ?? null
    })

    // Update session message_count
    await supabase
      .from('sessions')
      .update({ message_count: (conversation.length as number) + 1 })
      .eq('id', session_id)

    // Compute session risk for client
    const sessionRisk: RiskLevel = sessionLatest?.entered_red
      ? 'red'
      : sessionLatest?.entered_orange
      ? 'orange'
      : client_risk

    return new Response(
      JSON.stringify({ message: assistantText, session_risk: sessionRisk }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('chat error', err)
    return jsonErr(500, 'Something interrupted our connection. Your messages are safe.')
  }
})

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
