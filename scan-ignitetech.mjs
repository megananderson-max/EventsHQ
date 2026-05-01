// scan-ignitetech.mjs — runs a targeted IgniteTech-only opportunity scan
import Anthropic from '@anthropic-ai/sdk'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'events.db'))
const client = new Anthropic()

const existing = db.prepare('SELECT name FROM opportunities').all().map(o => o.name.toLowerCase())
const existingList = existing.slice(0, 60).map(n => `- ${n}`).join('\n') || 'None'

const now = new Date().toISOString()

const prompt = `You are the Head of Events Strategy for IgniteTech (ignitetech.ai), an AI-first enterprise software holding company that acquires and revitalises mature B2B SaaS businesses.

════════════════════════════════════════════════════
ABOUT IGNITETECH (not Khoros — that's a separate brand)
════════════════════════════════════════════════════

IgniteTech is a PE-backed enterprise software acquirer with 30+ products in its portfolio:
- Mission: acquire, revitalise, and grow mission-critical B2B software companies using AI
- Key AI products: Eloquens AI (email automation), MyPersonas (AI digital clones of experts), Adminio AI (intelligent meeting scheduling)
- Portfolio includes Khoros (customer engagement), Suuchi (supply chain), and many others
- Backed by private equity; operates globally with a distributed leadership team
- CEO/leadership style: operator-focused, AI-first philosophy, lean portfolio management

Eric Vaughan is IgniteTech's senior executive (EVP level), overseeing growth, marketing, and strategic events. He:
- Has deep experience in PE-backed software companies and enterprise SaaS
- Speaks on: AI in enterprise software, PE-backed company growth playbooks, software acquisition strategy, building AI-first products on top of mature SaaS platforms, the future of B2B software
- Wants to position IgniteTech as the leading AI-first enterprise software acquirer
- Builds relationships with PE sponsors, co-investors, enterprise software CEOs, and analysts

════════════════════════════════════════════════════
EVENTS ALREADY IN OUR DATABASE (DO NOT DUPLICATE):
════════════════════════════════════════════════════
${existingList}

════════════════════════════════════════════════════
YOUR TASK
════════════════════════════════════════════════════

Find 20–25 high-value event opportunities specifically for IgniteTech as a COMPANY — NOT for Khoros products.
These should be events where:
1. PE/private equity relationships are built (LP forums, deal-flow events, PE CEO summits)
2. Enterprise software M&A and acquisition strategy is discussed (ACG, Software Equity Group, Corum, SaaStr)
3. Enterprise software operators and CEOs gather (SaaStr Annual, Pavilion CRO/CEO Summit, Operators summits)
4. IgniteTech's AI-first software portfolio story resonates (AI business transformation, AI in SaaS, AI-powered M&A)
5. Eric Vaughan can position IgniteTech as a thought leader in AI-first software acquisition and portfolio operations
6. Press/analyst relationships relevant to enterprise software M&A are built (WSJ Tech Live, Forbes CEO, DealBook)
7. IgniteTech's specific products (Eloquens AI, MyPersonas, Adminio) could be showcased to enterprise admin/ops buyers

Include events across North America, Europe, and APAC. All events must have relevant_for = "ignitetech".

Return a JSON array ONLY (no other text):
[
  {
    "name": "Full Event Name 2026 or 2027",
    "type": "conference",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "location": "City, Country",
    "venue": "Venue name or null",
    "organizer": "Organizer name",
    "website": "https://url or null",
    "expected_attendees": 500,
    "budget_estimate_low": 10000,
    "budget_estimate_high": 50000,
    "strategic_fit": "High",
    "focus_area": "PE & Enterprise Software",
    "region": "North America",
    "relevant_for": "ignitetech",
    "audience_match": "Specifically for IgniteTech: 2–3 sentences on who attends and exactly why IgniteTech/Eric Vaughan should be there — name specific job titles and what IgniteTech gains (deal flow, investor relationships, speaking platform, product showcasing, etc.)",
    "recommendation": "Sponsor",
    "description": "3–4 sentences: what this event is, why IgniteTech specifically benefits, and what outcome (not Khoros — IgniteTech as a company) attending/sponsoring drives",
    "past_sponsors": "Companies that typically sponsor — PE firms, enterprise software companies, M&A advisors",
    "speaking_opportunity": "ONLY populate if the event has a genuine keynote sponsorship package, a named lead-sponsor speaking slot, or an open call-for-keynotes that Eric Vaughan's profile credibly fits. Describe the specific slot type, e.g. 'Keynote sponsor slot: AI-first enterprise software acquisition playbook'. Set to null for generic breakout panels, roundtables, or events with no realistic path to a headline speaking role.",
    "networking_value": "Specific types of people Eric Vaughan would meet — PE partners, software CEOs, M&A advisors, LPs, enterprise buyers of IgniteTech AI products",
    "why_now": "1–2 sentences on why 2026 is the right time for IgniteTech to be at this event",
    "priority_score": 85
  }
]

priority_score: relevance to IgniteTech's PE/software strategy (40%) + Eric Vaughan speaking opportunity (25%) + investor/deal relationship value (20%) + brand-building ROI (15%).`

console.log('Scanning for IgniteTech-specific opportunities...')
console.log('This takes ~30 seconds...\n')

const message = await client.messages.create({
  model: 'claude-opus-4-5',
  max_tokens: 8000,
  messages: [{ role: 'user', content: prompt }]
})

const content = message.content[0]
if (content.type !== 'text') throw new Error('Unexpected response type')

const text = content.text.trim()
const jsonStart = text.indexOf('[')
const jsonEnd = text.lastIndexOf(']') + 1
const opps = JSON.parse(text.slice(jsonStart, jsonEnd))

console.log(`Claude returned ${opps.length} opportunities\n`)

try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_name ON opportunities(name)') } catch {}

const upsert = db.prepare(`
  INSERT INTO opportunities (
    name, type, start_date, end_date, location, venue,
    expected_attendees, budget_estimate_low, budget_estimate_high,
    strategic_fit, audience_match, recommendation, description,
    organizer, website, past_sponsors, priority_score,
    speaking_opportunity, networking_value, focus_area, region, why_now,
    relevant_for, status, generated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ignitetech', 'pipeline', ?)
  ON CONFLICT(name) DO UPDATE SET
    audience_match=excluded.audience_match,
    description=excluded.description,
    relevant_for='ignitetech',
    speaking_opportunity=excluded.speaking_opportunity,
    networking_value=excluded.networking_value,
    why_now=excluded.why_now,
    priority_score=excluded.priority_score,
    generated_at=excluded.generated_at
`)

let added = 0
const names = []
for (const opp of opps) {
  try {
    upsert.run(
      opp.name, opp.type || 'conference',
      opp.start_date || null, opp.end_date || null,
      opp.location || null, opp.venue || null,
      opp.expected_attendees || null,
      opp.budget_estimate_low || null, opp.budget_estimate_high || null,
      opp.strategic_fit || 'High', opp.audience_match || null,
      opp.recommendation || 'Attend', opp.description || null,
      opp.organizer || null, opp.website || null,
      opp.past_sponsors || null, opp.priority_score || null,
      opp.speaking_opportunity || null, opp.networking_value || null,
      opp.focus_area || 'PE & Enterprise Software', opp.region || null, opp.why_now || null,
      now
    )
    added++
    names.push(opp.name)
  } catch (e) {
    console.log('  skip (duplicate):', opp.name)
  }
}

const total = db.prepare('SELECT COUNT(*) as c FROM opportunities WHERE relevant_for = ?').get('ignitetech').c

console.log('═══════════════════════════════════════════════════')
console.log(`DONE — ${added} IgniteTech opportunities added/updated`)
console.log(`Total IgniteTech-only events in DB: ${total}`)
console.log('═══════════════════════════════════════════════════')
names.forEach(n => console.log('  ✓', n))
