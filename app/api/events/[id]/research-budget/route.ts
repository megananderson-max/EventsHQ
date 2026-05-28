import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'
import { getDb } from '@/lib/db'
import { createGmailDraft, isGmailConfigured } from '@/lib/gmail'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(params.id)) as {
      id: number
      name: string
      type: string
      location: string | null
      start_date: string | null
      website: string | null
      contact_name: string | null
      contact_email: string | null
    } | undefined

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const year = event.start_date ? new Date(event.start_date + 'T00:00:00').getFullYear() : new Date().getFullYear()
    const websiteInstruction = event.website
      ? `Also fetch the event website (${event.website}) to find official pricing pages, sponsorship prospectus, or media kit.`
      : ''

    const prompt = `You are a sponsorship researcher. Research the actual pricing for this event and return structured JSON.

EVENT DETAILS:
Name: ${event.name}
Year: ${year}
Type: ${event.type}
Location: ${event.location || 'unknown'}
Website: ${event.website || 'unknown'}

RESEARCH STEPS:
1. Search for "${event.name} sponsorship packages ${year}"
2. Search for "${event.name} exhibitor prospectus"
3. Search for "${event.name} media kit pricing"
4. Search for "${event.name} sponsor tiers cost"
5. ${websiteInstruction}
6. Check LinkedIn and Twitter/X for posts mentioning ${event.name} pricing or sponsorship costs
7. Look for concrete dollar amounts: sponsorship tiers, booth costs, exhibitor fees, venue rates

After completing all research, return ONLY a JSON object (no markdown, no explanation):

{
  "found": true,
  "confidence": "confirmed",
  "budget_low": 15000,
  "budget_high": 50000,
  "source_url": "https://...",
  "source_name": "Official event prospectus",
  "pricing_details": "Gold sponsorship: $25K, Silver: $15K, Booth only: $8K",
  "contact_name": null,
  "contact_email": null,
  "email_draft": null,
  "summary": "Found official pricing on the event website..."
}

If pricing is NOT found, set found: false and include a professional email_draft asking the organizer for their sponsorship prospectus/media kit:
{
  "found": false,
  "confidence": "not_found",
  "budget_low": null,
  "budget_high": null,
  "source_url": null,
  "source_name": null,
  "pricing_details": "",
  "contact_name": null,
  "contact_email": null,
  "email_draft": {
    "subject": "Sponsorship Prospectus Request — [Company Name]",
    "body": "..."
  },
  "summary": "Could not find public pricing information for this event."
}

confidence must be one of: "confirmed", "estimated", "inferred", "not_found"
IMPORTANT: Return ONLY the raw JSON object, no markdown fences.`

    const researchMessage = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      tools: [
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }]
    })

    const allTextBlocks = researchMessage.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (allTextBlocks.length === 0) throw new Error('No text response from AI')

    const finalText = allTextBlocks[allTextBlocks.length - 1].text.trim()

    let result: {
      found: boolean
      confidence: string
      budget_low: number | null
      budget_high: number | null
      source_url: string | null
      source_name: string | null
      pricing_details: string
      contact_name: string | null
      contact_email: string | null
      email_draft: { subject: string; body: string } | null
      summary: string
    }

    try {
      const stripped = finalText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const jsonStart = stripped.indexOf('{')
      const jsonEnd = stripped.lastIndexOf('}') + 1
      if (jsonStart === -1 || jsonEnd === 0) throw new Error('No JSON found')
      result = JSON.parse(stripped.slice(jsonStart, jsonEnd))
    } catch {
      const combined = allTextBlocks.map(b => b.text).join('\n')
      const jsonStart = combined.lastIndexOf('{\n  "found"')
      if (jsonStart !== -1) {
        const jsonEnd = combined.lastIndexOf('}') + 1
        result = JSON.parse(combined.slice(jsonStart, jsonEnd))
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    // For events, we do NOT auto-update the budget (too disruptive to existing line items).
    // Just return results for user review.

    // Create Gmail draft if email draft exists and contact email is known
    let gmailDraftCreated = false
    const toEmail = result.contact_email || event.contact_email
    if (result.email_draft && toEmail && isGmailConfigured()) {
      try {
        await createGmailDraft({
          to: toEmail,
          toName: result.contact_name || event.contact_name || undefined,
          subject: result.email_draft.subject,
          body: result.email_draft.body,
        })
        gmailDraftCreated = true
      } catch (gmailErr) {
        console.error('Gmail draft creation failed:', gmailErr)
      }
    }

    return NextResponse.json({ ...result, gmailDraftCreated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Research budget (event) error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
