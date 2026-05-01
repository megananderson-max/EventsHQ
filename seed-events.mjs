import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'events.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Ensure planning_items table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS planning_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

const insertEvent = db.prepare(`
  INSERT INTO events (name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertVendor = db.prepare(`
  INSERT INTO vendors (name, category, contact_name, contact_email, notes)
  VALUES (?, ?, ?, ?, ?)
`)
const insertEV = db.prepare(`
  INSERT INTO event_vendors (event_id, vendor_id, status, contract_value, notes)
  VALUES (?, ?, ?, ?, ?)
`)
const insertBudget = db.prepare(`
  INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, po_number, status, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertStaff = db.prepare(`
  INSERT INTO staff (event_id, name, role, email, arrival_date, departure_date, hotel, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertROS = db.prepare(`
  INSERT INTO run_of_show (event_id, event_day, start_time, end_time, activity, owner, location, notes, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertPlan = db.prepare(`
  INSERT INTO planning_items (event_id, title, done, sort_order)
  VALUES (?, ?, ?, ?)
`)

// ─── Customer Engagement Summit 2026 ───────────────────────────────────────
const ces = insertEvent.run(
  'Customer Engagement Summit 2026',
  'conference',
  'planning',
  '2026-10-07',
  '2026-10-08',
  'London, UK',
  'Evolution London, Queenstown Road, Chelsea Bridge, London SW11 4NJ',
  3000,
  100300, // Diamond package as default
  "One of Europe's leading conferences on customer engagement. 15th anniversary, 2-day format. Senior CX leaders, contact centre directors, digital transformation and data executives. 150+ exhibitors."
)
const cesId = ces.lastInsertRowid

// Vendors
const engageCustomer = insertVendor.run('Engage Customer / Engage Business Media', 'marketing', null, null, 'Event organiser for Customer Engagement Summit. Lead capture app: Engage Business Media Events. Event code: CES25, Exhibitor code: EX5ca37.')
const engageId = engageCustomer.lastInsertRowid

insertEV.run(cesId, engageId, 'contracted', 100300, 'Diamond Package sponsorship — confirmed.')

// Budget items (Diamond Package)
insertBudget.run(cesId, 'marketing', 'Diamond Sponsorship Package', engageId, 73600, 0, null, 'pending',
  'Includes: Social media promo, whitepaper download, premium branding, 8x vendor passes, 1-2-1 messaging, topic stage AM presentation (20 min), panel topic stage (20 min), roundtable (60 min), diamond expo stand, badge scanner, meetings concierge (5 meetings), contacts package (200 contacts).')
insertBudget.run(cesId, 'marketing', 'Coffee Cart & Branded Barista', engageId, 10700, 0, null, 'pending',
  'Branded cups + QR scan. Event recording included — professional recording shared post-event fully edited.')
insertBudget.run(cesId, 'marketing', 'Lanyards (TBC)', engageId, 16000, 0, null, 'pending', 'If available — to be confirmed.')

// Staff
insertStaff.run(cesId, 'Vellanki', 'Speaker', null, '2026-10-06', '2026-10-08', null,
  'Speaking slot confirmed. Arrive 30 min before session. Collect badge at fast-track speaker queue (red carpet). Check in at Speaker Lounge (inside on the right). Fitted with lapel mic. Repeater screen with presenter notes. Bring slides on USB stick — no slide updates possible after arrival.')
insertStaff.run(cesId, 'Angelo', 'Exhibitor Lead', null, '2026-10-07', '2026-10-08', null,
  'Has access to Exhibitor Management Platform. Staff arrive from 7:15am. Print badges on-site.')

// Run of Show
insertROS.run(cesId, 1, '07:15', '08:15', 'Exhibitor Setup & Staff Arrival', 'Angelo', 'Exhibition Floor', 'Exhibitor staff can arrive from 7:15am. Print badges on-site.', 'planned')
insertROS.run(cesId, 1, '08:15', '09:00', 'Attendee Registration Opens', 'Registration Team', 'Main Entrance', 'Attendees arrive from 8:15am.', 'planned')
insertROS.run(cesId, 1, '09:00', '17:40', 'Conference Sessions — Day 1', 'Various', 'Main Stage + Topic Stages', 'Keynotes, panels, workshops, roundtables.', 'planned')
insertROS.run(cesId, 1, '17:40', '19:00', 'Summit Networking Party', 'Events Team', 'Engage Inn', 'Free drinks, comedian Simon Evans. Engage Inn open from 11am with "Hoppy Customer" + "Summit Session" complimentary drinks.', 'planned')
insertROS.run(cesId, 2, '07:15', '08:15', 'Exhibitor Setup', 'Angelo', 'Exhibition Floor', null, 'planned')
insertROS.run(cesId, 2, '08:15', '09:00', 'Attendee Registration Day 2', 'Registration Team', 'Main Entrance', null, 'planned')
insertROS.run(cesId, 2, '09:00', '17:40', 'Conference Sessions — Day 2', 'Various', 'Main Stage + Topic Stages', null, 'planned')

// Planning items (from Decisions/Action Required)
const cesPlanItems = [
  'All event invoices paid',
  'Attendees to register for the event (use Premium Ticket link + discount code)',
  'Slide deck for Vellanki presentation',
  'Marketing collateral decided: creative, printing, digital promo — artwork required before Sept 9th',
  'QR Code stickers and slide deck insert',
  'Download Engage Business Media Events app (event code: CES25)',
  'Download Elements Capture app for badge scanning on-site',
  'Complete all outstanding tasks in Exhibitor Management Platform',
  'Brief speaker (Vellanki) on Speaker Lounge check-in and stage setup',
  'Review Health & Safety guidance (food/drink, PAT testing)',
  'Arrange final deliveries to venue',
  'Confirm whether Demo Bench with 43" screen is needed again',
  'Book hotel for attendees — recommended: Pestana Chelsea Bridge Hotel (0.5 mi from venue)',
]
cesPlanItems.forEach((title, i) => insertPlan.run(cesId, title, 0, i + 1))


// ─── London Community Week 2026 ────────────────────────────────────────────
const lcw = insertEvent.run(
  'London Community Week 2026',
  'conference',
  'planning',
  '2026-07-07',
  '2026-07-10',
  'London, UK',
  'Plexal, Queen Elizabeth Olympic Park, Stratford, London',
  200,
  20000, // Base sponsorship
  'Flagship annual gathering for senior community professionals — Heads of Community, VP Community, CS leaders from SaaS, tech, and mission-driven orgs. Khoros sponsorship (returning from 2024 and 2025). 4-day event: Hackathon (Jul 7), Sponsored After-Party (Jul 9), Community-led World Conference (Jul 9–10), Unconference Plus London (Jul 10).'
)
const lcwId = lcw.lastInsertRowid

// Vendors
const ledByCommunity = insertVendor.run('Led by Community', 'marketing', 'Francisco Opazo', 'francisco@ledby.community',
  'Event organiser. Primary contact for sponsorship, invoicing, and logistics. Response time typically same-day. Slack: #community-week (C09HB6MP0N4).')
const lbcId = ledByCommunity.lastInsertRowid

insertEV.run(lcwId, lbcId, 'rfp_sent', 20000, 'Base sponsorship package under review. Includes: booth, 3 full passes + 2 guest passes, access to event leads (name/role/location/LinkedIn), newsletter ad, Podcast Season 2 inclusion.')

// Budget items
insertBudget.run(lcwId, 'marketing', 'Base Sponsorship Package', lbcId, 20000, 0, null, 'pending',
  'Booth + brand sponsoring all activities + logo placement (UTM tracking) + leads access + 3 full passes + 2 guest passes + newsletter ad + Podcast Season 2 inclusion. +VAT.')
insertBudget.run(lcwId, 'marketing', 'Headline Sponsor Add-On (optional)', lbcId, 5000, 0, null, 'pending',
  'Co-brand event with photo booths, large backdrops, games, branded mobile coffee bar. Total = $25,000 + VAT. +VAT.')
insertBudget.run(lcwId, 'marketing', 'Badge + Credentials + Lanyards (optional)', lbcId, 6000, 0, null, 'pending',
  'Khoros branding on all credentials across Hackathon, Conference, Unconference. Becomes Agenda Sponsor. +VAT.')
insertBudget.run(lcwId, 'marketing', 'Speaking Session — In-Person (optional)', lbcId, 5000, 0, null, 'pending',
  '25-min educational session incl. Q&A. Speaker on main speakers page + social promo + session recording rights. +VAT.')
insertBudget.run(lcwId, 'marketing', 'Sponsored Conference Sessions Video Branding (optional)', lbcId, 12000, 0, null, 'pending',
  'Khoros logo co-branded on ALL session replays for 2 conference days. Distributed on YouTube. 2 sessions in newsletter (6,000+ readers). +VAT.')
insertBudget.run(lcwId, 'marketing', 'Exclusive Reception Sponsorship (optional)', lbcId, 5000, 0, null, 'pending',
  '2 passes to join speakers at reception. Intimate access to all conference speakers and VIPs. +VAT.')
insertBudget.run(lcwId, 'marketing', 'Coffee Cart Sponsorship (optional)', lbcId, 2000, 0, null, 'pending',
  'Branded service stations, branded cups, quality arabica, equipment setup/takedown, consumables. +VAT.')
insertBudget.run(lcwId, 'marketing', 'Swag Bag Insert (optional)', lbcId, 1000, 0, null, 'pending',
  '1 branded element (merch, voucher, or sample) in all LCW attendee swag bags. +VAT.')
insertBudget.run(lcwId, 'marketing', 'After-Party / Venue Extension (optional)', lbcId, 7500, 0, null, 'pending',
  'Not in 2026 deck — arrange directly with Francisco. Based on 2025: ~$7,500 venue extension. Confirm availability.')
insertBudget.run(lcwId, 'marketing', 'Private Dinner with Speakers (optional)', lbcId, 6000, 0, null, 'pending',
  'Wed Jul 8. Intimate dinner for speakers and VIPs. Based on 2025: ~$6,000 at Drake & Morgan Devonshire Terrace. 2026 TBD.')
insertBudget.run(lcwId, 'marketing', 'Speaking Session — Online (optional)', lbcId, 1000, 0, null, 'pending',
  'Same as in-person session but virtual. +VAT.')

// Staff (potential attendees)
const lcwAttendees = [
  ['Antonios', 'Attendee'],
  ['Vellanki', 'Attendee'],
  ['Abby', 'Attendee'],
  ['Suuchi', 'Attendee (TBC)'],
  ['Angelo', 'Attendee / Lead'],
  ['Megan Anderson', 'Event Lead'],
  ['Photographer', 'Media'],
  ['Videographer', 'Media'],
]
lcwAttendees.forEach(([name, role]) => {
  insertStaff.run(lcwId, name, role, null, '2026-07-05', '2026-07-11', null,
    'Travel day: Sun Jul 5 or Mon Jul 6. 3 passes included in base package + 2 additional guest passes.')
})

// Run of Show (based on confirmed structure + 2025 reference)
insertROS.run(lcwId, 0, 'All Day', null, 'Travel & Arrival Day', 'All Staff', 'London', 'Fly to London and check in. No official event programming. Sun Jul 5 or Mon Jul 6.', 'planned')
insertROS.run(lcwId, 1, '09:00', '17:00', 'Community Strategy Hackathon', 'Khoros Team', 'Plexal, Queen Elizabeth Olympic Park', 'Teams collaborate on real-world community challenges. Open to registered attendees.', 'planned')
insertROS.run(lcwId, 2, 'TBD', null, 'Optional: Private Dinner with Speakers', 'Megan / Angelo', 'Drake & Morgan Devonshire Terrace (TBC)', 'Intimate dinner for speakers and VIPs. ~$6,000. 2026 TBD — confirm with Francisco.', 'planned')
insertROS.run(lcwId, 3, '08:15', '09:00', 'Registration & Networking — Coffee Cart (Day 1)', 'Khoros Branded Coffee Cart', 'Registration Area', 'Khoros branded coffee cart available to attendees during morning registration.', 'planned')
insertROS.run(lcwId, 3, '09:00', '17:00', 'Community-led World Conference — Summit Day 1', 'Khoros Team', 'Plexal Main Venue', 'Keynotes, panels, workshops across 2 tracks. Panel/Speaking slot TBD — confirm with Francisco.', 'planned')
insertROS.run(lcwId, 3, '17:00', '19:00', 'Khoros After-Party (if purchased)', 'Khoros Team', 'Plexal (venue extension)', 'Branded signage, catering, drinks. Builds relationship capital with attendees and speakers.', 'planned')
insertROS.run(lcwId, 4, '08:15', '09:00', 'Registration & Networking — Coffee Cart (Day 2)', 'Khoros Branded Coffee Cart', 'Registration Area', 'Coffee cart activation, Day 2.', 'planned')
insertROS.run(lcwId, 4, '09:00', '17:00', 'Community-led World Conference — Summit Day 2 + Unconference Plus London', 'Khoros Team', 'Plexal Main Venue', 'Keynotes, panels, workshops + attendee-led open discussions. Unconference runs concurrently or immediately after.', 'planned')
insertROS.run(lcwId, 4, '19:00', null, 'After-After Party (optional, ~$1,000)', 'Optional', 'TBD', 'Informal gathering, ~$1,000 venue extension. Based on 2025.', 'planned')

// Planning items (from Decisions/Action Required + additional logistics)
const lcwPlanItems = [
  'Confirm whether Khoros will sponsor London Community Week 2026',
  'Determine sponsorship package tier ($20,000 base or Headline at $25,000)',
  'Confirm budget approval and obtain written sign-off',
  'Contact Francisco Opazo (francisco@ledby.community) to confirm package, VAT treatment, and invoice timeline',
  'Identify and confirm 2026 Khoros attendees (3 passes included in base package)',
  'Decide: Headline Sponsor add-on (+$5,000 = $25,000 + VAT)',
  'Decide: Badge + Credentials + Lanyards add-on ($6,000 + VAT)',
  'Decide: Speaking Session — In-Person ($5,000 + VAT) or Online ($1,000 + VAT)',
  'Decide: Sponsored Conference Sessions video branding ($12,000 + VAT)',
  'Decide: Exclusive Reception Sponsorship ($5,000 + VAT)',
  'Decide: Swag Bag Insert ($1,000 + VAT)',
  'Decide: After-Party / venue extension (confirm 2026 availability with Francisco)',
  'Decide: Private Dinner with speakers (Wed Jul 8, ~$6,000)',
  'Confirm discount code IGNITETECHVIP still valid for 2026 individual badge purchases',
  'Monitor for 2026 full agenda release (expected first week of April 2026)',
  'Book flights and hotels for confirmed attendees (travel day: Sun Jul 5 or Mon Jul 6)',
  'Coordinate booth setup and branded materials',
  'Arrange photographer / videographer for on-site content',
]
lcwPlanItems.forEach((title, i) => insertPlan.run(lcwId, title, 0, i + 1))

console.log(`✓ Customer Engagement Summit 2026 created (id: ${cesId})`)
console.log(`✓ London Community Week 2026 created (id: ${lcwId})`)
console.log('Done.')
db.close()
