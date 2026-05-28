import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { websiteUrl, companyNameHint } = body as {
      websiteUrl: string
      companyNameHint?: string
    }

    if (!websiteUrl?.trim()) {
      return NextResponse.json({ success: false, error: 'websiteUrl is required' }, { status: 400 })
    }

    const nameHintLine = companyNameHint?.trim()
      ? `The company name may be "${companyNameHint.trim()}" — use this as a search hint if needed.`
      : ''

    const prompt = `You are a company research assistant. Your job is to build a rich company profile from a single website URL — you must discover everything else yourself automatically.

WEBSITE: ${websiteUrl}
${nameHintLine}

RESEARCH STEPS — execute ALL of the following using your web_fetch and web_search tools:

STEP 1 — Fetch the main website
  • Fetch ${websiteUrl} and read the homepage.
  • Look for links to About, Team, or Leadership pages and fetch those too.

STEP 2 — Auto-discover social profiles (do not ask the user — find them yourself)
  • Search: "${companyNameHint || websiteUrl} LinkedIn company page" → fetch the result
  • Search: "${companyNameHint || websiteUrl} Twitter OR X" → fetch the result
  • Search: "${companyNameHint || websiteUrl} Crunchbase" → fetch the result if found
  • These reveal audience type, industry, employee count, and funding stage.

STEP 3 — Identify the executive speaker
  • From the About/Team page or LinkedIn, find the CEO, founder, or most prominent public-facing executive.

STEP 4 — Build the profile
  • Combine everything found. Be specific about the target customer — not "enterprises" but "VP/Director of Customer Experience at B2B companies with 500+ employees".
  • Set social_profiles_found = true if you successfully fetched a LinkedIn OR Twitter/X page for this company; false if you only had the main website.

Return ONLY a JSON object (no markdown fences, no other text):

{
  "company_name": "Official company name",
  "company_description": "2-3 sentences: what they do, who their specific customers are (role + company size), and market position",
  "focus_areas": ["values from this exact list only: community, cx, social, executive, technology, marketing, sales — max 3"],
  "regions": ["values from this exact list only: north_america, latin_america, europe, united_kingdom, middle_east, africa, apac, southeast_asia, global"],
  "speaker_name": "CEO or founder name if confidently identified, otherwise null",
  "website_url": "${websiteUrl}",
  "social_profiles_found": true
}

Rules:
- focus_areas: only values from the exact list above
- regions: only values from the exact list above; include "global" if they operate worldwide
- speaker_name: null if not confidently identified
- social_profiles_found: true if you fetched at least one LinkedIn or Twitter/X profile; false otherwise
- Output ONLY the raw JSON — no markdown, no explanation`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      tools: [
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlocks = response.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (textBlocks.length === 0) {
      return NextResponse.json({ success: false, error: 'No text response from AI' }, { status: 500 })
    }

    const rawText = textBlocks[textBlocks.length - 1].text.trim()
    const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const jsonStart = stripped.indexOf('{')
    const jsonEnd = stripped.lastIndexOf('}') + 1
    if (jsonStart === -1 || jsonEnd === 0) {
      return NextResponse.json({ success: false, error: 'Could not parse AI response as JSON' }, { status: 500 })
    }

    const profile = JSON.parse(stripped.slice(jsonStart, jsonEnd)) as {
      company_name: string
      company_description: string
      focus_areas: string[]
      regions: string[]
      speaker_name: string | null
      website_url: string
      social_profiles_found: boolean
    }

    return NextResponse.json({ success: true, profile })
  } catch (err) {
    console.error('[enrich-profile] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
