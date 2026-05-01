import Anthropic from '@anthropic-ai/sdk'
import type Database from 'better-sqlite3'

const client = new Anthropic()

interface EventInfo {
  id: number
  name: string
  type: string
  location: string | null
  expected_attendees: number | null
  budget_total: number
}

export async function autoGenerateBenchmarkOutcomes(db: Database.Database, event: EventInfo): Promise<void> {
  // Only generate if no outcomes row exists yet
  const existing = db.prepare('SELECT event_id FROM event_outcomes WHERE event_id = ?').get(event.id)
  if (existing) return

  const prompt = `You are an expert B2B events strategist. Provide realistic ROI benchmark estimates for this event based on industry data.

Event: ${event.name}
Type: ${event.type}
Location: ${event.location || 'Not specified'}
Expected Attendees: ${event.expected_attendees || 'Not specified'}
Total Cost: $${event.budget_total?.toLocaleString()}

Return ONLY a JSON object with midpoint estimate values (not ranges):
{
  "leads_captured": <integer, realistic midpoint>,
  "meetings_booked": <integer, realistic midpoint>,
  "pipeline_generated": <dollar amount, realistic midpoint>,
  "revenue_attributed": <dollar amount, conservative midpoint - typically 20-40% of pipeline>,
  "satisfaction_score": <number 1-10, typical for this event type>
}`

  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = (msg.content.find(b => b.type === 'text') as { text: string } | undefined)?.text || ''
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}') + 1
  if (jsonStart === -1 || jsonEnd === 0) return

  const data = JSON.parse(text.slice(jsonStart, jsonEnd))

  db.prepare(`
    INSERT OR IGNORE INTO event_outcomes
      (event_id, leads_captured, meetings_booked, pipeline_generated, revenue_attributed, satisfaction_score, data_source)
    VALUES (?, ?, ?, ?, ?, ?, 'benchmark')
  `).run(
    event.id,
    data.leads_captured ?? null,
    data.meetings_booked ?? null,
    data.pipeline_generated ?? null,
    data.revenue_attributed ?? null,
    data.satisfaction_score ?? null,
  )
}
