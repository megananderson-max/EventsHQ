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

// Clear existing planning items for both events
db.prepare('DELETE FROM planning_items WHERE event_id IN (?, ?)').run(cesId, lcwId)

const ins = db.prepare(`
  INSERT INTO planning_items (event_id, title, done, sort_order)
  VALUES (?, ?, 0, ?)
`)

let order = 0
function add(eventId, title) {
  ins.run(eventId, title, order++)
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOMER ENGAGEMENT SUMMIT 2026 — Oct 7–8, Evolution London
// Source: CES 2025 planning doc + 2026 signed contract
// ═══════════════════════════════════════════════════════════════════
order = 0

// ── CONTRACTING & PAYMENTS ──
add(cesId, '⚡ ACTION: Pay contract invoice to Engage Business Media by 15 Sep 2026 (£57,500 → $72,450)')
add(cesId, 'Confirm invoice details with Angelo Antoline & Megan Anderson at Engage Business Media')
add(cesId, 'File signed contract: Khoros-Engage-Business-Media-Summit-2026 (signed 12 Mar 2026)')

// ── EXHIBITOR MANAGEMENT PLATFORM ──
add(cesId, 'Complete all setup tasks in the Exhibitor Management Platform (Angelo has access)')
add(cesId, 'Register all 6 vendor passes in Exhibitor Management Platform')
add(cesId, 'Review list of confirmed attending companies in Exhibitor Management Platform')
add(cesId, 'Submit power upgrade requirement: 32A 3-phase power for booth')
add(cesId, 'Confirm Booth #C7 add-ons: demo bench, 43" screen, poseur table, 3 stools')

// ── BRANDING & ARTWORK ──
add(cesId, 'Submit lanyard branding artwork to Engage (Khoros logo on all attendee lanyards)')
add(cesId, 'Submit coffee cart branding artwork — Khoros branded cups for barista cart')
add(cesId, 'Design and order Platinum Expo Stand booth graphics (print/build/dismantle included)')
add(cesId, 'Order Khoros marketing collateral: product brochures, Aurora AI & IRIS AI one-pagers, case studies')
add(cesId, 'Order branded swag and merchandise for booth visitors')
add(cesId, 'Bring HDMI-to-Mac connector for screen connections at booth')

// ── SPEAKER PREPARATION (Vellanki) ──
add(cesId, 'Confirm speaker: Vellanki for Topic Stage 20-minute presentation')
add(cesId, 'Submit speaker profile to Engage: headshot, LinkedIn, short bio')
add(cesId, 'Finalize presentation title & synopsis: "Bring Back the Human Touch in Communities with AI"')
add(cesId, 'Design speaker slide deck (Vellanki presentation)')
add(cesId, 'Save final slide deck to USB drive — NO remote updates possible once on site')
add(cesId, 'Add QR code stickers and slide deck insert to presentation materials')
add(cesId, 'Vellanki: register for Speaker Lounge check-in (to right of registration desk)')
add(cesId, 'Record practice run of presentation and share raw recording with team')

// ── 1-2-1 MEETINGS & LEAD CAPTURE ──
add(cesId, 'Set up 5 pre-arranged 1-2-1 meetings via Event App messaging (included in Platinum package)')
add(cesId, 'Download Lead Capture badge scanner app on all team devices before event (event code: CES26)')
add(cesId, 'Customize lead qualification questions in badge scanner app')
add(cesId, 'Request 150 attendee contact details from Engage (included in Platinum package)')

// ── TRAVEL & LOGISTICS ──
add(cesId, 'Book flights: 4 people USA ↔ London Heathrow — arrive Oct 6, depart Oct 9')
add(cesId, 'Book hotel: Pestana Chelsea Bridge (4 rooms × 3 nights, Oct 6–8) — 0.5 mi from Evolution London')
add(cesId, 'Arrange Heathrow airport transfers to Evolution London, Queenstown Road, Chelsea Bridge SW11 4NJ')
add(cesId, 'Confirm ground transport / local travel budget (Tube/taxi Oct 6–8)')
add(cesId, 'Set up team Slack channel for event coordination')

// ── WEEK BEFORE EVENT ──
add(cesId, 'Confirm final delivery arrangements for all materials to Evolution London venue')
add(cesId, 'Remind all staff to arrive from 7:15am on Oct 7 for stand setup')
add(cesId, 'Print/download all tickets — badges printed on-site from registration system')
add(cesId, 'Confirm all 6 team members have their vendor passes registered')
add(cesId, 'Brief all booth staff on lead capture process and qualification questions')
add(cesId, 'Check in Exhibitor Management Platform — complete any outstanding tasks')

// ── ON-SITE: ARRIVAL (Oct 6) ──
add(cesId, '[DAY -1] Team arrives London — check in to Pestana Chelsea Bridge')
add(cesId, '[DAY -1] Team dinner / evening briefing on event objectives and talking points')

// ── ON-SITE: EVENT DAY (Oct 7) ──
add(cesId, '[EVENT DAY] Arrive Evolution London from 7:15am for stand setup')
add(cesId, '[EVENT DAY] Print badges on-site at registration desk')
add(cesId, '[EVENT DAY] Check Booth #C7: demo bench, 43" screen, poseur table, 3 stools all in place')
add(cesId, '[EVENT DAY] Verify Khoros branded coffee cart is positioned correctly next to booth')
add(cesId, '[EVENT DAY] Place QR code stickers at booth and around the event venue')
add(cesId, '[EVENT DAY] Vellanki check in at Speaker Lounge 30 mins before presentation time')
add(cesId, '[EVENT DAY] Scan all booth visitor badges using Lead Capture app throughout the day')
add(cesId, '[EVENT DAY] Confirm 5 pre-arranged 1-2-1 meetings are scheduled in Event App')
add(cesId, '[EVENT DAY] Stay for Summit Networking Party (free drinks, comedian — until 7pm)')

// ── POST-EVENT ──
add(cesId, 'Export all leads from Lead Capture app within 24 hrs of event')
add(cesId, 'Cross-reference scanned leads with 150 sponsored attendee contacts from Engage')
add(cesId, 'Distribute leads to sales team with context notes')
add(cesId, 'Send personalised follow-up emails to all booth visitors within 48 hrs')
add(cesId, 'Share Vellanki presentation recording with team and post to Khoros content channels')
add(cesId, 'Complete ROI report: leads captured, meetings held, pipeline generated vs. $72,450 spend')

console.log(`✓ CES 2026: ${order} planning items added`)

// ═══════════════════════════════════════════════════════════════════
// LONDON COMMUNITY WEEK 2026 — Jul 7–11, Plexal, Stratford
// Source: LCW 2025 planning doc + 2026 invoice PL10081
// ═══════════════════════════════════════════════════════════════════
order = 0

// ── URGENT: PAYMENT ──
add(lcwId, '🚨 URGENT: Pay Invoice PL10081 — $30,000 to Led by Community / Becreative Marketing (PAST DUE since 08 Apr 2026)')
add(lcwId, 'Payment details: Barclays, Account 80198218, Sort 20-57-76, IBAN GB40 BUKB 20577680198218')
add(lcwId, 'Contact Francisco Opazo to confirm payment received: francisco@ledby.community / +447712279530')

// ── SPONSORSHIP & PACKAGE CONFIRMATION ──
add(lcwId, 'Confirm sponsorship package details with Led by Community organiser (Francisco Opazo)')
add(lcwId, 'Use discount code IGNITETECHVIP for any additional badge purchases needed')
add(lcwId, 'Confirm 3 full passes + 2 guest passes are activated in attendee system')
add(lcwId, 'Submit Khoros logo for newsletter advertisement (included in package)')
add(lcwId, 'Confirm Podcast Season 2 sponsorship details and recording schedule')
add(lcwId, 'Confirm Headline Sponsorship on-stage visibility — Khoros name on stage at all times')

// ── SPEAKING SESSION ──
add(lcwId, 'Agree speaking session topic with organiser (20-min, educational, no product promotion) — mutually agreed before announcing')
add(lcwId, 'Finalize speaker: confirm who from Khoros/IgniteTech will present (Michael Puhala or other)')
add(lcwId, 'Submit speaker profile: name, headshot, LinkedIn, short bio to organiser')
add(lcwId, 'Design and complete speaker slide deck')
add(lcwId, 'Announce speaking session topic publicly once agreed with organiser')

// ── HACKATHON (Jul 8) ──
add(lcwId, 'Confirm Khoros team participation in Hackathon day (Jul 8, 9am–5pm)')
add(lcwId, 'Brief attending team on Hackathon format and Khoros participation goals')
add(lcwId, 'Coordinate any Khoros API / demo access needed for Hackathon participants')

// ── BOOTH & BRANDING ──
add(lcwId, 'Design and order booth display graphics and Khoros branded backdrop for Plexal booth')
add(lcwId, 'Order Khoros branded collateral: Aurora AI / IRIS AI one-pagers, case studies, swag')
add(lcwId, 'Set up badge/lead capture process for booth visitors')

// ── CUSTOMER & PROSPECT VISITS ──
add(lcwId, 'Coordinate customer visit schedule around conference days (UK Post Office + others)')
add(lcwId, 'Brief Account Managers and CSMs — ask them to introduce potentially interested customers')
add(lcwId, 'Set up Friday lunch meeting with UK Post Office (Thibault — Jul 11, 12pm)')
add(lcwId, 'Prepare customer meeting agenda / talking points for each scheduled visit')

// ── TRAVEL & LOGISTICS ──
add(lcwId, 'Book flights: 3 people USA ↔ London — arrive Sun Jul 5 or Mon Jul 6 (summer rates, book by May)')
add(lcwId, 'Book hotel: near Plexal, Queen Elizabeth Olympic Park, Stratford (3 rooms × 5 nights, Jul 5–10)')
add(lcwId, 'Suggested hotels: Staybridge Suites Stratford or Premier Inn Stratford')
add(lcwId, 'Arrange airport transfers (Heathrow/Gatwick → Plexal, Olympic Park, Stratford E20)')
add(lcwId, 'Confirm final attendee list: who is attending (Thibault, Michael, Jake + guests)')

// ── PANEL DISCUSSION ──
add(lcwId, 'Confirm Khoros speaker for panel discussion (competitive: Higher Logic, Bettermode, Bevy, Discourse)')
add(lcwId, 'Submit panel participant details to organiser: name, headshot, LinkedIn, short bio')
add(lcwId, 'Brief panel speaker on competitive positioning and key talking points')
add(lcwId, 'Note: Panel is industry discussion — NOT a platform to promote products/services directly')

// ── WEEK BEFORE EVENT ──
add(lcwId, 'Confirm all logistics: hotel, transport, passes, speaker slot confirmed with organiser')
add(lcwId, 'Brief full attending team on event objectives, schedule, and key contacts')
add(lcwId, 'Ensure speaker slide deck is finalised and accessible offline')
add(lcwId, 'Pack branded materials: backdrop, collateral, swag, badge scanner')

// ── ON-SITE ──
add(lcwId, '[ARRIVE Jul 5/6] Team arrives London — check in to hotel near Stratford')
add(lcwId, '[Jul 8] Hackathon day at Plexal (9am–5pm)')
add(lcwId, '[Jul 9] Conference Day 1 at Plexal (8:15am–5pm)')
add(lcwId, '[Jul 10] Conference Day 2 at Plexal (8:15am–5pm) + speaking session (10am)')
add(lcwId, '[Jul 10] Sponsored After-Party (5–7pm) — confirm security logistics')
add(lcwId, '[Jul 10] After-After Party coordination if required (8–10pm)')
add(lcwId, '[Jul 11] Thibault: Lunch meeting with UK Post Office (12pm)')
add(lcwId, '[Jul 11] UnConference day (9:30am–4pm)')

// ── POST-EVENT ──
add(lcwId, 'Export badge scan leads and share with sales team')
add(lcwId, 'Follow up with all customer visit contacts within 48 hrs')
add(lcwId, 'Coordinate Podcast Season 2 recording/sponsorship deliverables with organiser')
add(lcwId, 'Complete ROI report: leads, meetings, pipeline, brand visibility vs. $30,000 spend')
add(lcwId, 'Share event recap and learnings for LCW 2027 planning')

console.log(`✓ LCW 2026: ${order} planning items added`)

// Summary
const cesCount = db.prepare('SELECT COUNT(*) as n FROM planning_items WHERE event_id = ?').get(cesId).n
const lcwCount = db.prepare('SELECT COUNT(*) as n FROM planning_items WHERE event_id = ?').get(lcwId).n
console.log(`\nDatabase totals:`)
console.log(`  CES 2026: ${cesCount} planning items`)
console.log(`  LCW 2026: ${lcwCount} planning items`)

db.close()
