import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'
import { sendGmailEmail, isGmailConfigured } from '@/lib/gmail'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

function getClient() {
  return new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })
}

interface OppRow {
  id: number
  name: string
  type: string
  start_date: string | null
  budget_estimate_low: number | null
  budget_estimate_high: number | null
  approver_name: string | null
  approver_email: string | null
  approval_sent_at: string | null
  approval_thread_id: string | null
  last_followup_at: string | null
  followup_count: number
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime()
  const msB = new Date(b).getTime()
  return Math.round(Math.abs(msA - msB) / 86400000)
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function budgetLabel(opp: OppRow): string {
  const lo = opp.budget_estimate_low
  const hi = opp.budget_estimate_high
  if (lo && hi) return `${fmt(lo)} – ${fmt(hi)}`
  if (lo) return `~${fmt(lo)}`
  if (hi) return `~${fmt(hi)}`
  return 'TBD'
}

export async function POST(
  req: NextRequest,
  { params }: { params: { oid: string } }
) {
  try {
    const body = await req.json() as {
      emailSubject?: string
      emailBody?: string
      generateOnly?: boolean
    }

    const db = getDb()
    const opp = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(params.oid) as OppRow | undefined
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    if (!opp.approver_email) return NextResponse.json({ error: 'No approver on record — send initial approval first' }, { status: 400 })

    const companySetting = db.prepare(`SELECT value FROM app_settings WHERE key = 'company_name'`).get() as { value: string } | undefined
    const senderCompany = companySetting?.value || 'our company'

    let subject = body.emailSubject
    let emailBody = body.emailBody

    if (!subject || !emailBody) {
      const sentAt = opp.approval_sent_at || new Date().toISOString()
      const daysSinceSent = daysBetween(sentAt, new Date().toISOString())
      const followupNum = (opp.followup_count || 0) + 1
      const deadlineLine = opp.start_date
        ? `\n- Registration/commitment deadline is approaching (event: ${opp.start_date})`
        : ''

      const prompt = `You are writing follow-up #${followupNum} for an unanswered event approval request.

CONTEXT:
- Sender company: ${senderCompany}
- Approver: ${opp.approver_name || opp.approver_email}
- Event: ${opp.name}
- Original request sent: ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''} ago
- Estimated investment: ${budgetLabel(opp)}${deadlineLine}

Write a short, polite follow-up email. It should:
1. Reference the earlier approval request (don't assume they saw it)
2. Very briefly restate what the event is and the budget ask
3. Create mild urgency if appropriate (deadline, early-bird pricing, etc.)
4. Keep it to 3-4 short paragraphs — shorter than the original request
5. Offer to answer questions or set up a quick call

Tone: warm, professional, not pushy. This is an internal ask to a colleague or manager.

Return ONLY a JSON object:
{
  "subject": "Re: [same subject as original or similar follow-up subject]",
  "body": "full email body (plain text, \\n for line breaks)"
}`

      const message = await getClient().messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = (message.content[0] as { type: 'text'; text: string }).text.trim()
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}') + 1
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as { subject: string; body: string }
      subject = parsed.subject
      emailBody = parsed.body
    }

    if (body.generateOnly) {
      return NextResponse.json({ subject, body: emailBody })
    }

    if (!isGmailConfigured()) {
      return NextResponse.json({
        subject,
        body: emailBody,
        gmailNotConfigured: true,
        message: 'Gmail is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER to .env.local.',
      })
    }

    // Use the signed-in user's Gmail token if available, otherwise fall back to app-level account
    const session = await getServerSession(authOptions)
    let refreshToken: string | undefined
    let fromEmail: string | undefined

    if (session?.user?.email) {
      const tokenRow = db.prepare(
        'SELECT gmail_refresh_token FROM user_tokens WHERE email = ?'
      ).get(session.user.email) as { gmail_refresh_token: string | null } | undefined
      if (tokenRow?.gmail_refresh_token) {
        refreshToken = tokenRow.gmail_refresh_token
        fromEmail = session.user.email
      }
    }

    // Send directly — appears in the sender's Sent folder
    const result = await sendGmailEmail({
      to: opp.approver_email,
      toName: opp.approver_name || undefined,
      subject: subject!,
      body: emailBody!,
      threadId: opp.approval_thread_id || undefined,
      refreshToken,
      fromEmail,
    })

    // Update follow-up tracking
    db.prepare(`
      UPDATE opportunities SET
        last_followup_at = datetime('now'),
        followup_count = COALESCE(followup_count, 0) + 1,
        approval_thread_id = COALESCE(approval_thread_id, ?)
      WHERE id = ?
    `).run(result.threadId, params.oid)

    return NextResponse.json({
      success: true,
      sentFrom: fromEmail ?? process.env.GMAIL_USER,
      threadId: result.threadId,
      subject,
      body: emailBody,
    })
  } catch (err) {
    console.error('[send-followup] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
