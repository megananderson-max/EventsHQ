import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { oid: string } }) {
  try {
    const db = getDb()
    const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(Number(params.oid)) as {
      id: number
      name: string
      type: string | null
      start_date: string | null
      location: string | null
      organizer: string | null
      expected_attendees: number | null
      budget_estimate_low: number | null
      budget_estimate_high: number | null
    } | undefined

    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

    // Fetch historical budget line items
    const historicalItems = db.prepare(`
      SELECT e.name, e.type, e.location, e.start_date,
             bi.category, bi.description, bi.planned_amount, bi.is_estimate
      FROM budget_items bi
      JOIN events e ON bi.event_id = e.id
      ORDER BY e.start_date DESC
      LIMIT 100
    `).all() as Array<{
      name: string; type: string | null; location: string | null; start_date: string | null
      category: string; description: string | null; planned_amount: number; is_estimate: number
    }>

    // Fetch similar opportunities with known budgets
    const similarOpps = db.prepare(`
      SELECT name, type, location, expected_attendees, budget_estimate_low, budget_estimate_high
      FROM opportunities
      WHERE (budget_estimate_low IS NOT NULL OR budget_estimate_high IS NOT NULL)
      AND id != ?
      ORDER BY created_at DESC LIMIT 20
    `).all(Number(params.oid)) as Array<{
      name: string; type: string | null; location: string | null
      expected_attendees: number | null; budget_estimate_low: number | null; budget_estimate_high: number | null
    }>

    // Format historical data
    const historicalByEvent: Record<string, typeof historicalItems> = {}
    for (const item of historicalItems) {
      const key = `${item.name} (${item.start_date ?? 'unknown date'})`
      if (!historicalByEvent[key]) historicalByEvent[key] = []
      historicalByEvent[key].push(item)
    }
    const historicalText = Object.entries(historicalByEvent).map(([eventKey, items]) => {
      const lines = items.map(i => `    - ${i.category}: ${i.description ?? ''} $${i.planned_amount.toLocaleString()}${i.is_estimate ? ' (estimate)' : ''}`)
      return `  ${eventKey}:\n${lines.join('\n')}`
    }).join('\n') || '  (no historical data available)'

    const similarText = similarOpps.map(s =>
      `  ${s.name} (${s.type ?? 'event'}, ${s.location ?? 'unknown'}): $${s.budget_estimate_low?.toLocaleString() ?? '?'} – $${s.budget_estimate_high?.toLocaleString() ?? '?'} | ${s.expected_attendees ? `${s.expected_attendees} attendees` : 'attendees unknown'}`
    ).join('\n') || '  (no similar events with known budgets)'

    const prompt = `You are an expert events budget analyst for IgniteTech/Khoros, a B2B enterprise software company.

Estimate the total cost for sponsoring/attending this event based on your knowledge of industry pricing and the company's own historical data provided below.

EVENT TO ESTIMATE:
Name: ${opp.name}
Type: ${opp.type ?? 'unknown'}
Date: ${opp.start_date ?? 'unknown'}
Location: ${opp.location ?? 'unknown'}
Expected attendees: ${opp.expected_attendees ?? 'unknown'}
Organizer: ${opp.organizer ?? 'unknown'}

COMPANY'S HISTORICAL EVENT COSTS (for calibration):
${historicalText}

SIMILAR EVENTS WITH KNOWN BUDGETS:
${similarText}

Return ONLY a JSON object:
{
  "estimated_low": 25000,
  "estimated_high": 75000,
  "line_items": [
    { "category": "sponsorship", "label": "Sponsorship Package", "low": 15000, "high": 50000, "basis": "Typical ${opp.type ?? 'event'} sponsorship for events of this size" },
    { "category": "travel", "label": "Travel (3–4 people)", "low": 3000, "high": 5000, "basis": "Based on location and typical team size" }
  ],
  "confidence_note": "1-2 sentence note about confidence level and what factors influenced the estimate",
  "similar_events_used": ["Event A", "Event B"]
}

Categories: sponsorship, branding, travel, accommodation, av_tech, misc
Be realistic. Use the company's historical data as an anchor. Never fabricate specific package names or tier amounts — describe basis in general terms.`

    const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlocks = message.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (textBlocks.length === 0) throw new Error('No text response from AI')

    const finalText = textBlocks[textBlocks.length - 1].text.trim()

    let result: {
      estimated_low: number; estimated_high: number
      line_items: Array<{ category: string; label: string; low: number; high: number; basis: string }>
      confidence_note: string; similar_events_used: string[]
    }

    try {
      const stripped = finalText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const jsonStart = stripped.indexOf('{')
      const jsonEnd = stripped.lastIndexOf('}') + 1
      if (jsonStart === -1 || jsonEnd === 0) throw new Error('No JSON found')
      result = JSON.parse(stripped.slice(jsonStart, jsonEnd))
    } catch {
      const combined = textBlocks.map(b => b.text).join('\n')
      const jsonStart = combined.lastIndexOf('{\n  "estimated_low"')
      if (jsonStart !== -1) {
        const jsonEnd = combined.lastIndexOf('}') + 1
        result = JSON.parse(combined.slice(jsonStart, jsonEnd))
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    // Update opportunity budget estimates if not already set
    if (
      (result.estimated_low || result.estimated_high) &&
      (opp.budget_estimate_low == null || opp.budget_estimate_low === 0) &&
      (opp.budget_estimate_high == null || opp.budget_estimate_high === 0)
    ) {
      const updates: string[] = []
      const vals: unknown[] = []
      if (result.estimated_low) { updates.push('budget_estimate_low = ?'); vals.push(result.estimated_low) }
      if (result.estimated_high) { updates.push('budget_estimate_high = ?'); vals.push(result.estimated_high) }
      if (updates.length > 0) {
        vals.push(Number(params.oid))
        db.prepare(`UPDATE opportunities SET ${updates.join(', ')} WHERE id = ?`).run(...vals)
      }
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Estimate pricing error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
