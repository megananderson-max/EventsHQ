// fix-opportunities-accuracy.mjs
// Corrects strategic_fit, speaking_opportunity, and priority_score
// for opportunities that were inaccurately seeded (invite-only events, competitor-owned
// events, Gartner restrictions, and events that DO have open speaking submissions).

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'events.db'))

// Add is_competitor_event column if missing
try { db.exec('ALTER TABLE opportunities ADD COLUMN is_competitor_event INTEGER DEFAULT 0') } catch {}

const fixes = [
  // ── Invite-only / curated — not purchasable ──────────────────────────────
  {
    id: 58, // DealBook Summit
    strategic_fit: 'Low', speaking_opportunity: null, priority_score: 40,
    recommendation: 'Evaluate',
    description: 'Invite-only NYT conference for heads of state and Fortune 50 CEOs. No sponsor booths, no vendor speaking — attendance is by editorial invitation only. Monitor for future access via media relations.'
  },
  {
    id: 55, // Milken Institute Global Conference
    strategic_fit: 'Low', speaking_opportunity: null, priority_score: 35,
    recommendation: 'Evaluate',
    description: 'Invitation-only convening of global finance, government, and philanthropic leaders. Vendor sponsorship and speaking slots are not publicly available. Attendance requires existing Milken Institute relationships.'
  },
  {
    id: 56, // Forbes CEO Summit
    strategic_fit: 'Low', speaking_opportunity: null, priority_score: 35,
    recommendation: 'Evaluate',
    description: 'Forbes-curated summit for Fortune 500 CEOs. No open sponsorship packages — participation is by Forbes editorial invitation. Not actionable without an existing Forbes C-Suite relationship.'
  },
  {
    id: 57, // WSJ Tech Live
    strategic_fit: 'Low', speaking_opportunity: null, priority_score: 40,
    recommendation: 'Evaluate',
    description: 'Wall Street Journal editorial event for top technology executives. Sponsor logos on livestream only — no speaking slots or booths available to vendors. Value is limited to brand awareness via media sponsorship if budget allows.'
  },
  {
    id: 64, // ICONIQ Growth Summit
    strategic_fit: 'Low', speaking_opportunity: null, priority_score: 30,
    recommendation: 'Evaluate',
    description: 'Private summit hosted by ICONIQ Capital exclusively for their portfolio company CEOs and operating partners. Entirely closed to non-ICONIQ-affiliated companies — not an actionable sponsorship or speaking opportunity.'
  },

  // ── Competitor-owned events ───────────────────────────────────────────────
  {
    id: 48, // Zendesk Relate
    strategic_fit: 'Medium', speaking_opportunity: null, priority_score: 45,
    is_competitor_event: 1, recommendation: 'Attend',
    description: "Zendesk's proprietary annual conference for their own customers and partners. No competitor sponsorship available. Attending as a prospect-facing team could yield competitive intelligence and displacement conversations, but sponsorship is not possible."
  },
  {
    id: 25, // Higher Logic Super Forum
    strategic_fit: 'Medium', speaking_opportunity: null, priority_score: 50,
    is_competitor_event: 1, recommendation: 'Attend',
    description: "Higher Logic's flagship annual conference for their own community software customers — Khoros's direct competitor. Sponsorship is not available, but attending allows the Khoros team to engage prospects actively reconsidering their community platform."
  },

  // ── Gartner events — vendor speaking heavily restricted ───────────────────
  {
    id: 59, // Gartner IT Symposium/Xpo 2026
    strategic_fit: 'High', priority_score: 72,
    speaking_opportunity: 'Sponsored mini-theater sessions (20 min) available via platinum/diamond sponsorship only — main agenda keynotes are Gartner analyst-curated and closed to vendors.'
  },
  {
    id: 61, // Gartner IT Symposium/Xpo EMEA
    strategic_fit: 'High', priority_score: 68,
    speaking_opportunity: 'Sponsored mini-theater sessions available via top-tier sponsorship; Gartner main stage keynotes are not available to vendors. EMEA equivalent of Symposium with same sponsorship model.'
  },
  {
    id: 66, // Gartner CIO Leadership Forum
    strategic_fit: 'High', priority_score: 65,
    speaking_opportunity: 'Very limited vendor speaking — 15-20 min sponsored spotlight sessions only via top-tier packages. Gartner analysts control all main agenda content. Value is primarily in sponsored networking and booth presence.'
  },
  {
    id: 21, // Gartner Customer Experience & Technologies Summit
    strategic_fit: 'High', priority_score: 78,
    speaking_opportunity: 'Sponsored round-table facilitation and mini-theater sessions available to platinum sponsors; Gartner analysts present all main stage content. No open speaker submissions.'
  },
  {
    id: 13, // Gartner Data & Analytics Summit
    strategic_fit: 'High', priority_score: 65,
    speaking_opportunity: 'Sponsored solution sessions (15-20 min) via top-tier sponsorship only; main program is analyst-led and closed to vendors.'
  },

  // ── Events that SHOULD have speaking — open submissions ───────────────────
  {
    id: 47, // Gainsight Pulse 2026
    strategic_fit: 'High', priority_score: 82,
    speaking_opportunity: 'Open speaker submissions for practitioners — Khoros Community team and customers should apply for breakout sessions on community-led growth. Sponsor packages include speaking slots on the main expo stage.'
  },
  {
    id: 24, // CMX Summit 2026
    strategic_fit: 'High', priority_score: 88,
    speaking_opportunity: 'CMX opens community leader speaking nominations annually — Khoros community team and champion customers are strong candidates. Sponsor packages include dedicated breakout sessions for 100-300 person rooms.'
  },
  {
    id: 3, // VentureBeat Transform
    strategic_fit: 'High', priority_score: 78,
    speaking_opportunity: 'VentureBeat accepts speaker submissions for practitioner-led sessions; sponsor tiers include 20-min sponsored talks. Eric Vaughan on AI-augmented enterprise software would be a strong fit.'
  },
  {
    id: 1, // AI4 2026
    strategic_fit: 'High', priority_score: 85,
    speaking_opportunity: 'AI4 conference includes sponsor speaking tracks and open call for speakers for AI business transformation topics — strong fit for Eric Vaughan on enterprise AI and for Khoros Aurora AI case studies.'
  },
  {
    id: 5, // HumanX 2026
    strategic_fit: 'High', priority_score: 80,
    speaking_opportunity: "HumanX invites sponsor companies to submit keynote and panel speakers; the conference explicitly focuses on AI + human collaboration topics where Eric Vaughan's perspective on enterprise AI augmentation is a natural fit."
  },
  {
    id: 20, // Customer Contact Week (CCW) 2026
    strategic_fit: 'High', priority_score: 90,
    speaking_opportunity: 'CCW offers sponsor speaking tracks, breakout sessions, and main stage case study slots — Khoros has spoken at CCW in previous years. A session on AI-powered digital contact center from a Khoros enterprise customer would be compelling.'
  },
  {
    id: 17, // Enterprise Connect 2027
    strategic_fit: 'High', priority_score: 85,
    speaking_opportunity: 'Enterprise Connect has an open call for speakers and well-established sponsor speaking packages; a Khoros case study on AI-first digital contact center migration would directly address the core audience interest.'
  },
  {
    id: 22, // Forrester CX Summit
    strategic_fit: 'High', priority_score: 82,
    speaking_opportunity: 'Forrester opens speaker submissions for practitioners and invites sponsors to propose case study sessions; Khoros can submit a joint session with a major enterprise customer on community-led CX transformation.'
  },
  {
    id: 6, // Salesforce Dreamforce
    strategic_fit: 'High', priority_score: 87,
    speaking_opportunity: 'Dreamforce accepts sponsor community theater and breakout session proposals. Khoros should target a Salesforce + Khoros integration story on Contact Center and AI — a well-established sponsor speaking format at Dreamforce.'
  },
  {
    id: 29, // AI Summit London
    strategic_fit: 'High', priority_score: 82,
    speaking_opportunity: "AI Summit London has open speaker submissions and sponsor speaking slots — Eric Vaughan speaking on enterprise AI transformation and IgniteTech's AI portfolio strategy would resonate strongly with the London enterprise AI audience."
  },
  {
    id: 23, // ICMI Contact Center Expo
    strategic_fit: 'High', priority_score: 85,
    speaking_opportunity: 'ICMI has an open call for breakout speakers and case study presenters; Khoros Digital Contact Center customers are strong candidates to present on AI-first contact center transformation.'
  },
  {
    id: 26, // Social Media Marketing World
    strategic_fit: 'High', priority_score: 82,
    speaking_opportunity: 'Social Media Marketing World has an open speaker application for brand practitioners and platform experts — Khoros social media and community team members should submit; sponsor packages also include workshop tracks.'
  },
  {
    id: 53, // SaaStr Annual 2026
    strategic_fit: 'High', priority_score: 85,
    speaking_opportunity: 'SaaStr Annual runs an open call for speakers focused on SaaS growth, go-to-market, and product — Eric Vaughan on building AI-first SaaS portfolios or IgniteTech\'s acquisition model would be a compelling submission.'
  },
  {
    id: 33, // Web Summit 2026
    strategic_fit: 'Medium', priority_score: 72,
    speaking_opportunity: 'Web Summit has a speaker application open to companies at certain sponsorship tiers and selected practitioners; IgniteTech or Khoros could apply for a startup/scale-up stage talk on enterprise AI products.'
  },
]

const stmt = db.prepare(`
  UPDATE opportunities
  SET
    strategic_fit = COALESCE(?, strategic_fit),
    speaking_opportunity = ?,
    priority_score = COALESCE(?, priority_score),
    recommendation = COALESCE(?, recommendation),
    description = COALESCE(?, description),
    is_competitor_event = COALESCE(?, is_competitor_event)
  WHERE id = ?
`)

let updated = 0
for (const f of fixes) {
  const r = stmt.run(
    f.strategic_fit ?? null,
    // speaking_opportunity: undefined means "don't touch", otherwise set (even to null)
    f.speaking_opportunity !== undefined ? f.speaking_opportunity : '__SKIP__',
    f.priority_score ?? null,
    f.recommendation ?? null,
    f.description ?? null,
    f.is_competitor_event ?? null,
    f.id
  )
  if (r.changes) {
    updated++
    const sp = f.speaking_opportunity === null ? 'cleared' : f.speaking_opportunity !== undefined ? 'SET' : 'unchanged'
    console.log(`  ✓ [${f.id}] ${f.strategic_fit || '—'} fit | speaking: ${sp}`)
  } else {
    console.log(`  ⚠ NOT FOUND id: ${f.id}`)
  }
}

// Final summary
const summary = db.prepare(`
  SELECT strategic_fit, COUNT(*) as c FROM opportunities GROUP BY strategic_fit ORDER BY c DESC
`).all()

console.log(`\n════════ DONE: ${updated} opportunities corrected ════════`)
console.log('Breakdown by fit:')
summary.forEach(s => console.log(`  ${s.strategic_fit}: ${s.c}`))

const speaking = db.prepare(`SELECT COUNT(*) as c FROM opportunities WHERE speaking_opportunity IS NOT NULL`).get()
console.log(`\nWith speaking opportunity: ${speaking.c}`)

const competitors = db.prepare(`SELECT COUNT(*) as c FROM opportunities WHERE is_competitor_event = 1`).get()
console.log(`Competitor-owned events flagged: ${competitors.c}`)
