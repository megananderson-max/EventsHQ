import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { query }: { query: string } = await req.json()

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Please provide a vendor name, website, or description.' }, { status: 400 })
    }

    const prompt = `You are an events management assistant. A user wants to add a vendor to their vendor directory. They've provided the following information about the vendor:

${query.trim()}

Your job is to look up and extract as much useful vendor information as possible. If a website URL is provided, fetch it. If only a name is given, search for the vendor online.

Extract:
- Full company/vendor name
- Category (choose the single best fit): venue, catering, av_tech, staffing, marketing, transport, photo_video, sponsorship, print_branding, logistics, production, technology, media, other
- Primary contact name (if findable)
- Contact email (if findable)
- Contact phone (if findable)
- Website URL (official site)
- Brief notes: what the vendor does, why they're relevant for events, any pricing info found

Return ONLY a JSON object (no other text):
{
  "name": "Vendor name",
  "category": "category_key",
  "contact_name": "Name or null",
  "contact_email": "email@example.com or null",
  "contact_phone": "+1 555 000 0000 or null",
  "website": "https://... or null",
  "notes": "Brief description of what they do and any relevant details",
  "confidence": "high | medium | low",
  "explanation": "One sentence on what you found and how"
}`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      tools: [
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined
    if (!textBlock) throw new Error('No text response from AI')

    const text = textBlock.text.trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd))

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('AI vendor lookup error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
