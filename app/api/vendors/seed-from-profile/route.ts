import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const FOCUS_LABEL: Record<string, string> = {
  cx: 'CX & Customer Success',
  community: 'Community Management',
  contact_center: 'Contact Center',
  social_media: 'Social Media & MarTech',
  ai_tech: 'AI & Enterprise Tech',
  executive: 'Executive Leadership',
  technology: 'Technology',
  marketing: 'Marketing',
  sales: 'Sales',
}

const REGION_LABEL: Record<string, string> = {
  north_america: 'North America',
  latam: 'Latin America',
  europe: 'Europe',
  uk: 'United Kingdom',
  middle_east: 'Middle East',
  africa: 'Africa',
  apac: 'Asia-Pacific',
  southeast_asia: 'Southeast Asia',
  global: 'Global / Virtual',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      focus_areas = [],
      regions = [],
      company_name = '',
      customer_profile = '',
    } = body as {
      focus_areas?: string[]
      regions?: string[]
      company_name?: string
      customer_profile?: string
    }

    const focusLabels = (focus_areas as string[]).map((f: string) => FOCUS_LABEL[f] ?? f).join(', ') || 'general business'
    const regionLabels = (regions as string[]).map((r: string) => REGION_LABEL[r] ?? r).join(', ') || 'North America'

    const prompt = `You are helping a corporate events manager pre-populate their vendor rolodex for the first time.

Company: ${company_name || 'a B2B tech company'}
Customer focus: ${focusLabels}
Primary regions: ${regionLabels}
${customer_profile ? `About them: ${customer_profile}` : ''}

Generate a list of 18 vendors that this company would realistically use when sponsoring, exhibiting at, or speaking at industry conferences and corporate events. Think about the full lifecycle: event registration tech, AV/production companies, swag/print suppliers, photography, staffing agencies, travel/logistics, and digital marketing tools used around events.

Mix well-known real vendors (e.g. Cvent, Freeman, Swapcard) with placeholder-style names for regional vendors where real names are less universal.

Return ONLY a JSON array with no markdown fences. Each object must have exactly these fields:
- name: string (vendor company name)
- category: one of exactly: venue, catering, av_tech, staffing, marketing, transport, photo_video, print_branding, logistics, production, technology, media, other
- website: string or null (include real website if you know it confidently, otherwise null)
- notes: string (1 sentence — why this vendor is useful for their event type)

Aim for roughly this category distribution: 3 technology, 2 av_tech, 2 production, 2 print_branding, 2 staffing, 1 photo_video, 1 marketing, 1 logistics, 1 transport, 1 media, 2 other.

Output ONLY the raw JSON array — no markdown, no explanation, no other text.`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Strip markdown fences if Claude added them despite instruction
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let vendors: unknown[]
    try {
      vendors = JSON.parse(cleaned)
      if (!Array.isArray(vendors)) throw new Error('Not an array')
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to parse vendor suggestions' }, { status: 500 })
    }

    const VALID_CATEGORIES = new Set([
      'venue', 'catering', 'av_tech', 'staffing', 'marketing', 'transport',
      'photo_video', 'print_branding', 'logistics', 'production', 'technology',
      'media', 'other',
    ])

    // Validate and sanitise each entry
    const sanitised = vendors
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .map(v => ({
        name: String(v.name ?? '').trim(),
        category: VALID_CATEGORIES.has(String(v.category)) ? String(v.category) : 'other',
        website: typeof v.website === 'string' && v.website.startsWith('http') ? v.website : null,
        notes: String(v.notes ?? '').trim(),
      }))
      .filter(v => v.name.length > 0)

    return NextResponse.json({ success: true, vendors: sanitised })
  } catch (err) {
    console.error('[seed-from-profile]', err)
    return NextResponse.json({ success: false, error: 'Failed to generate vendor suggestions' }, { status: 500 })
  }
}
