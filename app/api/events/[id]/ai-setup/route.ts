import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'
import { getDb } from '@/lib/db'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await req.json()
    // Support both old single-URL format and new multi-URL + text format
    const urls: string[] = body.urls || (body.drive_folder_url ? [body.drive_folder_url] : [])
    const pastedContent: string | null = body.pasted_content || body.drive_content || null
    const isNewEvent: boolean = body.is_new_event === true
    const oppContext: string = body.opportunity_context || ''

    // Get the event details
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(params.id)) as {
      id: number; name: string; type: string; status: string;
      start_date: string; end_date: string; location: string;
      venue: string; description: string; budget_total: number
    } | undefined

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    // Get existing data so Claude doesn't duplicate
    const existingBudget = db.prepare('SELECT description FROM budget_items WHERE event_id = ?').all(Number(params.id)) as { description: string }[]
    const existingPlanning = db.prepare('SELECT title FROM planning_items WHERE event_id = ?').all(Number(params.id)) as { title: string }[]
    const existingVendors = db.prepare('SELECT v.name FROM event_vendors ev JOIN vendors v ON ev.vendor_id = v.id WHERE ev.event_id = ?').all(Number(params.id)) as { name: string }[]

    const existingBudgetList = existingBudget.map(b => `- ${b.description}`).join('\n') || 'None'
    const existingPlanningList = existingPlanning.map(p => `- ${p.title}`).join('\n') || 'None'
    const existingVendorList = existingVendors.map(v => `- ${v.name}`).join('\n') || 'None'

    const urlContext = urls.length > 0
      ? `\n\n═══════════════════════════════════\nUSER-PROVIDED LINKS (fetch and read these to extract budget/vendor data):\n═══════════════════════════════════\n${urls.map((u, i) => `${i + 1}. ${u}`).join('\n')}\n\nIMPORTANT: Use the web_fetch tool to fetch each URL above and extract any pricing, invoice amounts, vendor names, or planning details you find.`
      : ''
    const pastedContext = pastedContent
      ? `\n\n═══════════════════════════════════\nPASTED CONTENT FROM USER:\n═══════════════════════════════════\n${pastedContent.slice(0, 10000)}`
      : ''
    const oppContextSection = oppContext
      ? `\n\n═══════════════════════════════════\nOPPORTUNITY INTELLIGENCE:\n═══════════════════════════════════\n${oppContext}`
      : ''
    const driveContext = urlContext + pastedContext + oppContextSection

    const newEventInstructions = isNewEvent ? `
═══════════════════════════════════
⚡ NEW EVENT — DEEP RESEARCH REQUIRED
═══════════════════════════════════
This event was JUST CONFIRMED from our pipeline. Before generating anything, you MUST conduct thorough web research:

1. SEARCH for official sponsorship/exhibit packages:
   - Search: "${event.name} sponsorship packages"
   - Search: "${event.name} exhibitor prospectus ${new Date(event.start_date || '').getFullYear() || ''}"
   - Fetch the event website if available to find real pricing tiers

2. SEARCH for travel & accommodation costs:
   - Search: "flights Austin TX to ${event.location} ${event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', {month:'long', year:'numeric'}) : ''}"
   - Search: "hotels near ${event.venue || event.location} conference rate"

3. SEARCH for event vendors and past exhibitors:
   - Search: "${event.name} exhibitors list"
   - Search: "${event.name} sponsors past years"
   - Note any AV, photography, freight, or exhibit services mentioned

4. SEARCH for event details to enrich the overview:
   - Confirm venue, attendance figures, audience profile
   - Note any speaking/keynote opportunities for Khoros/IgniteTech

Use REAL dollar figures found online wherever possible (is_estimate=0). Only fall back to estimates if no pricing is publicly available.
` : ''

    const prompt = `You are an expert events manager for IgniteTech and Khoros. A new event has been confirmed and you need to generate a complete event setup including budget line items, a planning checklist, and vendor suggestions.
${newEventInstructions}
═══════════════════════════════════
EVENT DETAILS:
═══════════════════════════════════
Name: ${event.name}
Type: ${event.type}
Status: ${event.status}
Date: ${event.start_date || 'TBD'}${event.end_date ? ` – ${event.end_date}` : ''}
Location: ${event.location || 'TBD'}
Venue: ${event.venue || 'TBD'}
Description: ${event.description || 'None provided'}
Current Budget Total: $${event.budget_total?.toLocaleString() || '0'}${driveContext}

═══════════════════════════════════
ALREADY EXISTS (DO NOT DUPLICATE):
═══════════════════════════════════
Existing budget items:
${existingBudgetList}

Existing planning items:
${existingPlanningList}

Existing vendors:
${existingVendorList}

═══════════════════════════════════
COMPANY CONTEXT:
═══════════════════════════════════
IgniteTech / Khoros — enterprise customer engagement software (Community, Social Media, Digital Care, Contact Center, Aurora AI). Events are typically sponsorships, conferences, or trade shows where Khoros exhibits, speaks, or attends as a sponsor.

Typical event cost categories for Khoros events:
- Sponsorship packages (confirmed contracted costs)
- Branding & booth materials
- Travel (flights, ground transport) — assume 3-4 attendees unless event data specifies otherwise
- Accommodation (hotel rooms) — assume 3-4 rooms unless event data specifies otherwise
- Per diem (meals & incidentals) — $75/person/day, assume 3-4 people unless event data specifies otherwise
- Booth backdrop / printed materials — budget $1,000-$1,200 for an 8ft×8ft backdrop including shipping
- Photographer / Videographer — budget $1,000
- Contingency / Slush Fund — flat $2,000

═══════════════════════════════════
YOUR TASK:
═══════════════════════════════════
Generate a comprehensive event setup. Return ONLY a JSON object (no other text):

{
  "budget_items": [
    {
      "category": "sponsorship",
      "description": "Item description",
      "planned_amount": 25000,
      "is_estimate": 0,
      "status": "approved",
      "payment_due_date": "YYYY-MM-DD or null",
      "notes": "Context about this item"
    }
  ],
  "planning_items": [
    "Planning task or action item text"
  ],
  "vendor_suggestions": [
    {
      "name": "Vendor/Organizer name",
      "category": "sponsorship",
      "notes": "Why this vendor, contact info if known"
    }
  ],
  "event_updates": {
    "description": "Enriched 2-3 sentence description of the event based on research findings — only if you found better info than what was provided",
    "venue": "Confirmed venue name if found online, otherwise null"
  },
  "outcomes": {
    "leads_captured": null,
    "meetings_booked": null,
    "pipeline_generated": null,
    "revenue_attributed": null,
    "attendees_actual": null,
    "satisfaction_score": null
  },
  "suggested_budget_total": 50000,
  "summary": "2-3 sentence summary of the event setup, what was found online, and key actions needed"
}

Rules:
- budget_items: is_estimate=0 for anything sourced from official pricing, is_estimate=1 for travel/accommodation/estimates. status: "approved" if contracted, "pending" if estimate.
- planning_items: ordered from pre-event prep through post-event. Include urgent payment items first if applicable. 20-40 items.
- vendor_suggestions: only suggest vendors NOT already in the existing list above.
- suggested_budget_total: realistic total across all items.
- Categories for budget: sponsorship, branding, travel, accommodation, contingency, catering, av_tech, staffing, marketing, misc
- event_updates: only include fields where you found genuinely better data than what was provided. Set to null or omit fields if no improvement.

IMPORTANT: If URLs were provided above, use web_fetch to read them FIRST before generating budget items. Extract real dollar amounts, vendor names, and invoice details from the fetched content. Prefer real extracted data over estimates where available.

If the uploaded content includes post-event reports, attendance figures, survey results, or revenue data, extract outcome metrics into the outcomes field.`

    // ── Phase 1: Research ──────────────────────────────────────────────────────
    // Run web research with tools. We grab ALL text blocks and concatenate them
    // so that any research summaries the model writes between tool calls are
    // captured in full, even when the final JSON ends up in the last text block.
    const researchMessage = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 16000,
      tools: [
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt + '\n\nIMPORTANT: After all research, output ONLY the raw JSON object. No markdown fences, no explanation before or after the JSON.' }]
    })

    // Collect ALL text blocks (the model may emit partial text between tool calls)
    const allTextBlocks = researchMessage.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (allTextBlocks.length === 0) throw new Error('No text response from AI')

    // The JSON is always in the LAST text block (the final response after tools complete)
    const finalText = allTextBlocks[allTextBlocks.length - 1].text.trim()

    let setup: {
      budget_items: Array<{
        category: string; description: string; planned_amount: number;
        is_estimate: number; status: string; payment_due_date: string | null; notes: string
      }>
      planning_items: string[]
      vendor_suggestions: Array<{ name: string; category: string; notes: string }>
      event_updates?: { description?: string | null; venue?: string | null }
      outcomes?: {
        leads_captured?: number | null
        meetings_booked?: number | null
        pipeline_generated?: number | null
        revenue_attributed?: number | null
        attendees_actual?: number | null
        satisfaction_score?: number | null
      }
      suggested_budget_total: number
      summary: string
    }

    try {
      // Strip markdown code fences if the model wrapped the JSON anyway
      const stripped = finalText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const jsonStart = stripped.indexOf('{')
      const jsonEnd = stripped.lastIndexOf('}') + 1
      if (jsonStart === -1 || jsonEnd === 0) throw new Error('No JSON object found in AI response')
      setup = JSON.parse(stripped.slice(jsonStart, jsonEnd))
    } catch (parseErr) {
      // If the last text block failed, try concatenating all text blocks as a fallback
      const combined = allTextBlocks.map(b => b.text).join('\n')
      const jsonStart = combined.lastIndexOf('{\n  "budget_items"')
      if (jsonStart !== -1) {
        const jsonEnd = combined.lastIndexOf('}') + 1
        setup = JSON.parse(combined.slice(jsonStart, jsonEnd))
      } else {
        console.error('AI response text:', finalText.slice(0, 500))
        throw new Error(`Failed to parse AI response: ${parseErr instanceof Error ? parseErr.message : 'unknown'}`)
      }
    }

    // ── Phase 2: If AI returned empty arrays, do a targeted generation call ───
    // This is a fallback in case the research phase exhausted context and
    // couldn't produce the JSON. We ask again with the research context injected.
    const needsGeneration = !setup.budget_items?.length && !setup.planning_items?.length
    if (needsGeneration) {
      // Build a compact research summary from any tool_result blocks in the first response
      const toolResults = researchMessage.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter(b => (b as any).type === 'tool_result' || b.type === 'tool_use')
        .map(b => JSON.stringify(b).slice(0, 2000))
        .join('\n---\n')
        .slice(0, 8000)

      const genPrompt = `You are an expert events manager for IgniteTech/Khoros.

Generate a complete budget and planning checklist for this event based on the research below.

EVENT:
Name: ${event.name}
Type: ${event.type}
Date: ${event.start_date || 'TBD'} – ${event.end_date || 'TBD'}
Location: ${event.location || 'TBD'}
Venue: ${event.venue || 'TBD'}
Budget total: $${event.budget_total?.toLocaleString() || '0'}
${oppContext ? `\nOpportunity context:\n${oppContext}` : ''}

RESEARCH FINDINGS:
${toolResults || 'No web research available — use industry standard estimates for a conference sponsorship of this type.'}

COMPANY CONTEXT:
IgniteTech / Khoros — enterprise software. Events are sponsorships/conferences.
Assume 3-4 attendees, $75/person/day per diem, 8ft×8ft booth (~$1,200 incl. shipping), photographer $1,000, contingency $2,000.

Return ONLY this JSON (no other text):
{
  "budget_items": [
    { "category": "sponsorship", "description": "...", "planned_amount": 25000, "is_estimate": 0, "status": "approved", "payment_due_date": null, "notes": "..." }
  ],
  "planning_items": [
    "Task text"
  ],
  "vendor_suggestions": [
    { "name": "...", "category": "...", "notes": "..." }
  ],
  "event_updates": { "description": null, "venue": null },
  "outcomes": {
    "leads_captured": null,
    "meetings_booked": null,
    "pipeline_generated": null,
    "revenue_attributed": null,
    "attendees_actual": null,
    "satisfaction_score": null
  },
  "suggested_budget_total": 50000,
  "summary": "2-3 sentence summary of key actions and budget highlights."
}

Rules:
- budget_items: 8-15 items covering sponsorship, travel (flights + ground), accommodation (hotel rooms), per diem, booth/branding materials, photographer, contingency, and any event-specific costs found in research. is_estimate=1 for estimated costs.
- planning_items: 25-35 tasks from contract signing through post-event follow-up, in chronological order.
- Categories: sponsorship, branding, travel, accommodation, contingency, catering, av_tech, staffing, marketing, misc
- outcomes: if any post-event data appears in the provided content (attendance figures, survey scores, revenue), extract it; otherwise leave all fields null.`

      const genMessage = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: genPrompt }]
      })

      const genText = (genMessage.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.trim() || ''
      try {
        const stripped = genText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        const jsonStart = stripped.indexOf('{')
        const jsonEnd = stripped.lastIndexOf('}') + 1
        if (jsonStart !== -1) setup = JSON.parse(stripped.slice(jsonStart, jsonEnd))
      } catch {
        console.error('Fallback generation also failed:', genText.slice(0, 300))
      }
    }

    // Insert budget items
    const insBudget = db.prepare(`
      INSERT INTO budget_items (event_id, category, description, planned_amount, actual_amount, status, payment_due_date, notes, is_estimate)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
    `)
    let budgetAdded = 0
    for (const item of (setup.budget_items || [])) {
      // Skip if description already exists
      const exists = existingBudget.some(b => b.description.toLowerCase() === item.description.toLowerCase())
      if (!exists) {
        insBudget.run(
          Number(params.id),
          item.category || 'misc',
          item.description,
          item.planned_amount || 0,
          item.status || 'pending',
          item.payment_due_date || null,
          item.notes || null,
          item.is_estimate ?? 1
        )
        budgetAdded++
      }
    }

    // Insert planning items
    const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM planning_items WHERE event_id = ?').get(Number(params.id)) as { m: number | null }).m ?? -1
    const insPlanning = db.prepare('INSERT INTO planning_items (event_id, title, done, sort_order, status) VALUES (?, ?, 0, ?, ?)')
    let planningAdded = 0
    let sortOrder = maxOrder + 1
    for (const item of (setup.planning_items || [])) {
      // planning_items can be a string or an object with title + status
      const title = typeof item === 'string' ? item : (item as { title?: string }).title || ''
      const status = typeof item === 'object' ? ((item as { status?: string }).status || 'todo') : 'todo'
      const exists = existingPlanning.some(p => p.title.toLowerCase() === title.toLowerCase())
      if (!exists && title.trim()) {
        insPlanning.run(Number(params.id), title.trim(), sortOrder++, status)
        planningAdded++
      }
    }

    // Apply any event detail improvements found during research
    if (setup.event_updates) {
      const updates = setup.event_updates
      const fields: string[] = []
      const vals: unknown[] = []
      if (updates.description?.trim()) { fields.push('description = ?'); vals.push(updates.description.trim()) }
      if (updates.venue?.trim()) { fields.push('venue = ?'); vals.push(updates.venue.trim()) }
      if (fields.length > 0) {
        vals.push(Number(params.id))
        db.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
      }
    }

    // Update budget total if suggested
    if (setup.suggested_budget_total && setup.suggested_budget_total > (event.budget_total || 0)) {
      const actualTotal = (db.prepare('SELECT SUM(planned_amount) as t FROM budget_items WHERE event_id = ?').get(Number(params.id)) as { t: number }).t || 0
      db.prepare('UPDATE events SET budget_total = ? WHERE id = ?').run(actualTotal, Number(params.id))
    }

    // Auto-link any suggested vendors that already exist in the vendor directory
    const allVendors = db.prepare('SELECT id, name FROM vendors').all() as { id: number; name: string }[]
    const insEventVendor = db.prepare(`
      INSERT OR IGNORE INTO event_vendors (event_id, vendor_id, status) VALUES (?, ?, 'shortlisted')
    `)
    let vendorsLinked = 0
    for (const suggestion of (setup.vendor_suggestions || [])) {
      const sugName = (suggestion.name as string || '').toLowerCase().trim()
      const match = allVendors.find(v =>
        v.name.toLowerCase().trim() === sugName ||
        v.name.toLowerCase().includes(sugName) ||
        sugName.includes(v.name.toLowerCase().trim())
      )
      if (match && !existingVendors.some(ev => ev.name.toLowerCase() === match.name.toLowerCase())) {
        const r = insEventVendor.run(Number(params.id), match.id)
        if (r.changes > 0) vendorsLinked++
      }
    }

    // Save any extracted outcomes
    let outcomesExtracted = false
    if (setup.outcomes) {
      const o = setup.outcomes
      const hasData = Object.values(o).some(v => v !== null && v !== undefined)
      if (hasData) {
        const existingOutcomes = (db.prepare('SELECT * FROM event_outcomes WHERE event_id = ?').get(Number(params.id)) ?? {}) as Record<string, unknown>
        db.prepare(`
          INSERT OR REPLACE INTO event_outcomes
          (event_id, leads_captured, meetings_booked, pipeline_generated, revenue_attributed,
           attendees_actual, satisfaction_score, data_source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_import', datetime('now'))
        `).run(Number(params.id),
          o.leads_captured ?? existingOutcomes.leads_captured ?? null,
          o.meetings_booked ?? existingOutcomes.meetings_booked ?? null,
          o.pipeline_generated ?? existingOutcomes.pipeline_generated ?? null,
          o.revenue_attributed ?? existingOutcomes.revenue_attributed ?? null,
          o.attendees_actual ?? existingOutcomes.attendees_actual ?? null,
          o.satisfaction_score ?? existingOutcomes.satisfaction_score ?? null)
        outcomesExtracted = true
      }
    }

    return NextResponse.json({
      success: true,
      summary: setup.summary,
      budget_added: budgetAdded,
      planning_added: planningAdded,
      vendors_linked: vendorsLinked,
      vendor_suggestions: setup.vendor_suggestions || [],
      suggested_budget_total: setup.suggested_budget_total,
      ...(outcomesExtracted && { outcomes_extracted: true })
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('AI Setup error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
