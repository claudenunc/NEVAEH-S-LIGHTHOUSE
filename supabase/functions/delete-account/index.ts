// NEVAEH'S LIGHTHOUSE — /delete-account edge function
// Hard-deletes the authenticated user and all their data.
// Cascades through auth.users → public.users → messages, sessions, crisis_log,
// profiles, growth_arc. Fire-and-forget Telegram notification to Nathan.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendTelegramAlert } from '../_shared/telegram.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

    // Require an explicit confirmation string in the body so this cannot
    // fire from a stray request, accidental click, or XSS-driven fetch.
    const body = await req.json().catch(() => ({}))
    if (body.confirmation !== 'DELETE MY ACCOUNT') {
      return jsonErr(400, 'Confirmation required')
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Capture who is leaving so we can notify Nathan AFTER deletion succeeds.
    const { data: userRow } = await supabase
      .from('users')
      .select('email, display_name, created_at')
      .eq('id', userId)
      .maybeSingle()

    const who = userRow?.display_name
      ? `${userRow.display_name} (${userRow.email ?? 'no email'})`
      : userRow?.email ?? 'unknown user'

    // Count what we're about to delete for the audit ping.
    const { count: msgCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    const { count: sessCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Hard delete at the root — FKs cascade through all public tables.
    // We use the admin client (service role) which has permission to
    // delete from auth.users. This is the only way to fully remove
    // the account including authentication credentials.
    const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(userId)
    if (authDeleteErr) {
      console.error('auth.admin.deleteUser failed', authDeleteErr)
      return jsonErr(500, 'Could not delete account: ' + (authDeleteErr.message ?? 'unknown'))
    }

    sendTelegramAlert({
      severity: 'note',
      userEmail: userRow?.email,
      userName: userRow?.display_name,
      message: `\u{1F91D} ACCOUNT DELETED\n\n${who} deleted their account and all their data.\n\nRemoved: ${msgCount ?? 0} messages, ${sessCount ?? 0} sessions, and their profile / growth arc / crisis history.\n\nThis was the user's right under our privacy policy.`
    }).catch((e) => console.error('delete-account alert dispatch error', e))

    return new Response(JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('delete-account error', err)
    return jsonErr(500, 'Something went wrong. Please email nathanmichel@nvvisions.com to delete manually.')
  }
})

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
