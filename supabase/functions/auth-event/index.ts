// NEVAEH'S LIGHTHOUSE — /auth-event edge function
// Fire-and-forget Telegram notification when users sign up or sign in.
// Called from the client AuthContext after auth success.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendTelegramAlert } from '../_shared/telegram.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

type AuthEvent = 'signup' | 'signin'

function decodeJwtSub(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = '='.repeat((4 - (payloadB64.length % 4)) % 4)
    const payload = JSON.parse(atob(payloadB64 + pad))
    if (payload.role !== 'authenticated') return null
    const sub = payload.sub
    if (!sub || typeof sub !== 'string') return null
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return sub
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonErr(401, 'Missing authorization')

    const userId = decodeJwtSub(authHeader)
    if (!userId) return jsonErr(401, 'Invalid session')

    const body = await req.json().catch(() => ({}))
    const hintedEvent: AuthEvent = body.event === 'signup' ? 'signup' : 'signin'

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: userRow } = await supabase
      .from('users')
      .select('email, display_name, created_at')
      .eq('id', userId)
      .maybeSingle()

    // Server-side first-time detection — robust to email-confirmation flows where
    // signUp() returns without a session and the first notification we actually
    // see is from signIn() after email-link click.
    const { count: priorSessions } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const isNew = hintedEvent === 'signup' || (priorSessions ?? 0) === 0

    const who = userRow?.display_name
      ? `${userRow.display_name} (${userRow.email ?? 'no email'})`
      : userRow?.email ?? 'unknown user'

    const header = isNew ? 'NEW TESTER SIGNED UP' : 'Tester signed in'
    const message = isNew
      ? `\u{1F31F} ${who}\n\nFirst session incoming. Watch for their first message and Journey entry. They've accepted the Terms and Privacy policy explicitly (consent recorded in DB).`
      : `\u{1F44B} ${who} is back.`

    // Fire-and-forget. Never block the client response.
    sendTelegramAlert({
      severity: 'note',
      userEmail: userRow?.email,
      userName: userRow?.display_name,
      message: `${header}\n\n${message}`
    }).catch((e) => console.error('auth-event alert dispatch error', e))

    return new Response(JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('auth-event error', err)
    // Notification failures must not break the user's experience.
    return new Response(JSON.stringify({ ok: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
