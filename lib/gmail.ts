/**
 * Gmail API helper — creates drafts and sends emails via Gmail REST API using OAuth2.
 *
 * Supports two modes:
 *   1. App-level (env vars) — for approval/follow-up drafts. Uses GMAIL_REFRESH_TOKEN.
 *   2. Per-user — for pricing inquiry sends. Uses the signed-in user's stored refresh token.
 *
 * Required env vars for app-level mode:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER
 */

export interface DraftEmailOptions {
  to: string
  toName?: string
  subject: string
  body: string
  threadId?: string
  replyToMessageId?: string
}

export interface DraftEmailResult {
  draftId: string
  threadId: string
}

export interface SendEmailResult {
  messageId: string
  threadId: string
}

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_USER
  )
}

/** Exchange a refresh token for a fresh access token */
async function getAccessToken(refreshToken?: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: refreshToken ?? process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail OAuth token refresh failed (${res.status}): ${err}`)
  }
  const data = await res.json() as { access_token: string }
  return data.access_token
}

/** Encode a header value containing non-ASCII characters per RFC 2047 */
function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value // pure ASCII — no encoding needed
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

function buildRfc2822(opts: DraftEmailOptions & { from: string }): string {
  const toHeader = opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to

  const headers = [
    `From: ${opts.from}`,
    `To: ${toHeader}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    opts.replyToMessageId ? `In-Reply-To: ${opts.replyToMessageId}` : null,
    opts.replyToMessageId ? `References: ${opts.replyToMessageId}` : null,
  ].filter(Boolean).join('\r\n')

  return `${headers}\r\n\r\n${opts.body}`
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Creates a Gmail DRAFT using the app-level account (GMAIL_USER).
 * The user must open Gmail and hit Send themselves.
 */
export async function createGmailDraft(opts: DraftEmailOptions): Promise<DraftEmailResult> {
  if (!isGmailConfigured()) {
    throw new Error('Gmail is not configured. Check GMAIL_* env vars.')
  }

  const accessToken = await getAccessToken()
  const from = process.env.GMAIL_USER!
  const raw = base64url(buildRfc2822({ ...opts, from }))

  const messagePayload: Record<string, unknown> = { raw }
  if (opts.threadId) messagePayload.threadId = opts.threadId

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: messagePayload }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail draft creation failed (${res.status}): ${err}`)
  }

  const data = await res.json() as { id: string; message: { id: string; threadId: string } }
  return { draftId: data.id, threadId: data.message.threadId }
}

/**
 * Sends an email immediately.
 *
 * @param opts.refreshToken  Per-user refresh token — if provided, sends from that user's account.
 *                           If omitted, falls back to the app-level GMAIL_REFRESH_TOKEN / GMAIL_USER.
 * @param opts.fromEmail     The "From" address when using a per-user token.
 */
export async function sendGmailEmail(
  opts: DraftEmailOptions & { refreshToken?: string; fromEmail?: string }
): Promise<SendEmailResult> {
  const usingUserToken = !!(opts.refreshToken && opts.fromEmail)

  if (!usingUserToken && !isGmailConfigured()) {
    throw new Error('Gmail is not configured. Check GMAIL_* env vars.')
  }

  const accessToken = await getAccessToken(opts.refreshToken)
  const from = usingUserToken ? opts.fromEmail! : process.env.GMAIL_USER!
  const raw = base64url(buildRfc2822({ ...opts, from }))

  const messagePayload: Record<string, unknown> = { raw }
  if (opts.threadId) messagePayload.threadId = opts.threadId

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail send failed (${res.status}): ${err}`)
  }

  const data = await res.json() as { id: string; threadId: string }
  return { messageId: data.id, threadId: data.threadId }
}
