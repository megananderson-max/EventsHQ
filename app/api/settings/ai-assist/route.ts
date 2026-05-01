import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json()
    if (!description?.trim()) return NextResponse.json({ error: 'No description provided' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are helping a user configure their event opportunity search preferences. Based on the company description below, extract structured preference fields.

Company description:
"""
${description.trim()}
"""

Return ONLY a valid JSON object with these exact fields:
{
  "company_name": "The company or organisation name",
  "brands": "Product or brand names, comma-separated (leave empty string if none mentioned)",
  "speaker_name": "Executive speaker name if mentioned (leave empty string if none)",
  "customer_profile": "A concise 1-2 sentence description of their ideal customer (job titles, company size, industry)",
  "focus_areas": ["array", "of", "applicable", "values"],
  "regions": ["array", "of", "applicable", "values"]
}

Valid focus_area values (only use these exact strings): cx, community, contact_center, social_media, ai_tech, executive
Valid region values (only use these exact strings): north_america, europe, apac

Pick focus_areas and regions that best fit the company described. If unclear, include the most likely ones.
Return ONLY the JSON object, no other text.`
      }]
    })

    const text = (message.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text.trim()
    if (!text) throw new Error('No response')

    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd))

    return NextResponse.json(parsed)
  } catch (e) {
    console.error('AI assist error:', e)
    return NextResponse.json({ error: 'AI assist failed' }, { status: 500 })
  }
}
