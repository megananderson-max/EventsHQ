import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const { responses, dry_run } = await req.json() as { responses: string; dry_run?: boolean }

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(params.id)) as { name: string; type: string; end_date: string; budget_total: number } | undefined
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const prompt = `You are extracting event outcome metrics from a post-event debrief. The event is "${event.name}" (${event.type}), which ended on ${event.end_date}. Total cost was $${event.budget_total?.toLocaleString()}.

The user provided this debrief:
"${responses}"

Extract and return ONLY a JSON object with these fields (use null for anything not mentioned):
{
  "leads_captured": <integer or null>,
  "meetings_booked": <integer or null>,
  "pipeline_generated": <number in dollars or null>,
  "revenue_attributed": <number in dollars or null>,
  "sponsorship_revenue": <number in dollars or null>,
  "attendees_actual": <integer or null>,
  "satisfaction_score": <number 1-10 or null>,
  "notes": "<brief summary of key qualitative outcomes mentioned>",
  "extraction_summary": "<1-2 sentences describing what you extracted and any assumptions made>"
}`

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = (msg.content.find(b => b.type === 'text') as { text: string } | undefined)?.text || ''
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const extracted = JSON.parse(text.slice(jsonStart, jsonEnd))

    // dry_run: return extracted values without saving (used for preview step in UI)
    if (dry_run) {
      return NextResponse.json({ ...extracted, dry_run: true })
    }

    // Save to outcomes
    const existing = (db.prepare('SELECT * FROM event_outcomes WHERE event_id = ?').get(Number(params.id)) ?? {}) as Record<string, unknown>
    db.prepare(`
      INSERT OR REPLACE INTO event_outcomes
      (event_id, leads_captured, meetings_booked, pipeline_generated, revenue_attributed,
       sponsorship_revenue, attendees_actual, satisfaction_score, notes, data_source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_debrief', datetime('now'))
    `).run(Number(params.id),
      extracted.leads_captured ?? existing.leads_captured ?? null,
      extracted.meetings_booked ?? existing.meetings_booked ?? null,
      extracted.pipeline_generated ?? existing.pipeline_generated ?? null,
      extracted.revenue_attributed ?? existing.revenue_attributed ?? null,
      extracted.sponsorship_revenue ?? existing.sponsorship_revenue ?? null,
      extracted.attendees_actual ?? existing.attendees_actual ?? null,
      extracted.satisfaction_score ?? existing.satisfaction_score ?? null,
      extracted.notes ?? existing.notes ?? null)

    return NextResponse.json({
      ...extracted,
      outcomes: db.prepare('SELECT * FROM event_outcomes WHERE event_id = ?').get(Number(params.id))
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
