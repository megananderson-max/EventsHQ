import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'events.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ═══════════════════════════════════════════════════════════
// 1. CREATE THE EVENT
// ═══════════════════════════════════════════════════════════
// Remove if already exists
const existing = db.prepare("SELECT id FROM events WHERE name LIKE '%FT Future%'").get()
if (existing) {
  db.prepare('DELETE FROM budget_items WHERE event_id = ?').run(existing.id)
  db.prepare('DELETE FROM planning_items WHERE event_id = ?').run(existing.id)
  db.prepare('DELETE FROM event_vendors WHERE event_id = ?').run(existing.id)
  db.prepare('DELETE FROM events WHERE id = ?').run(existing.id)
  console.log('Removed existing FT Future of AI event, rebuilding...')
}

const eventResult = db.prepare(`
  INSERT INTO events (name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'FT Future of AI 2026',
  'conference',
  'planning',
  '2026-11-04',
  '2026-11-05',
  'London, UK',
  'Convene 22 Bishopsgate, London EC2N 4BQ',
  600,
  0, // will update after budget items
  'Financial Times Annual AI Leadership Summit. Two-day in-person + digital conference curated by FT journalists for C-suite and senior leaders at the intersection of business strategy and AI. Eric Vaughan delivered the Keynote Interview in 2025 alongside Tim Berners-Lee, Yann LeCun (Meta), and Jensen Huang (Nvidia). 2025: 1,392 registrations, 563 in-person attendees, 934 FT Live Networking App joiners. 2026 themes expected: Agentic AI and enterprise-wide AI adoption — aligns with IgniteTech product direction and CEO narrative. Fresh angles: Khoros acquisition (May 2025) and Adminio AI launch (Q1 2026).'
)
const eventId = eventResult.lastInsertRowid

console.log(`✓ Created event: FT Future of AI 2026 (id: ${eventId})`)

// ═══════════════════════════════════════════════════════════
// 2. VENDOR — FT Live
// ═══════════════════════════════════════════════════════════
// Check if FT Live vendor exists
let ftVendor = db.prepare("SELECT id FROM vendors WHERE name LIKE '%FT Live%'").get()
if (!ftVendor) {
  const vr = db.prepare(`
    INSERT INTO vendors (name, category, contact_name, contact_email, contact_phone, website, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'FT Live',
    'sponsorship',
    'Jack Austen',
    'jack.austen@ft.com',
    null,
    'https://live.ft.com',
    'Events division of the Financial Times. Sponsorship: Jack Austen (jack.austen@ft.com). Marketing: Vanessa Gayle Tiong (vanessagayle.tiong@ft.com), Yana Yitzhaki (yana.yitzhaki@ft.com). Operations: Tayla Cawsey (tayla.cawsey@ft.com, +44 799 9407 243). Content/Speaker: Yasmin Alasdoon (yasmin.alsadoon@ft.com, +44 7506 801737), Tierney Rose O\'Kelly (tierneyrose.okelly@ft.com, +44 7738 409744).'
  )
  ftVendor = { id: vr.lastInsertRowid }
  console.log('✓ Created FT Live vendor')
} else {
  console.log('✓ Using existing FT Live vendor')
}

// Ghelani Studios (photographer/videographer)
let ghVendor = db.prepare("SELECT id FROM vendors WHERE name LIKE '%Ghelani%'").get()
if (!ghVendor) {
  const gr = db.prepare(`
    INSERT INTO vendors (name, category, contact_name, contact_email, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'Ghelani Studios',
    'staffing',
    'Amit Patel',
    'amit@ghelanistudios.com',
    'Photographer and videographer used at FT Future of AI 2025. Register via FT support pass. Confirm availability for 2026.'
  )
  ghVendor = { id: gr.lastInsertRowid }
  console.log('✓ Created Ghelani Studios vendor')
}

// Link vendors to event
db.prepare(`
  INSERT INTO event_vendors (event_id, vendor_id, status, contract_value, notes)
  VALUES (?, ?, ?, ?, ?)
`).run(eventId, ftVendor.id, 'rfp_sent', null,
  '2025 package: Lead Sponsorship $76,000 + Lanyard $10,000 = $86,000 total. 2026 pricing: Lead $79,000, Premium $105,000, Strategic $135,000. Add-ons: Lanyard $10,000, Coffee Station $29,000. Contact Jack Austen for 2026 package confirmation. Currently holding Day 1 plenary slot.')

db.prepare(`
  INSERT INTO event_vendors (event_id, vendor_id, status, notes)
  VALUES (?, ?, ?, ?)
`).run(eventId, ghVendor.id, 'shortlisted',
  'Used in 2025. Register via FT support pass category. Confirm 2026 availability early.')

// ═══════════════════════════════════════════════════════════
// 3. BUDGET ITEMS
// ═══════════════════════════════════════════════════════════
const ins = db.prepare(`
  INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, payment_due_date, status, notes, is_estimate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// ── CONFIRMED / CONTRACTED COSTS ──
// Based on 2025 Lead Sponsorship as reference baseline — to be confirmed for 2026
// Lead Sponsorship 2026 = $79,000 (up from $76,000 in 2025)
ins.run(eventId, 'sponsorship',
  'Lead Sponsorship Package — FT Future of AI 2026 ($79,000)',
  ftVendor.id, 79000, 0, '2026-09-01', 'pending',
  'PENDING CONFIRMATION. 2026 Lead Sponsorship: Main programme panel OR fireside chat, 6 in-person passes + 15 digital passes, speaker invite to VIP dinner, delegate opt-in data post-event, brand alignment (social/FT.com/FT newspaper), optional pop-up stand, virtual booth, session footage. 2025 equivalent was $76,000. Contact Jack Austen (jack.austen@ft.com) to confirm 2026 pricing and availability. Prime slots fill early.',
  0)

ins.run(eventId, 'sponsorship',
  'Joint Lanyard Sponsorship — FT Live + IgniteTech branding ($10,000)',
  ftVendor.id, 10000, 0, '2026-09-01', 'pending',
  'Joint branded FT Live + IgniteTech lanyards worn by all in-person attendees throughout both days. Confirmed in 2025. To be confirmed for 2026 with Jack Austen.',
  0)

// ── ADD-ON OPTIONS (pending decision) ──
ins.run(eventId, 'sponsorship',
  'Coffee Station Sponsorship — exclusive branded (OPTIONAL, $29,000)',
  ftVendor.id, 29000, 0, '2026-09-01', 'pending',
  'OPTIONAL ADD-ON. Exclusive branded coffee station across high-traffic venue areas. Logo on signage and napkins. Venue-wide — not fixed adjacent to booth. Inquire with Jack Austen for 2026 confirmation. New for 2026 — not in 2025 package.',
  0)

// ── ESTIMATED / VARIABLE COSTS ──
// Booth materials
ins.run(eventId, 'branding',
  'Booth backdrop — 8ft × 8ft printed backdrop + shipping',
  null, 2500, 0, '2026-10-15', 'pending',
  'Est. based on 2025 booth. 2m × 2m footprint, Booth #TBC (confirm with Jack). Send to FT Consolidation Centre ~10 days before event. Full delivery address in Exhibition Information Pack. Can also bring 1 small suitcase upon arrival.',
  1)

ins.run(eventId, 'branding',
  'Branded marketing collateral — one-pagers, brochures, demos',
  null, 1500, 0, '2026-10-15', 'pending',
  'Confirm which products lead in 2026 (2025: MyPersonas for booth visual demos, Eloquens AI for table demos). Collect email addresses from Eloquens AI demo attendees. Prepare for email influx on both event days.',
  1)

ins.run(eventId, 'branding',
  'TV monitor rental — 50" monitor on rolling cart with HDMI',
  null, 800, 0, '2026-10-15', 'pending',
  '50" monitor on rolling stand with HDMI confirmed in 2025. Confirm rental option with FT AV team via Jack Austen for 2026. Used for MyPersonas demo (visual, avoids voice-mode issues in noisy show floor).',
  1)

ins.run(eventId, 'branding',
  'Photographer / Videographer — Ghelani Studios (Amit Patel)',
  ghVendor.id, 2000, 0, '2026-10-01', 'pending',
  'Ghelani Studios (Amit Patel, amit@ghelanistudios.com) used in 2025. Register via FT support pass category — Jack Austen to confirm support pass availability. Confirm 2026 availability early.',
  1)

// Travel — USA to London, Nov 2026 (estimated ~4-6 people)
ins.run(eventId, 'travel',
  'Flights — USA ↔ London Heathrow (4-6 people, Nov 2026)',
  null, 7200, 0, '2026-09-15', 'pending',
  'Est. ~$1,200-1,800/person for Nov transatlantic. 2025 attendees: Eric Vaughan, Regina Nogueira, Jozef Kacala, Dimitry Ledin, David Harpur (Day 1). 2026 attendee list TBC. Arrive night before Nov 4 (stand set-up eve: 7-9pm). Depart after Day 2 breakdown (Nov 5 evening).',
  1)

ins.run(eventId, 'travel',
  'Ground transport — airport transfers + local London (4-6 people)',
  null, 800, 0, null, 'pending',
  'Heathrow/Gatwick transfers to City of London area. Venue closest to Bank, Moorgate, Liverpool Street stations. Tube/taxi to Convene 22 Bishopsgate EC2N 4BQ.',
  1)

// Accommodation — City of London / Liverpool Street area
ins.run(eventId, 'accommodation',
  'Hotel — City of London (4-5 rooms × 3 nights, Nov 3-5)',
  null, 5400, 0, '2026-09-15', 'pending',
  'Recommended: Andaz London Liverpool Street (Hyatt, 6 min walk), Clayton Hotel London Wall (10 min), Pan Pacific London (7 min). Arrive night of Nov 3 for stand set-up (7-9pm). All within walking distance of Convene 22 Bishopsgate. Nov rates est. £300-400/night.',
  1)

ins.run(eventId, 'accommodation',
  'Per diem — meals & incidentals (4-5 people × 3 days)',
  null, 2250, 0, null, 'pending',
  '$150/person/day in London. 5 people × 3 days (Nov 3-5). Covers all meals not provided at event, coffees, incidentals. VIP Speakers Dinner included in sponsorship package (speaker invite).',
  1)

// Contingency — 10%
const confirmedTotal = 79000 + 10000
const estimatedTotal = 29000 + 2500 + 1500 + 800 + 2000 + 7200 + 800 + 5400 + 2250
const contingency = Math.round((confirmedTotal + estimatedTotal) * 0.10)
ins.run(eventId, 'contingency',
  'Contingency / Slush Fund Reserve — 10% of total',
  null, contingency, 0, null, 'pending',
  '10% buffer for package upgrade (Lead → Premium +$26,000), last-minute add-ons (coffee station $29,000), currency fluctuation USD/GBP, on-site overruns.',
  1)

// Update event budget_total to sum of all items
const totalBudget = db.prepare('SELECT SUM(planned_amount) as t FROM budget_items WHERE event_id = ?').get(eventId).t
db.prepare('UPDATE events SET budget_total = ? WHERE id = ?').run(totalBudget, eventId)
console.log(`✓ Budget total: $${totalBudget.toLocaleString()}`)

// ═══════════════════════════════════════════════════════════
// 4. PLANNING ITEMS — from Decisions/Action Required + notes
// ═══════════════════════════════════════════════════════════
const insP = db.prepare('INSERT INTO planning_items (event_id, title, done, sort_order) VALUES (?, ?, 0, ?)')
let order = 0
const add = (title) => insP.run(eventId, title, order++)

// ── IMMEDIATE ACTIONS ──
add('⚡ Contact Jack Austen (jack.austen@ft.com) — confirm 2026 event dates and get on early sponsor list')
add('⚡ Confirm 2026 sponsorship package — Lead $79K vs. Premium $105K vs. Strategic $135K — decision needed ASAP (prime slots fill early)')
add('⚡ Confirm budget approval for 2026 (2025 total was $86,000 excl. tax)')
add('⚡ Secure speaking slot for Eric Vaughan — build on 2025 Keynote; confirm format (fireside, panel, or keynote interview)')

// ── SPONSORSHIP & CONTRACT ──
add('Request 2026 sponsorship brochure and updated package details from Jack Austen')
add('Review 2026 booth options and confirm booth size/location (earlier commitment = better position; was #7 in 2025)')
add('Confirm add-ons decision: Lanyard $10K (confirmed 2025) and/or Coffee Station $29K (new for 2026)')
add('Confirm brand positioning rights: website, signage, programme, emails, app, stage signage, digital network')
add('Request Wishlist Service — submit target companies and job titles to FT Live to drive relevant attendees (~10 days before event)')
add('Request 2026 VIP Speakers Dinner invitation confirmation (included in Lead+ packages)')

// ── SPEAKER PREP (Eric Vaughan) ──
add('Brief Eric Vaughan on 2026 speaking format and FT editorial process')
add('Coordinate with FT Content team: Yasmin Alasdoon (yasmin.alsadoon@ft.com) and Tierney Rose O\'Kelly (tierneyrose.okelly@ft.com)')
add('Develop 2026 keynote narrative — fresh angles: Khoros acquisition (May 2025) + Adminio AI launch (Q1 2026) + Agentic AI themes')
add('Review 2025 audience Q&A highlights for speaker prep (training ROI, empathy in automation, knowledge guardians, energy demand for AI)')
add('Eric Vaughan: arrive 40 minutes before session. FT team will bring to Speaker Green Room 20 min before for lapel mic fitting')
add('Check spam for QR code access email from notify@22bishopsgate.com (sent 24 hrs before session)')
add('Eric Vaughan: collect speaker badge on arrival at venue — separate from general sponsor badges')
add('Social media: use #FTFutureofAI and link to https://ai.live.ft.com/home when posting about involvement')

// ── ATTENDEES & PASSES ──
add('Confirm 2026 attendee list (2025: Eric Vaughan, Regina Nogueira, Jozef Kacala, Dimitry Ledin, David Harpur Day 1)')
add('Assign and communicate 6 in-person passes + 15 digital passes (Lead package) to confirmed attendees')
add('Register photographer/videographer via FT support pass — Ghelani Studios (Amit Patel, amit@ghelanistudios.com) used in 2025')
add('Send registration links to all attendees once passes are activated')

// ── BOOTH & EXHIBIT ──
add('Confirm TV monitor rental — 50" monitor on rolling stand with HDMI (rented from FT AV in 2025)')
add('Decide product demos for 2026 booth (2025: MyPersonas for visual booth display, Eloquens AI for table demos)')
add('Note: Voice-mode demos difficult in noisy show floor — prepare attendees to type responses')
add('Order booth backdrop — 8ft × 8ft printed, ship to FT Consolidation Centre ~10 days before event')
add('Note: Booth can be set up by FT AV team — request photo from Jack Austen if not attending set-up')
add('Confirm stand set-up evening: Tue Nov 3, 7:00pm–9:00pm (2025 reference)')
add('Arrange courier/collection for Consolidation Centre post-event breakdown — items left on site will be discarded')

// ── BRANDING & MARKETING ──
add('Order branded marketing collateral (Khoros/IgniteTech one-pagers, case studies, demo materials)')
add('Download social tiles and suggested copy from FT marketing kit — use #FTFutureofAI')
add('Plan press release if applicable (2025 press release published successfully)')
add('Connect Natasha & Vinicius re: MyPersonas and Eloquens for FT (Jack to facilitate introduction)')

// ── DIGITAL NETWORKING ──
add('Assign one team member as FT Live Networking App sponsor admin (manages app sponsor page + 1:1 meeting scheduling)')
add('Prepare sponsor page content for FT Live Networking App (for attendees to visit digitally)')
add('Plan and schedule customer/prospect 1:1 meetings via FT Live Networking App before event')

// ── TRAVEL & LOGISTICS ──
add('Book flights once dates confirmed — 4-6 people USA ↔ London, arrive Nov 3 (stand set-up eve)')
add('Book hotel rooms — Andaz Liverpool Street (Hyatt), Clayton London Wall, or Pan Pacific (all <10 min walk to venue)')
add('Note: Closest tubes Bank and Moorgate, closest station Liverpool Street — Convene 22 Bishopsgate EC2N 4BQ')
add('Venue WiFi: network "Convene Guest", no password required (confirmed 2025)')
add('Dress code: Business casual')

// ── WEEK BEFORE ──
add('Complete internal prep call with all attendees before event')
add('Brief full team on booth assignments, talking points, and lead capture process')
add('Ensure Eloquens AI demo is set up and Ella Quinn email account is ready for influx')
add('Confirm all passes are registered and accessible')
add('Request Exhibition Information Pack from FT (contains full Consolidation Centre delivery address)')

// ── POST-EVENT ──
add('Download QR lead scan report from FT post-event (full PDF breakdown of all QR scans)')
add('Collect delegate opt-in data from FT (name, company, job title, email) post-event')
add('Distribute leads to sales team with context notes from conversations')
add('Request session footage from FT (provided within ~1 week post-event)')
add('Collect event photos from Ghelani Studios and FT post-event photo report')
add('Complete ROI report: leads, meetings held, pipeline generated, media coverage')
add('Follow up with Jack Austen on 2027 early bird sponsorship options')

const planCount = db.prepare('SELECT COUNT(*) as n FROM planning_items WHERE event_id = ?').get(eventId).n
console.log(`✓ Planning items: ${planCount}`)

// Summary
console.log(`
═══════════════════════════════════════════
FT FUTURE OF AI 2026 — SETUP COMPLETE
═══════════════════════════════════════════
Event ID:     ${eventId}
Event:        FT Future of AI 2026
Date:         Nov 4–5, 2026
Venue:        Convene 22 Bishopsgate, London EC2N 4BQ
Budget Total: $${totalBudget.toLocaleString()}

Budget breakdown:
  Lead Sponsorship:    $79,000  (pending confirmation)
  Lanyard Add-on:      $10,000  (pending confirmation)
  Coffee Station:      $29,000  (optional, pending)
  Travel/Hotels:       ~$15,650 (estimated)
  Branding/Materials:  ~$6,800  (estimated)
  Contingency (10%):   $${contingency.toLocaleString()}

Planning items:  ${planCount}
Vendors:         FT Live, Ghelani Studios

⚡ KEY ACTIONS NEEDED:
  1. Contact Jack Austen — confirm 2026 dates + secure spot
  2. Decide package: Lead $79K / Premium $105K / Strategic $135K
  3. Confirm speaking slot for Eric Vaughan
  4. Get budget approval
`)

db.close()
