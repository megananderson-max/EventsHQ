import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { websiteUrl, linkedinUrl, additionalUrls } = body as {
      websiteUrl: string
      linkedinUrl?: string
      additionalUrls?: string[]
    }

    if (!websiteUrl?.trim()) {
      return NextResponse.json({ success: false, error: 'websiteUrl is required' }, { status: 400 })
    }

    const extraUrls = [
      linkedinUrl?.trim(),
      ...(additionalUrls ?? []).map(u => u.trim()),
    ].filter(Boolean) as string[]

    const extraSteps = extraUrls.length
      ? extraUrls.map((u, i) => `${i + 2}. Fetch this additional page: ${u}`).join('\n')
      : '2. Skip (no additional pages provided)'
    const finalStep = extraUrls.length + 2

    const prompt = `You are a company research assistant. Your job is to build a company profile by fetching web pages.

Follow these steps in order:
1. Fetch the company website: ${websiteUrl}
${extraSteps}
${finalStep}. If you need more context (e.g. about their industry or leadership), run one targeted web search.

After gathering information, return ONLY a JSON object (no markdown fences, no other text) with these fields:

{
  "company_name": "Official company name",
  "company_description": "2-3 sentence description of what the company does, who their customers are, and their market position",
  "focus_areas": ["array of matching values from: community, cx, social, executive, technology, marketing, sales — pick the most relevant ones, max 3"],
  "regions": ["array of matching values from: north_america, latin_america, europe, united_kingdom, middle_east, africa, apac, southeast_asia, global — based on where they operate"],
  "speaker_name": "Name of the CEO, founder, or most prominent executive speaker if findable, otherwise null",
  "website_url": "${websiteUrl}"
}

Rules:
- focus_areas must only contain values from this exact list: community, cx, social, executive, technology, marketing, sales
- regions must only contain values from this exact list: north_america, latin_america, europe, united_kingdom, middle_east, africa, apac, southeast_asia, global
- If the company appears global, include "global" in regions
- speaker_name should be null if you cannot confidently identify a named executive
- Output ONLY the raw JSON object — no markdown, no explanation`

    // Use web_fetch and web_search tools (same pattern as ai-setup route).
    // These are server-side tools handled by Anthropic infrastructure; the SDK
    // executes up to 3 agentic iterations and returns the final end_turn response.
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      tools: [
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    // Grab all text blocks; the JSON is in the last one
    const textBlocks = response.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (textBlocks.length === 0) {
      return NextResponse.json({ success: false, error: 'No text response from AI' }, { status: 500 })
    }

    const rawText = textBlocks[textBlocks.length - 1].text.trim()

    // Strip markdown fences if present
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
