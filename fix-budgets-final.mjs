import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'events.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const ces = db.prepare("SELECT id FROM events WHERE name LIKE '%Customer Engagement Summit%'").get()
const lcw = db.prepare("SELECT id FROM events WHERE name LIKE '%London Community Week%'").get()
const cesId = ces.id
const lcwId = lcw.id

const engageVendor = db.prepare("SELECT id FROM vendors WHERE name LIKE '%Engage%'").get()
const lbcVendor = db.prepare("SELECT id FROM vendors WHERE name LIKE '%Led by Community%' OR name LIKE '%Becreative%'").get()
const engageId = engageVendor?.id || null
const lbcId = lbcVendor?.id || null

// Clear and rebuild from signed contracts
db.prepare('DELETE FROM budget_items WHERE event_id IN (?, ?)').run(cesId, lcwId)

// Update vendor notes with invoice/contract info
db.prepare("UPDATE vendors SET notes = ? WHERE id = ?").run(
  'Signed contract: Khoros-Engage-Business-Media-Summit-2026 (dated 12 March 2026). Contact: Angelo Antoline & Megan Anderson. Sales: Mike Cooke. Invoice due 15 Sep 2026.', engageId
)
db.prepare("UPDATE vendors SET name = 'Led by Community / Becreative Marketing', contact_name = 'Francisco Opazo', contact_email = 'francisco@ledby.community', contact_phone = '+447712279530', notes = ? WHERE id = ?").run(
  'Invoice PL10081 issued 08/04/2026. Payment due 08/04/2026 (PAST DUE). Bank: Barclays, Account 80198218, Sort 20-57-76, IBAN GB40 BUKB 20577680198218.', lbcId
)

const ins = db.prepare(`
  INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, payment_due_date, status, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// ══════════════════════════════════════════════════════════════════════
// CUSTOMER ENGAGEMENT SUMMIT 2026 — SIGNED CONTRACT
// Currency: GBP → USD at 1.26 rate
// Invoice: 1st July 2026 | Payment due: 15th September 2026
// ══════════════════════════════════════════════════════════════════════

// Contract items — Platinum Package (GBP converted to USD at 1.26)
// £37,500 → $47,250
ins.run(cesId, 'sponsorship', 'Platinum Sponsorship Package (£37,500)', engageId, 47250, 0, '2026-09-15', 'approved',
  'SIGNED CONTRACT (12 Mar 2026). Includes: Social Media Promo, Whitepaper download, Premium Branding (Digital+Onsite), Badge Scanner, 6x Vendor Passes (£1,495 each), 1-2-1 Messaging on Event App, 150 contact details from attendee list, Morning Presentation on Topic Stage (20 min), 5x Pre-arranged Meetings, Platinum Expo Stand Solution (print/build/dismantle). GBP price: £37,500. Invoice due 15 Sep 2026.')
// £8,000 → $10,080
ins.run(cesId, 'sponsorship', 'Coffee Barista Sponsorship — both days (£8,000)', engageId, 10080, 0, '2026-09-15', 'approved',
  'SIGNED CONTRACT. Coffee cart and barista for both days of event. Barista scans badges for contact details. GBP price: £8,000. Invoice due 15 Sep 2026.')
// £12,000 → $15,120
ins.run(cesId, 'sponsorship', 'Branded Lanyards Sponsorship (£12,000)', engageId, 15120, 0, '2026-09-15', 'approved',
  'SIGNED CONTRACT. Khoros branding on all lanyards for attendees. GBP price: £12,000. Invoice due 15 Sep 2026.')
// Contract subtotal: £57,500 → $72,450

// Branding & materials
ins.run(cesId, 'branding', 'Booth graphics & Platinum stand setup', null, 3500, 0, '2026-09-01', 'pending',
  'Custom printed graphics for Platinum Expo Stand. Stand is print/build/dismantle included in package — this covers Khoros custom artwork and production.')
ins.run(cesId, 'branding', 'Marketing collateral (brochures, one-pagers, demos)', null, 1500, 0, '2026-09-01', 'pending',
  'Khoros product brochures, Aurora AI and IRIS AI one-pagers, case studies for booth. Order by Sept 1 for Oct delivery.')
ins.run(cesId, 'branding', 'Swag & lead-capture giveaways', null, 2000, 0, '2026-09-01', 'pending',
  'Branded merchandise for booth visitors. Note: bring HDMI-to-Mac connector for screen connections at stand.')
ins.run(cesId, 'branding', 'Speaker presentation design (Vellanki)', null, 800, 0, '2026-09-15', 'pending',
  'Slide deck design for Topic Stage 20-min presentation. Final deck must be on USB on event day — no remote updates possible after arrival.')

// Travel — US to London, Oct 2026 (estimated, 4 people: Vellanki, Angelo + 2)
ins.run(cesId, 'travel', 'Flights — USA ↔ London Heathrow (4 people)', null, 6400, 0, '2026-09-01', 'pending',
  '4x roundtrip economy/business. Estimate $1,600/person. Book by Sept for best fares. Arrive Oct 6, depart Oct 9.')
ins.run(cesId, 'travel', 'Ground transport — airport transfers + local (4 people)', null, 800, 0, null, 'pending',
  'Heathrow transfers + local transport (tube/taxi) to Evolution London, Queenstown Road. ~£150/person.')

// Accommodation — Chelsea Bridge area (closest hotel: Pestana Chelsea Bridge)
ins.run(cesId, 'accommodation', 'Hotel — Chelsea area (4 rooms × 3 nights, Oct 6–8)', null, 3024, 0, '2026-09-01', 'pending',
  'Recommended: Pestana Chelsea Bridge Hotel & Spa — 0.5 mi from Evolution London. From £189/night. 4 rooms × 3 nights ≈ £2,268 (~$2,857). Allow buffer for Oct rates. Free cancellation available.')
ins.run(cesId, 'accommodation', 'Per diem — meals & incidentals (4 people × 3 days)', null, 1800, 0, null, 'pending',
  '$150/person/day in London. 4 people × 3 days (Oct 6–8). Covers all meals not provided at event, coffees, incidentals.')

// Contingency — 10% of contract value
ins.run(cesId, 'contingency', 'Contingency / Slush Fund Reserve — 10% of contract (£57,500)', null, 7245, 0, null, 'pending',
  '10% of contract value (£57,500 = $72,450) reserved for overruns, currency fluctuation (USD/GBP), last-minute adds, and on-site surprises.')

// Total CES: 47250+10080+15120+3500+1500+2000+800+6400+800+3024+1800+7245 = $99,519
// Set event budget_total = sum of items
const cesTotal = db.prepare('SELECT SUM(planned_amount) as t FROM budget_items WHERE event_id = ?').get(cesId).t
db.prepare('UPDATE events SET budget_total = ?, start_date = ?, end_date = ?, venue = ? WHERE id = ?').run(cesTotal, '2026-10-07', '2026-10-08', 'Evolution London, Queenstown Road, Chelsea Bridge, London SW11 4NJ', cesId)


// ══════════════════════════════════════════════════════════════════════
// LONDON COMMUNITY WEEK 2026 — INVOICE PL10081
// Currency: USD
// Invoice: 08/04/2026 | Due: 08/04/2026 (PAST DUE as of today Apr 16)
// ══════════════════════════════════════════════════════════════════════

// Contract items from invoice PL10081
ins.run(lcwId, 'sponsorship', 'Sponsorship for London Community Week', lbcId, 20000, 0, '2026-04-08', 'invoiced',
  'SIGNED INVOICE PL10081 (08 Apr 2026). Sponsor status and benefits for entire campaign, including 3 days of events in London. 3 full passes + 2 guest passes + booth + logo + leads + newsletter ad + Podcast Season 2. DUE DATE: 08/04/2026 — PAST DUE. Pay to: Barclays, Account 80198218, Sort 20-57-76.')
ins.run(lcwId, 'sponsorship', 'Headline Sponsorship Addon', lbcId, 5000, 0, '2026-04-08', 'invoiced',
  'SIGNED INVOICE PL10081. Khoros as headline sponsor: featured on stage at all times, additional spaces for on-site elements. Maximum visibility across entire campaign. DUE: 08/04/2026 — PAST DUE.')
ins.run(lcwId, 'sponsorship', 'Speaking Session London', lbcId, 5000, 0, '2026-04-08', 'invoiced',
  'SIGNED INVOICE PL10081. 20-min speaking session at Community Week Conference. Educational topic to be mutually agreed before announcing. DUE: 08/04/2026 — PAST DUE.')
// Invoice total: $30,000

// Branding
ins.run(lcwId, 'branding', 'Booth display & branded backdrop materials', null, 2000, 0, '2026-06-01', 'pending',
  'Booth display graphics, Khoros branded backdrop, banner stands, and branded coffee cart materials for Plexal booth. Order by June for July event.')
ins.run(lcwId, 'branding', 'Branded collateral & swag', null, 1500, 0, '2026-06-01', 'pending',
  'Khoros one-pagers, Aurora AI/IRIS AI materials, branded swag for booth. Use discount code IGNITETECHVIP for additional badge purchases if needed.')

// Travel — US to London, July 2026 (summer rates, 3 included passes in base)
ins.run(lcwId, 'travel', 'Flights — USA ↔ London (3 people, summer rates)', null, 5400, 0, '2026-05-01', 'pending',
  '3x roundtrip economy. $1,800/person in July (summer premium). Book by May. Travel day: Sun Jul 5 or Mon Jul 6. 3 full passes included in base package.')
ins.run(lcwId, 'travel', 'Ground transport — airport transfers + local (3 people)', null, 600, 0, null, 'pending',
  'Heathrow/Gatwick transfers + Tube/taxi to Plexal, Queen Elizabeth Olympic Park, Stratford. ~£150/person.')

// Accommodation — near Plexal, Stratford
ins.run(lcwId, 'accommodation', 'Hotel — Stratford/East London (3 rooms × 5 nights, Jul 5–10)', null, 4500, 0, '2026-05-01', 'pending',
  'Near Plexal, Queen Elizabeth Olympic Park. 3 rooms × 5 nights Jul 5–10. July peak rates ~£280-300/night (~$4,500). Suggest: Staybridge Suites Stratford or Premier Inn Stratford.')
ins.run(lcwId, 'accommodation', 'Per diem — meals & incidentals (3 people × 6 days)', null, 2700, 0, null, 'pending',
  '$150/person/day in London. 3 people × 6 days (Jul 5–10). Covers all meals outside event.')

// Contingency — 10% of invoice total
ins.run(lcwId, 'contingency', 'Contingency / Slush Fund Reserve — 10% of contract ($30,000)', null, 3000, 0, null, 'pending',
  '10% of invoice value ($30,000) reserved for VAT surprises, currency movement, additional add-ons (coffee cart $2k, badges $6k, swag bag $1k still available), on-site overruns.')

// Total LCW: 20000+5000+5000+2000+1500+5400+600+4500+2700+3000 = $49,700
const lcwTotal = db.prepare('SELECT SUM(planned_amount) as t FROM budget_items WHERE event_id = ?').get(lcwId).t
db.prepare('UPDATE events SET budget_total = ? WHERE id = ?').run(lcwTotal, lcwId)

// Update event_vendors with actual contract values
db.prepare("UPDATE event_vendors SET status = 'contracted', contract_value = ? WHERE event_id = ?").run(cesTotal, cesId)
db.prepare("UPDATE event_vendors SET status = 'contracted', contract_value = 30000, notes = 'Invoice PL10081 — PAST DUE 08 Apr 2026. $30,000 base contract (sponsorship + headline + speaking). Additional add-ons available.' WHERE event_id = ?").run(lcwId)

const cesTotalCheck = db.prepare('SELECT SUM(planned_amount) as t FROM budget_items WHERE event_id = ?').get(cesId).t
const lcwTotalCheck = db.prepare('SELECT SUM(planned_amount) as t FROM budget_items WHERE event_id = ?').get(lcwId).t
console.log(`✓ CES 2026: £57,500 contract (~$72,450 USD) + travel/branding/contingency = $${cesTotalCheck.toLocaleString()} total`)
console.log(`✓ LCW 2026: $30,000 invoice (PAST DUE) + travel/branding/contingency = $${lcwTotalCheck.toLocaleString()} total`)
console.log('\n⚠️  ACTION REQUIRED: LCW Invoice PL10081 was due 08 Apr 2026 — payment overdue!')

db.close()
