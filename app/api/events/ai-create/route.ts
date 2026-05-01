import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { urls, notes }: { urls: string[]; notes?: string } = body

    if (!urls?.length && !notes) {
      return NextResponse.json({ error: 'Please provide at least one link or some notes about the event.' }, { status: 400 })
    }

    const urlSection = urls?.length
      ? `\nLinks / folder URLs provided:\n${urls.map(u => `- ${u}`).join('\n')}`
      : ''

    const notesSection = notes?.trim()
      ? `\nAdditional context / notes:\n${notes.trim()}`
      : ''

    const today = new Date().toISOString().split('T')[0]

    const prompt = `You are an event management assistant. A user has shared some links or notes about an event they want to create. Your job is to extract as much useful event information as possible from what they've shared.

Today's date: ${today}
${urlSection}
${notesSection}

Instructions:
- Analyze the links and notes to identify the event name, type, dates, location, venue, and description.
- Google Drive folder names (e.g. "drive.google.com/drive/folders/..." may include the event name as part of the URL path or query).
- Look for date clues: year numbers, "Q1/Q2/Q3/Q4", months, seasons.
- Infer event type from context: conference, trade_show, client_summit, sales_kickoff, webinar, internal_meeting.
- If something is uncertain, make a reasonable guess and note it as estimated.
- For fields you cannot reasonably infer, return null.

Return ONLY a JSON object (no other text):
{
  "name": "Full event name",
  "type": "conference | trade_show | client_summit | sales_kickoff | webinar | internal_meeting",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "location": "City, Country or null",
  "venue": "Venue name or null",
  "expected_attendees": 250,
  "budget_total": null,
  "description": "1-2 sentence description of the event based on the information provided",
  "confidence": "high | medium | low",
  "notes": "Brief explanation of what you inferred and from where, so the user can verify"
}`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const text = content.text.trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd))

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('AI create error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
