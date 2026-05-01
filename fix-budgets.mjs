import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'events.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Get event IDs
const ces = db.prepare("SELECT id FROM events WHERE name LIKE '%Customer Engagement Summit%'").get()
const lcw = db.prepare("SELECT id FROM events WHERE name LIKE '%London Community Week%'").get()
const cesId = ces.id
const lcwId = lcw.id

// ── Clear existing budget items and rebuild properly ──────────────────────
db.prepare('DELETE FROM budget_items WHERE event_id IN (?, ?)').run(cesId, lcwId)

const ins = db.prepare(`
  INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, payment_due_date, status, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Get vendor IDs
const engageVendor = db.prepare("SELECT id FROM vendors WHERE name LIKE '%Engage%'").get()
const lbcVendor = db.prepare("SELECT id FROM vendors WHERE name LIKE '%Led by Community%'").get()
const engageId = engageVendor?.id || null
const lbcId = lbcVendor?.id || null

// ══════════════════════════════════════════════════════════════════════
// CUSTOMER ENGAGEMENT SUMMIT 2026 — Oct 7-8, London
// Pay sponsorship Q2 (before Q3 event)
// ══════════════════════════════════════════════════════════════════════
// Sponsorship
ins.run(cesId, 'sponsorship', 'Diamond Sponsorship Package', engageId, 73600, 0, '2026-06-30', 'pending',
  'Topic Stage AM presentation (20 min), Panel (20 min), Roundtable (60 min), Diamond Expo Stand, Badge scanner, 5x meetings concierge, 200 contacts, 8x vendor passes, social promo, whitepaper, premium branding.')
ins.run(cesId, 'sponsorship', 'Coffee Cart & Branded Barista + Event Recording', engageId, 10700, 0, '2026-06-30', 'pending',
  'Branded cups + QR scan. Professional event recording shared post-event fully edited.')
ins.run(cesId, 'sponsorship', 'Lanyards (TBC)', engageId, 16000, 0, '2026-07-31', 'pending',
  'If available — to be confirmed with Engage team.')

// Branding & Materials
ins.run(cesId, 'branding', 'Branded booth graphics & shell scheme wraps', null, 3500, 0, '2026-09-01', 'pending',
  'Custom printed booth graphics for Diamond expo stand. Order by Sept 1 for Oct delivery.')
ins.run(cesId, 'branding', 'Printed collateral (brochures, one-pagers, leave-behinds)', null, 1500, 0, '2026-09-01', 'pending',
  'Khoros product brochures, Aurora AI and IRIS AI one-pagers, case studies.')
ins.run(cesId, 'branding', 'Demo equipment & screen setup', null, 500, 0, null, 'pending',
  'Mac to HDMI connector, USB sticks for AV team, cables. Note: HDMI only (not USB) for standard screens.')
ins.run(cesId, 'branding', 'Swag & giveaways', null, 2000, 0, '2026-09-01', 'pending',
  'Branded merchandise for booth visitors and lead capture incentive.')

// Travel — London, UK (Oct 2026 rates)
// Assume 4 people attending: Vellanki + Angelo + 2 others
ins.run(cesId, 'travel', 'Flights — USA to London return (4 people)', null, 6400, 0, '2026-09-01', 'pending',
  '4x roundtrip economy/business class. Estimate $1,600/person USA-LHR. Book by Sept for best rates.')
ins.run(cesId, 'travel', 'Ground transport — airport transfers & local (4 people)', null, 800, 0, null, 'pending',
  'Heathrow or Gatwick transfers + local transport during event days. Approx £150/person.')

// Accommodation — Chelsea Bridge area (closest to Evolution London)
ins.run(cesId, 'accommodation', 'Hotel — Pestana Chelsea Bridge (4 people x 2 nights)', null, 2400, 0, '2026-09-01', 'pending',
  'Recommended: Pestana Chelsea Bridge Hotel & Spa, 0.5 mi from Evolution London. Approx £189/night. 4 rooms x 2 nights = £1,512 (~$1,900). Add buffer for flexibility. Free cancellation.')
ins.run(cesId, 'accommodation', 'Per diem — meals & incidentals (4 people x 3 days)', null, 1800, 0, null, 'pending',
  '$150/person/day in London. Covers meals not provided at event, coffees, incidentals. 4 people x 3 days.')

// Contingency
ins.run(cesId, 'contingency', 'Contingency / Slush Fund Reserve (10%)', null, 11970, 0, null, 'pending',
  '10% of planned spend reserved for overruns, last-minute adds, and on-site surprises.')

// Total CES: 73600+10700+16000+3500+1500+500+2000+6400+800+2400+1800+11970 = 131,170
db.prepare("UPDATE events SET budget_total = ? WHERE id = ?").run(131170, cesId)


// ══════════════════════════════════════════════════════════════════════
// LONDON COMMUNITY WEEK 2026 — Jul 7-10, London
// Pay sponsorship in Q1 (event is Q3)
// ══════════════════════════════════════════════════════════════════════
// Sponsorship
ins.run(lcwId, 'sponsorship', 'Base Sponsorship Package', lbcId, 20000, 0, '2026-03-31', 'pending',
  'Booth + brand sponsoring all activities + logo placement (UTM) + leads access (name/role/location/LinkedIn) + 3 full passes + 2 guest passes + newsletter ad + Podcast Season 2. +VAT.')
ins.run(lcwId, 'sponsorship', 'Speaking Session — In-Person (recommended)', lbcId, 5000, 0, '2026-05-31', 'pending',
  '25-min educational session incl. Q&A. Speaker on main speakers page + social promo + session recording rights. +VAT. Confirm with Francisco.')

// Branding & Add-ons
ins.run(lcwId, 'branding', 'Badge + Credentials + Lanyards (Agenda Sponsor)', lbcId, 6000, 0, '2026-05-31', 'pending',
  'Khoros branding on all credentials across Hackathon, Conference, Unconference. Becomes Agenda Sponsor. QR code on back of credential. +VAT.')
ins.run(lcwId, 'branding', 'Coffee Cart Sponsorship (2 days)', lbcId, 2000, 0, '2026-05-31', 'pending',
  'Branded service stations, branded cups, quality arabica, equipment setup/takedown, consumables. Morning registration activation Jul 9-10. +VAT.')
ins.run(lcwId, 'branding', 'Booth materials & branded graphics', null, 2000, 0, '2026-06-15', 'pending',
  'Booth display graphics, Khoros branded backdrop, product materials, demo setup for Plexal booth.')

// Travel — London, UK (Jul 2026 rates — summer premium)
// Assume 4 people attending (from US): Angelo, Megan + 2 others
ins.run(lcwId, 'travel', 'Flights — USA to London return (4 people)', null, 7200, 0, '2026-05-01', 'pending',
  '4x roundtrip economy/business. Estimate $1,800/person USA-LHR in July (summer rates). Book by May for best fares. Travel day: Sun Jul 5 or Mon Jul 6.')
ins.run(lcwId, 'travel', 'Ground transport — airport transfers & local (4 people)', null, 800, 0, null, 'pending',
  'Heathrow/Gatwick transfers + local transport (Tube/taxi) across 4-day event. ~£150/person.')

// Accommodation — near Plexal, Queen Elizabeth Olympic Park, Stratford
ins.run(lcwId, 'accommodation', 'Hotel — Stratford/East London (4 people x 5 nights)', null, 4800, 0, '2026-05-01', 'pending',
  'Near Plexal, Queen Elizabeth Olympic Park. Suggest: Staybridge Suites or Premier Inn Stratford. Approx £200-240/night in July (peak). 4 rooms x 5 nights Jul 5-10.')
ins.run(lcwId, 'accommodation', 'Per diem — meals & incidentals (4 people x 6 days)', null, 3600, 0, null, 'pending',
  '$150/person/day in London (higher in summer). 4 people x 6 days (Jul 5-10). Covers all meals outside event.')

// Contingency
ins.run(lcwId, 'contingency', 'Contingency / Slush Fund Reserve (10%)', null, 5140, 0, null, 'pending',
  '10% of planned spend reserved for VAT differences, currency fluctuation (USD/GBP), and on-site expenses.')

// Total LCW: 20000+5000+6000+2000+2000+7200+800+4800+3600+5140 = 56,540
// User says ~$40k — that's probably just base+branding+add-ons without travel.
// With travel it's realistic ~$56k but let's set budget_total to reflect "committed" items
// Base+Speaking+Badges+Coffee+Branding = 35,000 + travel 12,400 + accommodation 8,400 + contingency 5,140 = 60,940
// Let's go with $56,540 total (what the items sum to)
db.prepare("UPDATE events SET budget_total = ? WHERE id = ?").run(56540, lcwId)

const cesSum = db.prepare('SELECT SUM(planned_amount) as total FROM budget_items WHERE event_id = ?').get(cesId)
const lcwSum = db.prepare('SELECT SUM(planned_amount) as total FROM budget_items WHERE event_id = ?').get(lcwId)
console.log(`✓ CES 2026 budget items total: $${cesSum.total.toLocaleString()} (budget_total updated)`)
console.log(`✓ LCW 2026 budget items total: $${lcwSum.total.toLocaleString()} (budget_total updated)`)

db.close()
