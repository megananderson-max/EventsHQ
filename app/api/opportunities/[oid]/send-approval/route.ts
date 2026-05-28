import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'
import { sendGmailEmail, isGmailConfigured } from '@/lib/gmail'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Client is instantiated per-request so env vars are guaranteed to be loaded
function getClient() {
  return new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })
}

interface Opportunity {
  id: number
  name: string
  type: string
  start_date: string | null
  end_date: string | null
  location: string | null
  venue: string | null
  budget_estimate_low: number | null
  budget_estimate_high: number | null
  description: string | null
  recommendation: string
  strategic_fit: string
  why_now: string | null
  networking_value: string | null
  speaking_opportunity: string | null
  expected_attendees: number | null
  focus_area: string | null
  review_notes: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return null
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) } catch { return d }
}

function budgetLabel(opp: Opportunity): string {
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
      approverEmail: string
      approverName: string
      // Optional: caller can pass a pre-edited draft instead of generating one
      emailSubject?: string
      emailBody?: string
      generateOnly?: boolean  // if true, return draft without sending
    }

    if (!body.approverEmail?.trim()) {
      return NextResponse.json({ error: 'approverEmail is required' }, { status: 400 })
    }

    const db = getDb()
    const opp = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(params.oid) as Opportunity | undefined
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

    // Fetch company name from settings
    const companySetting = db.prepare(`SELECT value FROM app_settings WHERE key = 'company_name'`).get() as { value: string } | undefined
    const senderCompany = companySetting?.value || 'our company'

    let subject = body.emailSubject
    let emailBody = body.emailBody

    // Generate AI draft if not provided
    if (!subject || !emailBody) {
      const dateRange = opp.start_date
        ? (opp.end_date && opp.end_date !== opp.start_date
            ? `${fmtDate(opp.start_date)} – ${fmtDate(opp.end_date)}`
            : fmtDate(opp.start_date))
        : 'dates TBD'

      const prompt = `You are writing a professional internal approval request email for an event sponsorship/attendance.

SENDER COMPANY: ${senderCompany}
APPROVER NAME: ${body.approverName}

EVENT DETAILS:
- Name: ${opp.name}
- Type: ${opp.type?.replace(/_/g, ' ')}
- Date: ${dateRange}
- Location: ${opp.location || 'TBD'}${opp.venue ? ` — ${opp.venue}` : ''}
- Expected attendees: ${opp.expected_attendees ? opp.expected_attendees.toLocaleString() : 'TBD'}
- Estimated budget: ${budgetLabel(opp)}
- Strategic fit: ${opp.strategic_fit || 'N/A'}
- Focus area: ${opp.focus_area || 'N/A'}
${opp.description ? `- Description: ${opp.description}` : ''}
${opp.recommendation ? `- AI recommendation: ${opp.recommendation}` : ''}
${opp.why_now ? `- Why now: ${opp.why_now}` : ''}
${opp.networking_value ? `- Networking value: ${opp.networking_value}` : ''}
${opp.speaking_opportunity ? `- Speaking opportunity: ${opp.speaking_opportunity}` : ''}
${opp.review_notes ? `- Internal review notes: ${opp.review_notes}` : ''}

Write a concise, professional approval request email. It should:
1. Open with a brief, direct request for budget approval
2. Summarize what the event is and why it's relevant to ${senderCompany}
3. State the estimated investment clearly
4. Highlight the 2-3 strongest reasons to attend (networking, pipeline, brand visibility, speaking, etc.)
5. Close with a clear call to action and offer to discuss further

Tone: professional but not overly formal. Confident, not apologetic. Keep it under 250 words.

Return ONLY a JSON object:
{
  "subject": "email subject line",
  "body": "full email body (plain text, use \\n for line breaks, no HTML)"
}`

      const message = await getClient().messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = (message.content[0] as { type: 'text'; text: string }).text.trim()
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}') + 1
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as { subject: string; body: string }
      subject = parsed.subject
      emailBody = parsed.body
    }

    // If generateOnly, return draft without sending
    if (body.generateOnly) {
      return NextResponse.json({ subject, body: emailBody })
    }

    // Check Gmail config
    if (!isGmailConfigured()) {
      return NextResponse.json({
        subject,
        body: emailBody,
        gmailNotConfigured: true,
        message: 'Gmail is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER to .env.local to enable direct sending.',
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
      to: body.approverEmail,
      toName: body.approverName,
      subject: subject!,
      body: emailBody!,
      refreshToken,
      fromEmail,
    })

    // Update opportunity status + store approval metadata
    db.prepare(`
      UPDATE opportunities SET
        status = 'waiting_approval',
        approver_name = ?,
        approver_email = ?,
        approval_sent_at = datetime('now'),
        approval_thread_id = ?,
        followup_count = 0
      WHERE id = ?
    `).run(body.approverName, body.approverEmail, result.threadId, params.oid)

    return NextResponse.json({
      success: true,
      sentFrom: fromEmail ?? process.env.GMAIL_USER,
      threadId: result.threadId,
      subject,
      body: emailBody,
    })
  } catch (err) {
    console.error('[send-approval] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
