import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'
import { getDb } from '@/lib/db'
import { isGmailConfigured } from '@/lib/gmail'

export async function POST(req: NextRequest, { params }: { params: { oid: string } }) {
  try {
    const db = getDb()
    const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(Number(params.oid)) as {
      id: number
      name: string
      type: string | null
      start_date: string | null
      location: string | null
      website: string | null
      organizer: string | null
      expected_attendees: number | null
    } | undefined

    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

    const prompt = `You are helping IgniteTech/Khoros (a B2B enterprise software company — customer engagement platform) request sponsorship pricing for an event.

EVENT:
Name: ${opp.name}
Type: ${opp.type ?? 'conference/event'}
Date: ${opp.start_date ?? 'upcoming'}
Location: ${opp.location ?? 'unknown'}
Organizer: ${opp.organizer ?? 'unknown'}
Website: ${opp.website ?? 'unknown'}

YOUR TASK:
1. Search for "${opp.name} sponsorship contact email"
2. Search for "${opp.name} ${opp.organizer ?? ''} sponsor inquiries"
3. If a website is available or you find one, fetch its sponsor/partner/contact page
4. Find a real email address for sponsorship inquiries (prefer a specific sponsor contact over generic info@ if available)
5. Draft a professional email from IgniteTech/Khoros requesting the sponsorship prospectus

The email_body should:
- Introduce IgniteTech/Khoros as an enterprise software company (customer engagement platform)
- Express genuine interest in the event and its audience
- Request sponsorship tiers, pricing, booth options, and deadlines
- Be 3-4 short paragraphs, professional but warm
- Be addressed to the contact if found, otherwise use a generic salutation

Return ONLY a JSON object (no markdown fences):
{
  "contact_name": "First Last or null",
  "contact_email": "email@domain.com or null",
  "contact_source_url": "URL where contact was found, or null",
  "email_subject": "Sponsorship Inquiry — IgniteTech / Khoros",
  "email_body": "Full email body text..."
}`

    const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      tools: [
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlocks = message.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (textBlocks.length === 0) throw new Error('No text response from AI')

    const finalText = textBlocks[textBlocks.length - 1].text.trim()

    let parsed: {
      contact_name: string | null; contact_email: string | null; contact_source_url: string | null
      email_subject: string; email_body: string
    }

    try {
      const stripped = finalText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const jsonStart = stripped.indexOf('{')
      const jsonEnd = stripped.lastIndexOf('}') + 1
      if (jsonStart === -1 || jsonEnd === 0) throw new Error('No JSON found')
      parsed = JSON.parse(stripped.slice(jsonStart, jsonEnd))
    } catch {
      const combined = textBlocks.map(b => b.text).join('\n')
      const jsonStart = combined.lastIndexOf('{\n  "contact_name"')
      if (jsonStart !== -1) {
        const jsonEnd = combined.lastIndexOf('}') + 1
        parsed = JSON.parse(combined.slice(jsonStart, jsonEnd))
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    const contactFound = !!(parsed.contact_email)

    // Update contact info in DB if found
    if (parsed.contact_name || parsed.contact_email) {
      const updates: string[] = []
      const vals: unknown[] = []
      if (parsed.contact_name) { updates.push('contact_name = ?'); vals.push(parsed.contact_name) }
      if (parsed.contact_email) { updates.push('contact_email = ?'); vals.push(parsed.contact_email) }
      if (updates.length > 0) {
        vals.push(Number(params.oid))
        db.prepare(`UPDATE opportunities SET ${updates.join(', ')} WHERE id = ?`).run(...vals)
      }
    }

    return NextResponse.json({
      contact_found: contactFound,
      contact_email: parsed.contact_email ?? null,
      contact_name: parsed.contact_name ?? null,
      gmail_configured: isGmailConfigured(),
      email_subject: parsed.email_subject,
      email_body: parsed.email_body,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Request pricing error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
