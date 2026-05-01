import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'
import { getDb } from '@/lib/db'

const client = new Anthropic()

export async function GET() {
  const db = getDb()
  const opportunities = db.prepare(`
    SELECT * FROM opportunities ORDER BY
      CASE strategic_fit WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
      COALESCE(priority_score, 0) DESC,
      start_date ASC
  `).all()
  const meta = db.prepare('SELECT MAX(generated_at) as last_generated FROM opportunities').get() as { last_generated: string | null }
  return NextResponse.json({ opportunities, generated_at: meta.last_generated })
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const body = await req.json()
    const focusArea: string = body.focus_area || 'all'
    const region: string = body.region || 'all'

    // Load user preferences from app_settings
    db.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))`)
    const settingsRows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    settingsRows.forEach(r => { settings[r.key] = r.value })
    const userCompany = settings.opp_company_name || ''
    const userBrands = settings.opp_brands || ''
    const userSpeaker = settings.opp_speaker_name || ''
    const userCustomerProfile = settings.opp_customer_profile || ''
    const userFocusAreas = settings.opp_focus_areas ? settings.opp_focus_areas.split(',').filter(Boolean) : []
    const userRegions = settings.opp_regions ? settings.opp_regions.split(',').filter(Boolean) : []

    // Get existing events to avoid duplicates
    const existing = db.prepare('SELECT name, type, location, start_date FROM events').all() as Array<{
      name: string; type: string; location: string; start_date: string
    }>
    const existingOppNamesArr = (db.prepare('SELECT name FROM opportunities').all() as { name: string }[]).map(o => o.name.toLowerCase())

    const existingList = existing.map(e => `- ${e.name} (${e.type}, ${e.location || ''}, ${e.start_date || ''})`).join('\n') || 'None yet'
    const now = new Date().toISOString()

    // When focus is ignitetech, force relevant_for = ignitetech on all results
    const forceIgniteTech = focusArea === 'ignitetech'

    // Build focus area guidance
    const focusGuidance: Record<string, string> = {
      cx: 'Focus ONLY on Customer Experience (CX), customer success, and digital transformation events — CCW, Gartner CX, Forrester CX, ICMI, CX Network, Zendesk Relate, Gainsight Pulse, and similar.',
      community: 'Focus ONLY on community management, customer community, and online community events — CMX Summit, Higher Logic Super Forum, Vanilla Summit, community-led growth events.',
      contact_center: 'Focus ONLY on contact center, digital care, customer service operations, and CCaaS events — Enterprise Connect, CCW, ICMI, CX Today Summit, Five9 Analyst Day equivalents.',
      social_media: 'Focus ONLY on social media marketing, digital marketing, and MarTech events — Social Media Marketing World, MarTech Conference, Content Marketing World, Social Media Week.',
      ai_tech: `Focus ONLY on enterprise AI, generative AI, AI leadership, and AI-in-industry events. Use web search to find the best current options. Known events to consider (always verify dates/locations via web search):

ENTERPRISE AI (C-SUITE / BUSINESS-FOCUSED):
- HumanX (humanx.co) — ~9,000 attendees, SF April & Amsterdam September; premier enterprise AI conf, C-suite focused
- Ai4 / America's Largest AI Conference (ai4.io) — 12,000+ attendees, Las Vegas August; applied AI, enterprise tracks
- RAISE Summit (raisesummit.com) — 9,000 attendees, 86% C-level, Paris July; private CxO summit within the Louvre
- World Summit AI (worldsummit.ai) — ~3,000–4,000 global AI leaders, Amsterdam October
- SuperAI (superai.com) — 10,000+ attendees, Singapore June; Asia's premier AI event
- FT Future of AI Summit (ft.com/events) — 500+ attendees 87% decision-maker level, London November
- The AI Leadership Summit (Conference Board) — NYC November; C-suite focused, AI strategy
- VentureBeat Transform — enterprise AI, San Francisco

GENERATIVE AI / AI PRODUCT:
- NVIDIA GTC (nvidia.com/gtc) — 20,000+ attendees, San Jose March; "Woodstock of AI"
- AI Engineer World's Fair (ai.engineer/worldsfair) — SF June; production AI systems
- AI Engineer Europe — London April
- Generative AI Summit London — April; enterprise GenAI adoption
- Rise of AI Conference (riseof.ai) — ~2,000, Berlin May; European AI ecosystem
- AI & Big Data Expo (ai-expo.net) — Amsterdam, London, Santa Clara; 5,000–10,000 per event

REGIONAL AI WEEK SERIES (joinaiweek.com — Enterprise Technology Association):
- Atlanta AI Week — April 20–22, 2026
- Nashville AI Week — May 12–14, 2026
- Cincy AI Week — June 9–11, 2026
- Columbus AI Week — September 8–10, 2026
- Tampa AI Week — October 20–22, 2026
- Great Lakes AI Week — November 10–12, 2026
- Louisville AI Week — February 2027

LARGE TECH PLATFORMS WITH MAJOR AI TRACKS:
- Salesforce Dreamforce (40,000+, SF September) — AI agents in CRM/service
- ServiceNow Knowledge (tens of thousands, Las Vegas May) — agentic AI, enterprise workflows
- Databricks Data + AI Summit (San Francisco June) — data/ML/AI practitioners
- IBM Think (Boston May) — enterprise AI, cloud, agentic AI
- Google Cloud Next (Las Vegas April) — Vertex AI, Gemini, enterprise cloud AI
- AWS re:Invent (50,000+, Las Vegas November/December) — AI infrastructure, Bedrock
- Adobe Summit (20,000+, Las Vegas April) — AI-powered customer experience

ANALYST / INDUSTRY ANALYST AI EVENTS:
- Gartner IT Symposium/Xpo — multiple cities globally (London April, Chicago May, Orlando October flagship, Barcelona November, etc.); CIO/CTO focused, agentic AI
- Gartner Data & Analytics Summit — multiple cities (Orlando March, London May, etc.)
- Gartner Application Innovation & Business Solutions Summit — Las Vegas June
- Forrester B2B Summit North America — Phoenix April

MARKETING AI:
- MAICON / Marketing AI Conference (marketingaiinstitute.com) — ~500–1,000, Cleveland June; AI for marketers

RESPONSIBLE AI / GOVERNANCE:
- Responsible AI Summit NA — Chicago June
- AI for Good Global Summit / ITU — Geneva July
- World Summit AI — includes AI Governance track

Always search for newly announced AI conferences and summits not on this list. The AI conference landscape evolves rapidly — new events launch every quarter.`,
      executive: 'Focus ONLY on C-suite and executive leadership forums where Eric Vaughan or IgniteTech/Khoros leadership could speak or attend — Forbes CEO Summit, Fortune CEO Initiative, WSJ Tech Live, Gartner Symposium, PE/investor forums.',
      ignitetech: `Focus EXCLUSIVELY on events where IgniteTech as a COMPANY (not Khoros the product) would benefit. These are events relevant to:
- Private equity-backed enterprise software companies and their executives
- M&A, software acquisitions, and PE portfolio company strategy (ACG InterGrowth, Software Equity Group, Corum CXO)
- Enterprise software CEO/founder/operator forums (SaaStr Annual, Pavilion CRO Summit, Operators Summit)
- PE/VC investor-facing events where IgniteTech leadership builds relationships with LPs, co-investors, and deal flow (DealBook Summit, Forbes CEO Forum, Fortune CEO Initiative, WSJ CEO Council, Milken Institute)
- AI-first enterprise software company events — specifically about companies using AI to transform mature software portfolios (Bain Tech Summit, BCG Tech Advantage)
- IgniteTech's specific AI products: Eloquens AI (email automation), MyPersonas (AI digital clones of experts), Adminio AI (scheduling intelligence) — events where these products could be showcased to enterprise buyers
- B2B SaaS operator and growth events where IgniteTech's playbook of acquiring and scaling mature software is a differentiator
- Executive speaking slots where Eric Vaughan can position IgniteTech as a leading AI-first acquirer of enterprise software
DO NOT include Khoros product events (community, CX, contact center, social media). ALL results must have relevant_for = "ignitetech".`,
      all: `Cast the WIDEST possible net across ALL of the following categories. Do not default to a narrow set — prioritize variety and discovery:

1. LARGE-SCALE ENTERPRISE TECH EXPOS: GITEX Global (Dubai, Dec, 200,000+), GITEX AI Europe (Berlin, June), GITEX Asia (Singapore, April), Web Summit (Lisbon, Nov, 70,000+), MWC Barcelona (March, 100,000+), VivaTech (Paris, June, 180,000+), Collision (Toronto, June, 30,000+), Hannover Messe (April, 130,000+), CES (Jan), AWS re:Invent (Las Vegas, Nov/Dec, 50,000+), Google Cloud Next, Salesforce Dreamforce, ServiceNow Knowledge, Adobe Summit, IBM Think.

2. ENTERPRISE AI (business-focused): HumanX (SF April & Amsterdam September), Ai4 (Las Vegas, August, 12,000+), RAISE Summit (Paris, July, 9,000 attendees 86% C-level), World Summit AI (Amsterdam, October), SuperAI (Singapore, June, 10,000+), FT Future of AI Summit (London, November), VentureBeat Transform, NVIDIA GTC (San Jose, March, 20,000+), Generative AI Summit London, Rise of AI Conference (Berlin), AI & Big Data Expo series.

3. AI WEEK REGIONAL SERIES (joinaiweek.com): Atlanta (Apr 20–22), Nashville (May 12–14), Cincinnati (Jun 9–11), Columbus (Sep 8–10), Tampa (Oct 20–22), Great Lakes (Nov 10–12).

4. CUSTOMER EXPERIENCE & DIGITAL TRANSFORMATION: CCW, Gartner CX Summit, Forrester CX East/West, ICMI, Customer Contact Week, CX Network, Zendesk Relate, Gainsight Pulse, NiCE World (Orlando, June).

5. COMMUNITY & CUSTOMER ENGAGEMENT: CMX Summit, Higher Logic Super Forum, inSided Summit, community-led growth conferences.

6. CONTACT CENTER & DIGITAL CARE: Enterprise Connect, ICMI Contact Center Expo, Five9 CX Summit, CCaaS events.

7. SOCIAL MEDIA & MARTECH: Social Media Marketing World, MarTech Conference, Content Marketing World, MAICON / Marketing AI Conference (Cleveland, June), Advertising Week.

8. ANALYST SUMMITS: Gartner IT Symposium/Xpo (multiple cities — London April, Chicago May, Orlando October, Barcelona November), Gartner Data & Analytics Summit, Gartner Application Innovation Summit, Forrester B2B Summit.

9. EXECUTIVE & PE/INVESTOR FORUMS: Forbes CEO Summit, Fortune CEO Initiative, WSJ Tech Live, DealBook Summit, Milken Institute, ACG InterGrowth, SaaStr Annual, SaaStock.

10. RESPONSIBLE AI / GOVERNANCE: Responsible AI Summit NA (Chicago, June), AI for Good Global Summit / ITU (Geneva, July), World Summit AI governance track.

Use web search to actively discover events not listed here — especially newly announced events and regional summits. Search for "enterprise AI conference 2026", "B2B SaaS conference 2026 Europe", "digital transformation summit APAC 2026", "AI leadership summit 2026", etc. The goal is comprehensive discovery across all geographies and sectors.`,
    }
    const regionGuidance: Record<string, string> = {
      north_america: 'ONLY include events in North America (USA and Canada).',
      europe: 'ONLY include events in Europe (UK, EU, continental Europe).',
      apac: 'ONLY include events in Asia-Pacific (Singapore, Australia, Japan, South Korea, India, Middle East).',
      all: 'Include events globally — North America, Europe, and APAC.',
    }

    // Build user-preferences section if configured
    const userPrefsSection = userCompany ? `
═══════════════════════════════════════════════════
USER-CONFIGURED SEARCH PREFERENCES (use these to tailor results)
═══════════════════════════════════════════════════
Company / organisation: ${userCompany}
${userBrands ? `Products / brands: ${userBrands}` : ''}
${userSpeaker ? `Executive speaker: ${userSpeaker}` : ''}
${userCustomerProfile ? `Target customer profile: ${userCustomerProfile}` : ''}
${userFocusAreas.length ? `Priority focus areas: ${userFocusAreas.join(', ')}` : ''}
${userRegions.length ? `Target regions: ${userRegions.join(', ')}` : ''}

Tailor all opportunity descriptions, audience match analysis, and scoring to this company and their goals. Where the built-in IgniteTech/Khoros context conflicts with these preferences, defer to the user's configured company.
` : ''

    const prompt = `You are a senior Events Strategy advisor. Your job is to find the highest-value conference sponsorship, speaking, and attendance opportunities in the next 18 months (from April 2026 onward).
${userPrefsSection}
CRITICAL SEARCH INSTRUCTION: Use web search EXTENSIVELY and PROACTIVELY before finalizing your list. Do not rely on training knowledge alone — AI conference schedules change every year. Run multiple searches such as:
- "enterprise AI conference 2026"
- "AI leadership summit 2026"
- "generative AI conference 2026"
- "HumanX 2026 conference"
- "RAISE Summit Paris 2026"
- "SuperAI Singapore 2026"
- "World Summit AI Amsterdam 2026"
- "AI Week conference 2026 joinaiweek.com"
- "GITEX AI Europe Berlin 2026"
- "GITEX Global Dubai 2026"
- "Web Summit 2026"
- "enterprise technology conference 2026"
- "B2B SaaS conference 2026"
- "digital transformation summit 2026 Europe"
- "customer experience conference 2026"
- "enterprise AI events 2026 Asia"
- "[industry] AI conference 2026" (for each relevant vertical)

Search broadly first, then filter by relevance to the company. The goal is comprehensive discovery — GITEX, Web Summit, HumanX, RAISE, SuperAI, Ai4, and all regional AI Week events should always be evaluated.

${userCompany ? '' : `═══════════════════════════════════════════════════
COMPANY CONTEXT (Default — override with configured preferences above if set)
═══════════════════════════════════════════════════

**IgniteTech** — Private equity-backed enterprise software company that acquires and grows mature B2B SaaS businesses. Portfolio includes 30+ enterprise software products across CX, analytics, HR tech, supply chain, and digital transformation. Key brand under IgniteTech is Khoros.

**Khoros** — Enterprise customer engagement platform with four core products:
1. **Khoros Community** — Online community platform for brands to build customer/partner communities. Competes with: Higher Logic, Verint Community, Bettermode, Discourse, Vanilla Forums, Salesforce Experience Cloud.
2. **Khoros Social Media Management** — Enterprise social media publishing, listening, and analytics. Competes with: Sprinklr, Sprout Social, Hootsuite, Brandwatch.
3. **Khoros Care** — Digital-first customer care for social messaging, chat, and email. Competes with: Sprinklr Service, Salesforce Service Cloud, Zendesk, Freshdesk.
4. **Khoros Digital Contact Center** — Modern CCaaS platform. Competes with: Genesys, Five9, NICE, Verint, Twilio Flex.
5. **Aurora AI / IRIS AI** — AI layer across all Khoros products for intelligent automation, insights, and response recommendations.

**Target Customers** (Khoros ICP):
- Enterprise companies (1,000+ employees)
- VP/Head of Community, Community Director
- VP Customer Experience, Chief Customer Officer (CCO)
- VP Customer Service, Director of Customer Care
- Contact Center VP/Director
- Head of Social Media / Social Media Manager (Enterprise)
- Chief Digital Officer, VP Digital Transformation
- VP Marketing Technology / MarTech Stack owner
- Industries: Financial services, retail/e-commerce, telecom, technology, healthcare, media

═══════════════════════════════════════════════════
ERIC VAUGHAN — KEY PERSON TO CONSIDER
═══════════════════════════════════════════════════

Eric Vaughan is an IgniteTech senior executive (EVP/C-suite level) overseeing growth, marketing, and events strategy. He is:
- An experienced B2B enterprise software executive with a background in PE-backed software companies
- A credible speaker and panelist on topics: enterprise software, PE-backed company growth, community-led growth, AI in CX, the future of customer engagement, B2B SaaS strategy, digital transformation
- Actively attending and speaking at industry events to build Khoros/IgniteTech brand
- Looking for events where he can: speak at keynotes/panels, build relationships with enterprise CX buyers, network with PE/investor community, engage analyst community (Gartner, Forrester), and position Khoros against competitors

When scoring opportunities, factor in: (a) whether Eric Vaughan could realistically speak or be a panelist, (b) whether the event gives IgniteTech/Khoros access to PE/investor relationships, (c) whether it's a competitive battleground worth showing up at.
`}

═══════════════════════════════════════════════════
EVENTS ALREADY IN OUR SYSTEM (do not duplicate):
═══════════════════════════════════════════════════
${existingList}

ALSO DO NOT DUPLICATE THESE EVENTS ALREADY IN OPPORTUNITIES DATABASE:
${existingOppNamesArr.map(n => `- ${n}`).join('\n') || 'None'}

═══════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════

${focusGuidance[focusArea] || focusGuidance['all']}
${regionGuidance[region] || regionGuidance['all']}

Identify 20-25 high-value event opportunities NOT already in our system above. Prioritise breadth of discovery — use web search to find events you may not immediately know, especially large-scale expos and summits that may not come to mind first. Do not default to the same well-known events every time. Actively search for what's happening in 2026 and 2027.

For each event, provide MAXIMUM DETAIL:
- Specific venue if known
- Realistic sponsorship/attendance cost ranges based on event size and typical packages (research-grade estimates)
- Names of past sponsors from our competitive set (Sprinklr, Salesforce, Zendesk, Gainsight, Higher Logic, Genesys, Five9, Hootsuite, Sprout Social)
- Whether Eric Vaughan could realistically secure a KEYNOTE or LEAD SPONSOR speaking slot (not generic panels — only flag if the event sells named keynote sponsorships, has open call-for-keynotes, or Eric Vaughan's profile clearly fits a headline slot)
- The specific Khoros product(s) most relevant (Community, Social, Care, Contact Center, AI)
- Why this event matters NOW in 2026 (market trends, competitive dynamics)

Return a JSON array ONLY (no other text, no markdown, just the raw array):
[
  {
    "name": "Full Event Name 2026",
    "type": "conference",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "location": "City, State/Country",
    "venue": "Venue name or null",
    "organizer": "Organizer organization name",
    "website": "https://website.com or null",
    "expected_attendees": 2500,
    "budget_estimate_low": 15000,
    "budget_estimate_high": 75000,
    "strategic_fit": "High",
    "focus_area": "Customer Experience",
    "region": "North America",
    "relevant_for": "ignitetech OR khoros OR both — ignitetech = executive brand/PE/AI portfolio events where IgniteTech is the entity, khoros = product-specific events where CX/community/contact center/social media buyers attend, both = events relevant to both companies",
    "audience_match": "2-3 focused sentences. If relevant_for=khoros: name the exact job titles who attend and which Khoros product (Community/Social/Care/Contact Center/Aurora AI) is relevant. If relevant_for=ignitetech: explain why this event fits IgniteTech's AI-first portfolio story or Eric Vaughan's executive brand. If relevant_for=both: split clearly with 'For Khoros: ...' and 'For IgniteTech: ...' sections.",
    "recommendation": "Sponsor | Evaluate | Speak — never use Attend",
    "description": "3-4 sentences: what this event is, whether it's primarily for IgniteTech (corporate/executive brand) or Khoros (product sales/marketing), and what business outcome attending/sponsoring drives",
    "past_sponsors": "List 5-8 relevant past sponsors from Khoros competitive set, e.g.: Sprinklr, Salesforce, Zendesk, Genesys, Gainsight, Higher Logic",
    "speaking_opportunity": "ONLY populate if the event has a genuine keynote sponsorship package, a named lead-sponsor speaking slot, or an open call-for-keynotes that Eric Vaughan's profile credibly fits. Describe the specific slot type and topic angle, e.g. 'Keynote sponsor slot: AI-first enterprise software acquisition playbook' or 'Opening keynote: The future of AI in B2B SaaS'. Set to null for generic breakout panels, roundtables, or events with no realistic path to a headline speaking role.",
    "networking_value": "Who Eric Vaughan would meet — specific titles and companies, analyst relationships, competitive intelligence opportunities",
    "why_now": "1-2 sentences on why 2026 specifically is the right time for Khoros to be at this event — market trends, product launches, competitive dynamics",
    "priority_score": 87
  }
]

priority_score (0-100): ${userCompany
      ? `audience quality vs. ${userCompany} target customer profile (35%) + reach/scale of event (20%) + competitive battleground importance (20%)${userSpeaker ? ` + ${userSpeaker} speaking/leadership opportunity (15%) + cost efficiency (10%)` : ' + cost efficiency (20%)'}`
      : 'audience quality vs. Khoros ICP (35%) + reach/scale (20%) + competitive battleground importance (20%) + Eric Vaughan speaking/leadership opportunity (15%) + cost efficiency (10%)'}.
Sort by priority_score descending.`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 16000,
      tools: [
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion
      ],
      messages: [{ role: 'user', content: prompt }]
    })

    // Extract text from response — may contain ServerToolUseBlock + WebSearchToolResultBlock + TextBlock
    const textBlock = message.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined
    if (!textBlock) throw new Error('No text response from AI')

    let rawOpportunities: Record<string, unknown>[]
    try {
      const text = textBlock.text.trim()
      const jsonStart = text.indexOf('[')
      const jsonEnd = text.lastIndexOf(']') + 1
      rawOpportunities = JSON.parse(text.slice(jsonStart, jsonEnd))
    } catch {
      throw new Error('Failed to parse AI response: ' + textBlock.text.slice(0, 200))
    }

    // Ensure unique index exists
    try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_name ON opportunities(name)') } catch {}

    const upsert = db.prepare(`
      INSERT INTO opportunities (
        name, type, start_date, end_date, location, venue,
        expected_attendees, budget_estimate_low, budget_estimate_high,
        strategic_fit, audience_match, recommendation, description,
        organizer, website, past_sponsors, priority_score,
        speaking_opportunity, networking_value, focus_area, region, why_now,
        relevant_for, status, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pipeline', ?)
      ON CONFLICT(name) DO UPDATE SET
        start_date=excluded.start_date, end_date=excluded.end_date,
        location=excluded.location, venue=excluded.venue,
        expected_attendees=excluded.expected_attendees,
        budget_estimate_low=excluded.budget_estimate_low,
        budget_estimate_high=excluded.budget_estimate_high,
        strategic_fit=excluded.strategic_fit, audience_match=excluded.audience_match,
        recommendation=excluded.recommendation, description=excluded.description,
        organizer=excluded.organizer, website=excluded.website,
        past_sponsors=excluded.past_sponsors, priority_score=excluded.priority_score,
        speaking_opportunity=excluded.speaking_opportunity,
        networking_value=excluded.networking_value,
        focus_area=excluded.focus_area, region=excluded.region,
        why_now=excluded.why_now,
        relevant_for=CASE WHEN excluded.relevant_for='ignitetech' THEN 'ignitetech' ELSE COALESCE(opportunities.relevant_for, excluded.relevant_for) END,
        generated_at=excluded.generated_at
    `)

    let added = 0
    for (const opp of rawOpportunities) {
      // Skip if name is too similar to existing (case-insensitive check already in DB via CONFLICT)
      try {
        upsert.run(
          opp.name, opp.type || 'conference',
          opp.start_date || null, opp.end_date || null,
          opp.location || null, opp.venue || null,
          opp.expected_attendees || null,
          opp.budget_estimate_low || null, opp.budget_estimate_high || null,
          opp.strategic_fit || 'Medium', opp.audience_match || null,
          opp.recommendation || 'Evaluate', opp.description || null,
          opp.organizer || null, opp.website || null,
          opp.past_sponsors || null, opp.priority_score || null,
          opp.speaking_opportunity || null, opp.networking_value || null,
          opp.focus_area || null, opp.region || null, opp.why_now || null,
          forceIgniteTech ? 'ignitetech' : (opp.relevant_for || 'khoros'),
          now
        )
        added++
      } catch { /* skip duplicates */ }
    }

    // Return ALL opportunities sorted
    const all = db.prepare(`
      SELECT * FROM opportunities ORDER BY
        CASE strategic_fit WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
        COALESCE(priority_score, 0) DESC,
        start_date ASC
    `).all()

    return NextResponse.json({ opportunities: all, generated_at: now, added })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Opportunities API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
