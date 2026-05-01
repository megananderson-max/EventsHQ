// seed-vendors-full.mjs
// Restores the full vendor directory from all known event suppliers.
// Only inserts vendors that don't already exist (checked by name).

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'events.db'))

const exists = (name) => !!db.prepare('SELECT id FROM vendors WHERE name = ?').get(name)

const insert = db.prepare(`
  INSERT INTO vendors (name, category, contact_name, contact_email, contact_phone, website, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const vendors = [

  // ── EVENT ORGANISERS / SPONSORSHIP ───────────────────────────────────────

  {
    name: 'FT Live',
    category: 'sponsorship',
    contact_name: 'Jack Austen',
    contact_email: 'jack.austen@ft.com',
    contact_phone: null,
    website: 'https://live.ft.com',
    notes: 'Events division of the Financial Times. Organiser of FT Future of AI.\n\nKey contacts:\n• Sponsorship: Jack Austen (jack.austen@ft.com)\n• Marketing: Vanessa Gayle Tiong (vanessagayle.tiong@ft.com), Yana Yitzhaki (yana.yitzhaki@ft.com)\n• Operations: Tayla Cawsey (tayla.cawsey@ft.com, +44 799 9407 243)\n• Content/Speaker: Yasmin Alsadoon (yasmin.alsadoon@ft.com, +44 7506 801737), Tierney Rose O\'Kelly (tierneyrose.okelly@ft.com, +44 7738 409744)\n\n2025 package: Lead Sponsorship $76,000 + Lanyard $10,000 = $86,000 total.\n2026 pricing: Lead $79,000 · Premium $105,000 · Strategic $135,000. Add-ons: Lanyard $10,000, Coffee Station $29,000.',
  },

  {
    name: 'Engage Business Media',
    category: 'sponsorship',
    contact_name: 'Angelo Antoline',
    contact_email: null,
    contact_phone: null,
    website: 'https://engagecustomer.com',
    notes: 'Organiser of Customer Engagement Summit (annual, Evolution London).\n\nKey contacts:\n• Angelo Antoline — main contact\n• Megan Anderson — event management\n• Mike Cooke — sales\n\nContract signed 12 March 2026. Invoice due 15 Sep 2026: £57,500 (~$72,450 USD).\nPlatinum package includes: Booth #C7, 6 vendor passes, lanyard branding, coffee cart branding, 20-min Topic Stage speaking slot, 150 sponsored attendee contacts, 5 pre-arranged 1-2-1 meetings, Lead Capture app (event code: CES26).',
  },

  {
    name: 'Led by Community / Becreative Marketing',
    category: 'sponsorship',
    contact_name: 'Francisco Opazo',
    contact_email: 'francisco@ledby.community',
    contact_phone: '+447712279530',
    website: null,
    notes: 'Organiser of London Community Week (annual, Plexal, Stratford).\n\nHeadline Sponsorship package: 3 full passes + 2 guest passes, newsletter ad, Podcast Season 2 sponsorship, speaking session (20 min, educational), panel participation, Hackathon day participation.\n\nInvoice PL10081: $30,000. Bank details: Barclays, Account 80198218, Sort 20-57-76, IBAN GB40 BUKB 20577680198218.\nDiscount code for additional badges: IGNITETECHVIP.',
  },

  // ── PHOTO & VIDEO ────────────────────────────────────────────────────────

  {
    name: 'Ghelani Studios',
    category: 'photo_video',
    contact_name: 'Amit Patel',
    contact_email: 'amit@ghelanistudios.com',
    contact_phone: null,
    website: null,
    notes: 'Event photographer and videographer. Used at FT Future of AI 2025.\nRegister via FT Live support pass category — Jack Austen to confirm support pass availability.\nConfirm availability for 2026 early.',
  },

  {
    name: 'Snappr',
    category: 'photo_video',
    contact_name: 'Jeremiah Navarro',
    contact_email: 'jeremiah.n@snappr.com',
    contact_phone: '+14159938207',
    website: 'https://www.snappr.com',
    notes: 'On-demand photography and videography marketplace. Used at multiple IgniteTech events.\n\nKey contact:\n• Jeremiah Navarro — Photoshoot Logistics Senior Specialist / Account Manager\n  jeremiah.n@snappr.com\n  US: +1 415 993 8207 ext. 0395 | AU: +61 287 763 121 ext. 0395 | UK: +44 748 134 0888 ext. 0395\n  Office hours: Mon–Fri 9am–6pm PST\n\nUsage history:\n• Feb 11–12, 2026: Fort Lauderdale conference — photographers Michael & Alberto\n• Apr 7, 2026: CEO Summit (Bethesda, MD) — booked Kevin (video) then cancelled; credits held on account\n\nPricing (approx, 3-hour packages):\n• All-Inclusive Photoshoot: ~$424\n• Raw Footage Videoshoot: ~$457\n• Both together: ~$881\n• Recommended minimum for events: 3–4 hours\n\nCancellation / rescheduling policy:\n• First change free if >24hrs before shoot; subsequent changes $20/request\n• Cancellations >24hrs: payment converted to Snappr credits (non-refundable cash)\n• Cancellations <24hrs: no changes possible\n• Credits remain on account indefinitely — NOTE: credits from cancelled Apr 7 CEO Summit booking still on account',
  },

  // ── VENUES ───────────────────────────────────────────────────────────────

  {
    name: 'Evolution London',
    category: 'venue',
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    website: 'https://evolutionlondon.com',
    notes: 'Venue for Customer Engagement Summit 2026.\nAddress: Evolution London, Queenstown Road, Chelsea Bridge, London SW11 4NJ.\nNearest tube: Battersea Power Station (Elizabeth line).\nStand setup from 7:15am on event day. Badges printed on-site at registration desk.',
  },

  {
    name: 'Plexal',
    category: 'venue',
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    website: 'https://plexal.com',
    notes: 'Venue for London Community Week 2026.\nAddress: Plexal, Queen Elizabeth Olympic Park, Stratford, London E20.\nNearest station: Stratford.\nHackathon day: Jul 8, 9am–5pm. Conference: Jul 9–10, 8:15am–5pm. UnConference: Jul 11, 9:30am–4pm.',
  },

  {
    name: 'Convene 22 Bishopsgate',
    category: 'venue',
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    website: 'https://convene.com',
    notes: 'Venue for FT Future of AI 2026.\nAddress: Convene, 22 Bishopsgate, London EC2N 4BQ.\nNearest stations: Bank, Moorgate, Liverpool Street.\nWiFi: Network "Convene Guest", no password.\nDress code: Business casual.\nStand setup: Tue 3 Nov, 7:00pm–9:00pm (2025 schedule — confirm for 2026).',
  },

  // ── AV / TECH ────────────────────────────────────────────────────────────

  {
    name: 'FT AV Services',
    category: 'av_tech',
    contact_name: 'Jack Austen',
    contact_email: 'jack.austen@ft.com',
    contact_phone: null,
    website: null,
    notes: 'In-house AV team for FT Live events at Convene 22 Bishopsgate.\nUsed for TV monitor rental in 2025: 50" monitor on rolling stand with HDMI.\nRequest through Jack Austen — confirm availability and pricing for 2026.\nBooth can also be set up by the FT AV team if team not present for setup — request confirmation photo.',
  },

  // ── TRANSPORT ────────────────────────────────────────────────────────────

  {
    name: 'Heathrow Express / Airport Transfers',
    category: 'transport',
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    website: 'https://heathrowexpress.com',
    notes: 'Airport transfer options for London events.\n\n• CES (Evolution London, SW11): Taxi/minicab from Heathrow — approx £50–70. Battersea Power Station is nearest tube (Elizabeth line from Paddington).\n• LCW (Plexal, Stratford E20): Heathrow Express to Paddington, then Elizabeth line to Stratford. Or direct taxi ~£60.\n• FT (Bishopsgate, EC2N): Heathrow Express to Paddington, then Circle/District to Liverpool Street or Bank. Or taxi ~£50–65.\n\nBook private transfers in advance for multiple people/luggage.',
  },

  // ── PRINT / BRANDING ─────────────────────────────────────────────────────

  {
    name: 'Booth Graphic & Print Supplier (TBC)',
    category: 'print_branding',
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    website: null,
    notes: 'Vendor for booth graphics, backdrops, and branded collateral across events.\n\n• CES: Platinum Expo Stand graphics (print/build/dismantle included in Engage package). Khoros logo on lanyards and coffee cups — artwork submitted to Engage.\n• LCW: 8ft × 8ft branded backdrop for Plexal booth. Aurora AI / IRIS AI one-pagers, case studies, swag.\n• FT: 8ft × 8ft printed backdrop, ship to FT Consolidation Centre ~10 days before event. Khoros/IgniteTech one-pagers and case studies.\n\nAllow 6–8 weeks for production and shipping. Confirm FT Consolidation Centre address via Exhibition Information Pack from Jack Austen.',
  },

  // ── LOGISTICS / COURIERS ─────────────────────────────────────────────────

  {
    name: 'FT Consolidation Centre',
    category: 'logistics',
    contact_name: 'Jack Austen',
    contact_email: 'jack.austen@ft.com',
    contact_phone: null,
    website: null,
    notes: 'Goods receiving address for FT Future of AI booth materials.\nShip booth backdrop and collateral ~10 days before the event.\nFull delivery address is included in the FT Exhibition Information Pack — request from Jack Austen.\nIMPORTANT: Items left on site after breakdown will be discarded. Arrange post-event courier collection.',
  },

]

let added = 0
let skipped = 0

for (const v of vendors) {
  if (exists(v.name)) {
    console.log(`  — skipped (exists): ${v.name}`)
    skipped++
  } else {
    insert.run(v.name, v.category, v.contact_name, v.contact_email, v.contact_phone, v.website, v.notes)
    console.log(`  ✓ added [${v.category}]: ${v.name}`)
    added++
  }
}

// Summary
const total = db.prepare('SELECT COUNT(*) as c FROM vendors').get()
const byCat = db.prepare('SELECT category, COUNT(*) as c FROM vendors GROUP BY category ORDER BY category').all()
console.log(`\n════ DONE: ${added} added, ${skipped} skipped ════`)
console.log(`Total vendors in directory: ${total.c}`)
byCat.forEach(r => console.log(`  ${r.category}: ${r.c}`))
