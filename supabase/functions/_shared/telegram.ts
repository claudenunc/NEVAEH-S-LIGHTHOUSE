// Shared Telegram alert helper for NEVAEH'S LIGHTHOUSE
// Sends crisis/safety alerts to Nathan via @NEVAEH_LIGHTHOUSE_BOT.
//
// Required env vars (set as Supabase edge function secrets):
//   NEVAEH_TELEGRAM_BOT_TOKEN  — the bot token from @BotFather
//   NATHAN_TELEGRAM_CHAT_ID    — the user's chat ID (Telegram user ID works for private chats)
//
// The bot can only message a user AFTER the user has /started a conversation with it.

const TELEGRAM_BOT_TOKEN = Deno.env.get('NEVAEH_TELEGRAM_BOT_TOKEN') ?? ''
const NATHAN_CHAT_ID = Deno.env.get('NATHAN_TELEGRAM_CHAT_ID') ?? ''

export interface AlertContext {
  severity: 'yellow' | 'orange' | 'red' | 'note'
  userEmail?: string
  userName?: string
  sessionId?: string
  triggerContent?: string
  message: string
}

/**
 * Sends a Telegram alert to Nathan. Silently no-ops if secrets are not configured.
 * Never throws — alert failures must not break the user's conversation.
 */
export async function sendTelegramAlert(ctx: AlertContext): Promise<{ ok: boolean; reason?: string }> {
  if (!TELEGRAM_BOT_TOKEN || !NATHAN_CHAT_ID) {
    console.warn('telegram alert skipped: secrets not configured')
    return { ok: false, reason: 'not_configured' }
  }

  const severityEmoji = {
    red: '🚨',
    orange: '⚠️',
    yellow: '🟡',
    note: '🏮'
  }[ctx.severity]

  const header = ctx.severity === 'red'
    ? '*RED CRISIS — IMMEDIATE*'
    : ctx.severity === 'orange'
    ? '*ORANGE — safety check needed*'
    : ctx.severity === 'yellow'
    ? '*YELLOW — monitoring*'
    : '*NEVAEH note*'

  const who = ctx.userName
    ? `*${ctx.userName}*${ctx.userEmail ? ` (${ctx.userEmail})` : ''}`
    : ctx.userEmail
    ? `\`${ctx.userEmail}\``
    : 'anonymous'

  const lines = [
    `${severityEmoji} ${header}`,
    '',
    `👤 ${who}`,
    ''
  ]

  if (ctx.triggerContent) {
    const clipped = ctx.triggerContent.length > 400
      ? ctx.triggerContent.slice(0, 400) + '…'
      : ctx.triggerContent
    lines.push(`💬 "${clipped}"`, '')
  }

  lines.push(ctx.message)

  if (ctx.severity === 'red') {
    lines.push('', '_988 / Crisis Text Line / 911 have been surfaced in-app._')
  }

  const text = lines.join('\n')

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: NATHAN_CHAT_ID,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      }
    )
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('telegram send failed', resp.status, errText.slice(0, 300))
      // Retry once without markdown (Markdown parse errors are the most common failure)
      const retry = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: NATHAN_CHAT_ID,
            text: text.replace(/[*_`]/g, ''),
            disable_web_page_preview: true
          })
        }
      )
      return { ok: retry.ok, reason: retry.ok ? undefined : `status_${retry.status}` }
    }
    return { ok: true }
  } catch (e) {
    console.error('telegram alert threw', e)
    return { ok: false, reason: 'exception' }
  }
}
