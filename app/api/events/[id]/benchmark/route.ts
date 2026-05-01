import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

const client = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(params.id)) as {
      name: string; type: string; location: string; expected_attendees: number; budget_total: number
    } | undefined
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const prompt = `You are an expert B2B events strategist. Provide realistic ROI benchmark estimates for this event based on industry data.

Event: ${event.name}
Type: ${event.type}
Location: ${event.location || 'Not specified'}
Expected Attendees: ${event.expected_attendees || 'Not specified'}
Total Cost: $${event.budget_total?.toLocaleString()}

Return ONLY a JSON object:
{
  "leads_min": <integer, low end>,
  "leads_max": <integer, high end>,
  "pipeline_min": <dollar amount, low end>,
  "pipeline_max": <dollar amount, high end>,
  "cost_per_lead_min": <dollar amount, low end>,
  "cost_per_lead_max": <dollar amount, high end>,
  "roi_min": <integer percent, e.g. 100 for 100% ROI, low end>,
  "roi_max": <integer percent, high end>,
  "confidence": "low" | "medium" | "high",
  "basis": "<1-2 sentences explaining what benchmarks/data these estimates are based on>",
  "caveat": "<1 sentence about what most affects ROI for this event type>"
}`

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = (msg.content.find(b => b.type === 'text') as { text: string } | undefined)?.text || ''
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const benchmark = JSON.parse(text.slice(jsonStart, jsonEnd))
    return NextResponse.json(benchmark)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
