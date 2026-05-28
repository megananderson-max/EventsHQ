import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

function getClient() {
  return new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })
}

// GET — return cached docs (or null if none exist yet)
export async function GET() {
  const db = getDb()
  const row = db.prepare('SELECT * FROM workflow_docs ORDER BY id DESC LIMIT 1').get() as {
    id: number; content: string; generated_at: string; trigger: string
  } | undefined
  if (!row) return NextResponse.json({ docs: null, generated_at: null })
  return NextResponse.json({ docs: JSON.parse(row.content), generated_at: row.generated_at, trigger: row.trigger })
}

// POST — regenerate docs with AI and cache the result
export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const body = await req.json().catch(() => ({}))
    const trigger: string = body.trigger || 'manual'

    // Pull current app settings for context
    const settingsRows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    settingsRows.forEach(r => { settings[r.key] = r.value })

    const companyName = settings.opp_company_name || 'the company'
    const speakerName = settings.opp_speaker_name || ''
    const customerProfile = settings.opp_customer_profile || ''

    // Count live data for context richness
    const eventCount = (db.prepare('SELECT COUNT(*) as n FROM events').get() as { n: number }).n
    const oppCount = (db.prepare('SELECT COUNT(*) as n FROM opportunities').get() as { n: number }).n
    const taskCount = (db.prepare('SELECT COUNT(*) as n FROM tasks').get() as { n: number }).n
    const vendorCount = (db.prepare('SELECT COUNT(*) as n FROM vendors').get() as { n: number }).n

    const prompt = `You are writing the "How It Works" documentation page for EventsHQ — an AI-powered corporate events management platform. Your job is to produce accurate, up-to-date documentation that reflects EVERY feature currently in the app.

CURRENT APP CONFIGURATION:
- Company: ${companyName}
${speakerName ? `- Executive speaker: ${speakerName}` : ''}
${customerProfile ? `- Target customer: ${customerProfile}` : ''}
- Live data in system: ${eventCount} events, ${oppCount} opportunities, ${taskCount} tasks, ${vendorCount} vendors

COMPLETE FEATURE INVENTORY — document ALL of the following accurately:

═══ SETUP & PREFERENCES ═══
• Company profile setup: paste a website URL + optional LinkedIn/Twitter/X/Crunchbase pages → AI scrapes all of them, extracts company name, description, target customer profile, focus areas, regions, and saves preferences automatically
• Multi-company portfolio support: configure multiple companies/brands, each scored separately in opportunity discovery
• Executive speaker profile: configure a speaker name so AI can identify events with realistic keynote/speaking opportunities for that person
• App settings persist to database — manual edits always override AI suggestions on re-enrichment
• Per-user Gmail OAuth: each team member signs in with Google once to connect their own Gmail account; emails they send appear in their own Sent folder, not a shared account
• Customisable sidebar: drag nav items to reorder, hover any item to hide it (with confirmation + restore instructions), hidden items appear in a "N hidden · Restore" panel in the footer
• "More" dropdown in sidebar footer contains: Search & Display Settings, Team, How It Works

═══ OPPORTUNITY DISCOVERY ═══
• Fully automated daily scanning: the AI searches the web for conferences, summits, expos, and events matching the configured company profile — runs in the background on every page load, respecting a configured scan frequency
• Multi-channel audience research per event — the AI scrapes ALL of the following for every discovered event:
  - Official event website + sponsor/exhibitor prospectus (verified attendee demographics)
  - X/Twitter: event hashtags, attendee bios and tweets, official event account activity
  - LinkedIn: attendee posts, sponsor company posts, event company page engagement
  - Instagram: event photo galleries showing crowd size and audience types
  - YouTube: session recordings, keynote videos, highlight reels (show speaker caliber and hall sizes)
  - Podcasts: episode mentions and post-event recap interviews
  - Press coverage: TechCrunch, VentureBeat, Forbes attendance figures and growth signals
  - Reddit: candid attendee reviews and honest cost/value assessments
  - Past sponsors: if a direct competitor repeatedly sponsors an event, that confirms ICP audience presence
• ICP fit analysis — after researching each event's audience, AI explicitly cross-references findings against the configured target customer profile:
  - What % of attendees are VP+ decision-makers?
  - What % are at enterprise companies (1,000+ employees)?
  - Do company types match target verticals?
  - Do competitors already sponsor this event (confirming ICP)?
• Event health scoring: "growing / stable / declining / unknown" based on cross-channel signals — attendance trends, social engagement recency, sponsor list growth, press volume
• 0–100 priority score: audience quality vs ICP (35%) + event scale (20%) + competitive battleground importance (20%) + speaking opportunity (15%) + cost efficiency (10%)
• strategic_fit: "High" only if 30%+ of audience are genuine ICP matches at decision-maker level
• recommendation field: "Sponsor / Speak / Evaluate" — never just "Attend"
• Do Not Attend learning: when an event is marked Do Not Attend with a reason, those signals are fed back into future scans as negative filters (similar organiser, audience, format, cost level are all avoided)
• Approved events learning: events that are approved or added to calendar are used as positive signals to find more like them
• Returned-to-pipeline learning: when an event is sent back from review with a reason, those reasons calibrate future scoring
• Manual scan trigger: users can run a fresh scan at any time with a custom focus area and region filter
• Opportunity details include: venue, organiser, budget estimate range, past sponsors, speaking opportunity assessment, networking value, why-now rationale, audience research notes

═══ PIPELINE MANAGEMENT ═══
• Three-stage pipeline: Pipeline → Under Review → Approved/Do Not Attend
• "Move to Under Review" with optional notes
• "Do Not Attend" with reason logging (feeds AI learning loop)
• Return to Pipeline with reason (also feeds AI learning)
• Pricing research: AI finds the event's actual contact/organiser and drafts a pricing inquiry email
• Email editing: the AI-drafted email is shown in an editable form before sending — user can adjust To, subject, and body
• Direct send from app: approved Gmail-connected users send the email directly from their own account; it appears in their Gmail Sent folder
• Approval workflow: send a "request approval" email to a configured approver with budget estimate; follow-up emails also send directly
• Subject line encoding: non-ASCII characters (em dashes etc.) are RFC 2047 encoded to prevent garbled subjects

═══ EVENT PLANNING ═══
• AI Setup tab: paste any URL or document → AI extracts event details and pre-populates all fields
• Tasks tab: AI generates a starter checklist based on event type; tasks can be assigned to team members with due dates and priorities
• Budget tab: AI pre-populates line items by event category; tracks planned vs actual spend; shows variance
• Vendors tab: AI suggests relevant vendors by event type; vendor contacts stored globally and reused
• Run of Show tab: day-by-day schedule with owner, location, and status per item
• Staff tab: track team assignments, travel dates, hotel, and contact info per event
• Notes tab: free-form event notes
• All Tasks view: cross-event task board showing every open task across all events, filterable by owner/status/priority

═══ EXECUTION ═══
• Event Day tab: live run of show, on-site checklist, staff check-in tracker
• Execution Notes: capture on-site learnings — these are read by AI when setting up future similar events

═══ OUTCOMES & ROI ═══
• Post-event upload: drag a file, paste a link (Notion, Google Doc, etc.), or type notes → AI reads it and extracts leads, pipeline, revenue, meetings booked, attendee count, satisfaction score
• Review before saving: AI shows extracted numbers for confirmation before writing to DB
• ROI calculation: automatic (revenue attributed ÷ total spend)
• Cost per lead: automatic
• Benchmarking: outcomes compared against similar past events automatically
• ROI & Outcomes page: aggregated dashboard across all events

═══ TEAM ═══
• Team member management: add/edit team members with name, email, role, job function
• Task assignment: tasks can be assigned to any team member
• My Tasks view (sidebar): shows only tasks assigned to the current user, sorted by deadline, with notification badge when new tasks appear

═══ CALENDAR ═══
• Full calendar view of all events with month/week navigation

═══ NOTIFICATIONS ═══
• Overdue tasks, tasks due soon, upcoming events flagged automatically
• Notification badge on sidebar updates in real time (checked every 60 seconds)

═══ VENDORS ═══
• Global vendor database: contacts persist across events and can be reused
• Vendor categories, contract values, status tracking

Now produce the documentation as a JSON array of step objects. Each step represents one phase of the workflow. Cover ALL phases above — do not skip anything. Be specific about what the AI does automatically vs what the user does manually.

Return ONLY a valid JSON array with this exact structure (no markdown, no other text):
[
  {
    "number": 1,
    "phase": "Setup",
    "color": "violet",
    "icon": "<SVG path d= value>",
    "title": "Short action title",
    "description": "2-3 sentences describing this phase and its business value",
    "aiActions": ["What AI does automatically in this phase"],
    "humanActions": ["What the user does in this phase"],
    "output": "What exists at the end of this phase",
    "learning": "Optional: how decisions here improve future results (null if not applicable)"
  }
]

Color options: violet, blue, sky, amber, green, orange, teal (use varied colors across the steps).
Icon: use a simple Heroicons outline path that fits the phase (just the d= value, no other SVG attributes).
Keep aiActions and humanActions as concise bullet-point strings (not full sentences).
learning should only be set when this phase genuinely has a feedback loop — not every phase does.
Aim for 8–10 steps covering the full lifecycle from Setup → Learning.`

    const message = await getClient().messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined
    if (!textBlock) throw new Error('No response from AI')

    const text = textBlock.text.trim()
    const jsonStart = text.indexOf('[')
    const jsonEnd = text.lastIndexOf(']') + 1
    if (jsonStart === -1 || jsonEnd === 0) throw new Error('No JSON array in response')

    const steps = JSON.parse(text.slice(jsonStart, jsonEnd))
    const now = new Date().toISOString()

    // Upsert — keep only the latest row
    db.exec('DELETE FROM workflow_docs')
    db.prepare('INSERT INTO workflow_docs (content, generated_at, trigger) VALUES (?, ?, ?)').run(
      JSON.stringify(steps), now, trigger
    )

    return NextResponse.json({ docs: steps, generated_at: now, trigger })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('workflow-docs generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
