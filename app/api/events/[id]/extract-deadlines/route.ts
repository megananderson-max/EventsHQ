import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'
import { getDb } from '@/lib/db'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await req.json()
    const event_name: string = body.event_name
    const event_url: string | undefined = body.event_url
    const event_date: string | undefined = body.event_date

    // Confirm event exists
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(Number(params.id)) as { id: number } | undefined
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const year = event_date
      ? new Date(event_date).getFullYear()
      : new Date().getFullYear()

    const today = new Date().toISOString().slice(0, 10)

    const prompt = `You are a research assistant helping an events team track important deadlines.

Research the following event and find upcoming deadline dates:
- Event: ${event_name}
- Year: ${year}
${event_date ? `- Event date: ${event_date}` : ''}
${event_url ? `- Event website: ${event_url}` : ''}

Use the web_search tool to search for:
1. "${event_name} ${year} speaker submission deadline"
2. "${event_name} ${year} exhibitor registration deadline"
${event_url ? `3. Also use web_fetch to fetch ${event_url} and extract any deadline dates listed there.` : ''}

After research, return ONLY a JSON array (no other text, no markdown fences) of upcoming deadlines:
[
  { "title": "Speaker Submission Deadline", "due_date": "YYYY-MM-DD", "category": "deadline" },
  { "title": "Exhibitor Registration Closes", "due_date": "YYYY-MM-DD", "category": "logistics" }
]

Rules:
- Only include deadlines with due_date after today (${today})
- Limit to 6 most important deadlines
- category must be "deadline" or "logistics"
- If no specific dates are found, return an empty array: []
- Return ONLY the raw JSON array, nothing else`

    // Run the agentic loop — built-in tools are executed server-side by Anthropic.
    // The model will call web_search / web_fetch autonomously and return end_turn
    // with the final JSON in the last text block.
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      tools: [
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    // Collect all text blocks; the final JSON is in the last one
    const textBlocks = response.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    const finalText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text.trim() : ''

    // Parse the JSON array from Claude's response
    let deadlines: { title: string; due_date: string; category: string }[] = []
    if (finalText) {
      try {
        const stripped = finalText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        const arrStart = stripped.indexOf('[')
        const arrEnd = stripped.lastIndexOf(']') + 1
        if (arrStart !== -1 && arrEnd > 0) {
          const parsed = JSON.parse(stripped.slice(arrStart, arrEnd))
          if (Array.isArray(parsed)) {
            deadlines = parsed
          }
        }
      } catch {
        // If parsing fails, treat as no deadlines found
        deadlines = []
      }
    }

    // Insert deadlines into planning_items, skipping duplicates (same event_id + title)
    let added = 0
    for (const deadline of deadlines) {
      if (!deadline.title || !deadline.due_date) continue

      // Skip dates that are not in the future
      if (deadline.due_date <= today) continue

      const exists = db.prepare(
        'SELECT 1 FROM planning_items WHERE event_id = ? AND title = ?'
      ).get(Number(params.id), deadline.title)

      if (!exists) {
        const maxOrder = (
          db.prepare('SELECT MAX(sort_order) as m FROM planning_items WHERE event_id = ?')
            .get(Number(params.id)) as { m: number | null }
        ).m ?? -1

        db.prepare(`
          INSERT INTO planning_items (event_id, title, status, due_date, description, assigned_to, done, sort_order)
          VALUES (?, ?, 'pending', ?, ?, null, 0, ?)
        `).run(
          Number(params.id),
          deadline.title,
          deadline.due_date,
          deadline.category || 'deadline',
          maxOrder + 1
        )
        added++
      }
    }

    return NextResponse.json({ success: true, added })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Extract deadlines error:', message)
    return NextResponse.json({ success: false, error: message })
  }
}
