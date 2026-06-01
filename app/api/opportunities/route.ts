import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages/messages'
import { getDb } from '@/lib/db'

function getClient() { return new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY }) }

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

    // Parse company_profiles and build companiesContext
    let companyProfiles: Array<{ id: string; name: string; website_url: string; description?: string }> = []
    if (settings.company_profiles) {
      try { companyProfiles = JSON.parse(settings.company_profiles) } catch {}
    }
    let companiesContext = ''
    if (companyProfiles.length > 0) {
      companiesContext = companyProfiles.length === 1
        ? companyProfiles[0].name
        : companyProfiles.map(c => c.name).join(', ')
    }
    const userCompany = companiesContext || settings.opp_company_name || ''
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

    // Fetch Do Not Attend signals to teach the AI what to avoid
    const dnaSignals = db.prepare(`
      SELECT name, dna_notes, competitor_name, is_competitor_event, focus_area, location
      FROM opportunities
      WHERE status = 'do_not_attend' AND (dna_notes IS NOT NULL OR competitor_name IS NOT NULL)
      ORDER BY updated_at DESC LIMIT 40
    `).all() as Array<{ name: string; dna_notes: string | null; competitor_name: string | null; is_competitor_event: number; focus_area: string | null; location: string | null }>

    const dnaSection = dnaSignals.length > 0 ? `
═══════════════════════════════════════════════════
REJECTED EVENTS — LEARN FROM THESE SIGNALS:
═══════════════════════════════════════════════════
The user has explicitly marked the following events as "Do Not Attend" and provided reasons. Use these as negative training signals — do NOT suggest events with similar profiles, organizers, audiences, or formats:

${dnaSignals.map(d =>
  `- "${d.name}"${d.is_competitor_event ? ' [COMPETITOR EVENT]' : ''}${d.competitor_name ? ` (run by ${d.competitor_name})` : ''}${d.focus_area ? ` [${d.focus_area}]` : ''}${d.location ? ` — ${d.location}` : ''}${d.dna_notes ? `\n  Reason: ${d.dna_notes}` : ''}`
).join('\n')}

Apply these signals to filter out similar events from your results. If a reason mentions "too expensive", de-prioritize high-cost events in that category. If a reason mentions "wrong audience", avoid events with similar attendee profiles. If a reason mentions a specific organizer, avoid other events by that organizer.
` : ''

    // Fetch pipeline decline reasons to teach the AI why events were returned from review
    const declinedFromReview = db.prepare(`
      SELECT name, type, location, review_notes
      FROM opportunities
      WHERE status = 'pipeline' AND review_notes IS NOT NULL AND review_notes != ''
      ORDER BY updated_at DESC LIMIT 10
    `).all() as Array<{ name: string; type: string | null; location: string | null; review_notes: string }>

    const declineSection = declinedFromReview.length > 0 ? `
═══════════════════════════════════════════════════
RETURNED TO PIPELINE — why they weren't approved:
═══════════════════════════════════════════════════
These events were reviewed but returned to the pipeline. Use the stated reasons to calibrate scoring — avoid suggesting events with similar issues:

${declinedFromReview.map(d =>
  `- "${d.name}"${d.type ? ` [${d.type}]` : ''}${d.location ? ` — ${d.location}` : ''}\n  Reason: ${d.review_notes}`
).join('\n')}
` : ''

    // Fetch approved/attended opportunities as positive signals
    const approvedSignals = db.prepare(`
      SELECT name, type, location, focus_area, region, description, priority_score
      FROM opportunities
      WHERE (status = 'pending_approval' OR added_to_events = 1)
      ORDER BY priority_score DESC, updated_at DESC
      LIMIT 15
    `).all() as Array<{ name: string; type: string | null; location: string | null; focus_area: string | null; region: string | null; description: string | null; priority_score: number | null }>

    const approvedSection = approvedSignals.length > 0 ? `
═══════════════════════════════════════════════════
APPROVED EVENTS — find more like these:
═══════════════════════════════════════════════════
The user has approved or added the following events to their calendar. Use these as positive signals — prioritize events with similar profiles, formats, audiences, and focus areas:

${approvedSignals.map(a =>
  `- ${a.name} (${a.type || 'conference'}${a.location ? `, ${a.location}` : ''}${a.focus_area ? `, focus: ${a.focus_area}` : ''})`
).join('\n')}

` : ''

    const now = new Date().toISOString()

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
      executive: 'Focus ONLY on C-suite and executive leadership forums — Forbes CEO Summit, Fortune CEO Initiative, WSJ Tech Live, Gartner Symposium, PE/investor forums.',
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
    const companyPortfolioSection = companyProfiles.length > 1
      ? `COMPANY PORTFOLIO:
${companyProfiles.map(c => `- ${c.name}${c.description ? ` — ${c.description}` : ''}`).join('\n')}

Score and evaluate opportunities for relevance across this entire portfolio. Note which company or companies benefit most from each event.`
      : `Company / organization: ${userCompany}`

    const userPrefsSection = userCompany ? `
═══════════════════════════════════════════════════
USER-CONFIGURED SEARCH PREFERENCES (use these to tailor results)
═══════════════════════════════════════════════════
${companyPortfolioSection}
${userBrands ? `Products / brands: ${userBrands}` : ''}
${userSpeaker ? `Executive speaker: ${userSpeaker}` : ''}
${userCustomerProfile ? `Target customer profile: ${userCustomerProfile}` : ''}
${userFocusAreas.length ? `Priority focus areas: ${userFocusAreas.join(', ')}` : ''}
${userRegions.length ? `Target regions: ${userRegions.join(', ')}` : ''}

Tailor all opportunity descriptions, audience match analysis, and scoring to this company and their goals.
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
${dnaSection}${declineSection}${approvedSection}
═══════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════

${focusGuidance[focusArea] || focusGuidance['all']}
${regionGuidance[region] || regionGuidance['all']}

Identify 20-25 high-value event opportunities NOT already in our system above. Prioritize breadth of discovery — use web search to find events you may not immediately know, especially large-scale expos and summits that may not come to mind first. Do not default to the same well-known events every time. Actively search for what's happening in 2026 and 2027.

For each event, provide MAXIMUM DETAIL:
- Specific venue if known
- Realistic sponsorship/attendance cost ranges based on event size and typical packages (research-grade estimates)
- Names of notable past sponsors relevant to the company's competitive landscape
- Whether the configured executive speaker (or the company's leadership) could realistically secure a KEYNOTE or LEAD SPONSOR speaking slot (not generic panels — only flag if the event sells named keynote sponsorships, has open call-for-keynotes, or their profile clearly fits a headline slot)
- The specific product(s) or business area most relevant to the company
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
    "website": "The best available URL for this event — use the official event website if known, otherwise the URL of the web page, article, or listing where you found information about this event. Never leave null; always provide a link.",
    "expected_attendees": 2500,
    "budget_estimate_low": 15000,
    "budget_estimate_high": 75000,
    "strategic_fit": "High",
    "focus_area": "Customer Experience",
    "region": "North America",
    "relevant_for": "null or a string describing which part of the company this is relevant for (e.g. 'corporate brand', 'product sales', 'both') — tailor to the configured company context",
    "audience_match": "ICP FIT ANALYSIS — required format: (1) Who actually attends: list specific job titles and company types found during research. (2) ICP match verdict: 'Strong match' / 'Partial match' / 'Weak match' — with a 1-sentence explanation of why. E.g. 'Strong match: 40% VP/Director-level CX and contact center leaders at F500 companies, verified from 2025 sponsor deck and LinkedIn attendee posts.' Never use generic inference — only cite what you found.",
    "audience_research_notes": "Multi-channel research summary: what you found on each channel (website, X/Twitter, LinkedIn, Instagram, YouTube, press), which sources had the strongest audience signal, what was missing or inactive. Include any attendee counts or demographic % breakdowns you found. Note if a direct competitor sponsors this event — that confirms ICP alignment.",
    "event_health": "growing | stable | declining | unknown — based on cross-channel signals: attendance trend, social engagement recency, sponsor list growth/shrinkage, press coverage volume",
    "recommendation": "Sponsor | Evaluate | Speak — never use Attend",
    "description": "3-4 sentences: what this event is and what business outcome attending/sponsoring drives for the configured company",
    "past_sponsors": "List 5-8 relevant past sponsors from the company's competitive landscape",
    "speaking_opportunity": "ONLY populate if the event has a genuine keynote sponsorship package, a named lead-sponsor speaking slot, or an open call-for-keynotes that the configured executive speaker's profile credibly fits. Describe the specific slot type and topic angle. Set to null for generic breakout panels, roundtables, or events with no realistic path to a headline speaking role.",
    "networking_value": "Who the executive speaker or team would meet — specific titles and companies, analyst relationships, competitive intelligence opportunities",
    "why_now": "1-2 sentences on why 2026 specifically is the right time for the company to be at this event — market trends, product launches, competitive dynamics",
    "priority_score": 87,
    "auto_flagged": false,
    "flag_reason": null
  }
]

priority_score (0-100): ${userCompany
      ? `audience quality vs. ${userCompany} target customer profile (35%) + reach/scale of event (20%) + competitive battleground importance (20%)${userSpeaker ? ` + ${userSpeaker} speaking/leadership opportunity (15%) + cost efficiency (10%)` : ' + cost efficiency (20%)'}`
      : 'audience quality vs. target customer profile (35%) + reach/scale of event (20%) + competitive battleground importance (20%) + executive speaking/leadership opportunity (15%) + cost efficiency (10%)'}.

═══════════════════════════════════════════════════
AUDIENCE RESEARCH REQUIREMENT — COMPREHENSIVE MULTI-CHANNEL
═══════════════════════════════════════════════════
For EVERY event you identify, you MUST research the actual audience across ALL of the following channels before finalising audience_match and priority_score. Generic assumptions are not acceptable. Scrape every available source:

── OFFICIAL EVENT SOURCES ──
1. FETCH the event website (web_fetch): speaker lineup (job titles/companies reveal the audience), "Who attends" / "Attendee profile" / "Sponsors" pages, published demographics, registration numbers, past event recap pages
2. FETCH the event's sponsor/exhibitor prospectus if linked — these always contain verified attendee demographics and seniority breakdowns
3. SEARCH for the event's official blog or press releases: "[event name] press release 2025 attendance"

── X / TWITTER ──
4. SEARCH: "[event name] 2025 twitter" and "[event hashtag] OR #[eventname]" — find tweets from actual attendees, live-tweeted sessions, post-event reactions. Job titles in bios, company names in tweets, and photo descriptions reveal real audience composition. Check if the official event account is active.
5. FETCH the event's official Twitter/X profile page if known (e.g. twitter.com/eventname) — check follower count, posting recency, engagement levels

── LINKEDIN ──
6. SEARCH: "[event name] attended" OR "[event name] 2025 LinkedIn" — find real attendee posts with job titles
7. SEARCH: "[event name] sponsor" OR "[event name] speaking" on LinkedIn — find companies that have posted about sponsoring or speaking, which reveals who targets this audience
8. FETCH the event's LinkedIn company page if it exists — check follower count, post engagement, recent activity

── INSTAGRAM ──
9. SEARCH: "[event name] instagram" OR "[event hashtag] instagram" — event photo galleries show crowd size, booth setups, and audience demographics. Look for tagged posts from attendees with titles in bios.
10. FETCH the event's Instagram profile if identifiable — check post frequency, follower count, engagement on recent posts

── YOUTUBE & VIDEO ──
11. SEARCH: "[event name] 2025 recap" OR "[event name] keynote 2025" OR "[event name] session recording" on YouTube — session videos reveal actual speaker caliber, audience Q&A interactions, and attendance hall sizes
12. Look for conference highlight reels — these show exhibitor booths, networking areas, and crowd size
13. FETCH individual session URLs if found — speaker bios and company affiliations verify audience profile

── PODCASTS & AUDIO ──
14. SEARCH: "[event name] podcast" OR "[event name] mentioned podcast" — industry podcasts frequently recap major events and interview speakers/attendees. Podcast guest bios reveal audience seniority.
15. SEARCH: "site:buzzsprout.com OR site:anchor.fm OR site:spotify.com [event name]" — find episode mentions

── PRESS & MEDIA COVERAGE ──
16. SEARCH: "[event name] 2025 TechCrunch" OR "[event name] 2025 VentureBeat" OR "[event name] 2025 Forbes" — press coverage includes attendance figures, notable company presence, and growth/decline signals
17. SEARCH: "[event name] 2025 recap highlights" — industry blog recaps often name-drop companies and executives who attended

── REDDIT & COMMUNITY FORUMS ──
18. SEARCH: "[event name] reddit" OR "site:reddit.com [event name]" — candid attendee reviews reveal whether events over-promise and under-deliver, whether it's worth the cost, and who actually shows up
19. Check relevant subreddits (r/CustomerExperience, r/AIApplications, r/SaaS, r/marketing, etc.) for honest attendee feedback

── PAST SPONSOR SIGNALS ──
20. For each past sponsor you identify, SEARCH "[sponsor company] events 2025" or check their press releases — companies that repeatedly sponsor an event confirm its value for reaching a specific audience. If a direct Khoros/IgniteTech competitor sponsors it, that's a strong signal.

Based on ALL of the above research, apply this three-step process:

STEP A — DOCUMENT: Set audience_match and audience_research_notes from real findings across all channels above.

STEP B — COMPARE AGAINST ICP: Explicitly cross-reference what you found against the target customer profile configured above (or the default Khoros ICP: VP/Head of Community, VP Customer Experience, CCO, VP Customer Service, Director of Customer Care, Contact Center VP/Director, Head of Social Media, Chief Digital Officer — at enterprise companies 1,000+ employees in financial services, retail, telecom, technology, healthcare, media).

Ask these questions for each event:
  • What % of the audience are decision-makers at VP level or above?
  • What % are at enterprise companies (1,000+ employees)?
  • Do the companies represented match the target verticals?
  • Are there attendees who directly buy or influence the purchase of customer engagement, community, contact center, or social media management software?
  • Do any direct competitors (Sprinklr, Genesys, Zendesk, Higher Logic, Sprout Social, NICE, Verint, Salesforce) already sponsor this event — confirming ICP presence?

STEP C — APPLY TO SCORING: Use your answers from Step B to set:
  • strategic_fit: "High" only if 30%+ of audience are genuine ICP matches at decision-maker level. "Medium" if audience is adjacent or partially aligned. "Low" if the audience is mostly practitioners, developers, or wrong verticals.
  • priority_score: The audience quality component (35% of score) must reflect the ICP match found in Step B — not assumed. A large event with a weak ICP match should score lower than a smaller event with near-perfect ICP alignment.
  • recommendation: "Sponsor" only for High strategic_fit with verified ICP density. "Speak" if ICP is present but sponsorship ROI is unclear. "Evaluate" for partial matches or unverified audiences.

STEP D — HEALTH SIGNALS: Set event_health based on cross-channel signals:
  • "growing" — increasing attendance, sold-out reports, new venue upgrades, active across multiple channels, growing sponsor list
  • "stable" — consistent attendance, regular posting, steady engagement
  • "declining" — shrinking attendance, sparse social activity, stale website (last updated 2023 or earlier), no recent press, few recent attendee posts
  • "unknown" — couldn't find reliable signals (note this clearly)
  SIGNIFICANTLY LOWER the priority_score for declining events even if ICP match is strong.

If a channel has no presence (no Instagram, no YouTube), note that in audience_research_notes — it signals limited reach.

STEP E — AUTO-FLAG REVIEW: After completing Steps A–D, apply this final check to every event and set auto_flagged + flag_reason accordingly:

Set auto_flagged = true and provide a clear flag_reason string for ANY of the following:

  🚫 COMPETITOR-RUN EVENT: The event is organized, owned, or primarily branded by a direct competitor.
     Examples: Salesforce Dreamforce (Salesforce), Sprinklr Sprinklr Unite, Genesys Xperience, Zendesk Relate, Higher Logic Super Forum, Verint Engage, NICE Interactions.
     flag_reason format: "Competitor event: organized by [Competitor Name] — attending funds a direct competitor's conference."

  🚫 COMPETITOR DOMINATES SPONSORSHIP: The event's sponsor list is overwhelmingly direct competitors with no room for a differentiated presence.
     flag_reason format: "Competitor-dominated: [Competitor A], [Competitor B], and [Competitor C] are anchor sponsors — hard to stand out."

  🚫 WRONG AUDIENCE — CONFIRMED: Research confirmed the audience is primarily developers, students, academics, government, or consumer-focused — not enterprise B2B buyers.
     flag_reason format: "Audience mismatch: confirmed [X]% [developer/student/government] audience — not enterprise CX buyers."

  🚫 SERIOUSLY DECLINING EVENT: event_health = "declining" AND either (a) budget_estimate_low > 20000 OR (b) multiple sources confirm attendance has dropped >30% from peak.
     flag_reason format: "Declining event: attendance down significantly per [sources] — poor ROI risk at this price point."

  🚫 DNA PATTERN MATCH: The event closely matches a previous "Do Not Attend" decision — same organizer, same format, same city/region, or same stated reason.
     flag_reason format: "Matches DNA pattern: similar to '[DNA event name]' which was avoided because [reason]."

  ✅ If none of these apply, set auto_flagged = false and flag_reason = null.

IMPORTANT: auto_flagged events should still be included in results — the flag is a warning for human review, NOT an automatic exclusion. The team decides the final call.

Sort by priority_score descending.`

    const message = await getClient().messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 16000,
      tools: [
        { type: 'web_search_20250305', name: 'web_search' } as ToolUnion,
        { type: 'web_fetch_20250910', name: 'web_fetch' } as ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }]
    })

    // Collect ALL text blocks — model emits text between tool calls; JSON is always in the LAST block
    const allTextBlocks = message.content.filter(b => b.type === 'text') as { type: 'text'; text: string }[]
    if (allTextBlocks.length === 0) throw new Error('No text response from AI')
    const textBlock = allTextBlocks[allTextBlocks.length - 1]

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
        relevant_for, audience_research_notes, event_health,
        auto_flagged, flag_reason, status, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pipeline', ?)
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
        audience_research_notes=excluded.audience_research_notes,
        event_health=excluded.event_health,
        auto_flagged=excluded.auto_flagged,
        flag_reason=excluded.flag_reason,
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
          opp.organizer || null, (typeof opp.website === 'string' && opp.website.startsWith('http') ? opp.website : null),
          opp.past_sponsors || null, opp.priority_score || null,
          opp.speaking_opportunity || null, opp.networking_value || null,
          opp.focus_area || null, opp.region || null, opp.why_now || null,
          opp.relevant_for || null,
          opp.audience_research_notes || null,
          opp.event_health || 'unknown',
          opp.auto_flagged ? 1 : 0,
          opp.flag_reason || null,
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
