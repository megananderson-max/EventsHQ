// fix-planning-items.mjs
// Cleans up all planning_items:
//   - Shorten titles to an action phrase
//   - Move operational detail into description
//   - Assign due_date based on event context, embedded date brackets, or urgency

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'events.db'))

// Each entry: { id, title, description, due_date }
// due_date format: 'YYYY-MM-DD' or null
const updates = [

  // ═══════════════════════════════════════════════════════════════════
  // LONDON COMMUNITY WEEK 2026  (Jul 7–11, event_start: 2026-07-07)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 86,
    title: 'Pay invoice PL10081 — £30,000 to Led by Community',
    description: 'PAST DUE as of 8 Apr 2026. Payee: Becreative Marketing / Led by Community. Payment details: Barclays, Account 80198218, Sort 20-57-76, IBAN GB40 BUKB 20577680198218.',
    due_date: '2026-04-18',
  },
  {
    id: 87,
    title: 'Confirm payment received with Francisco Opazo',
    description: 'Contact: francisco@ledby.community / +447712279530. Confirm after invoice PL10081 has been paid.',
    due_date: '2026-04-20',
  },
  {
    id: 88,
    title: 'Confirm sponsorship package details',
    description: 'Confirm full package scope with organiser Francisco Opazo at Led by Community.',
    due_date: '2026-05-01',
  },
  {
    id: 89,
    title: 'Register additional badge purchases if needed',
    description: 'Use discount code IGNITETECHVIP for any additional badge purchases.',
    due_date: '2026-05-15',
  },
  {
    id: 90,
    title: 'Confirm all passes are activated',
    description: 'Verify 3 full passes + 2 guest passes are activated in the attendee system.',
    due_date: '2026-05-15',
  },
  {
    id: 91,
    title: 'Submit Khoros logo for newsletter advertisement',
    description: 'Logo placement in newsletter is included in the sponsorship package.',
    due_date: '2026-05-22',
  },
  {
    id: 92,
    title: 'Confirm Podcast Season 2 sponsorship details',
    description: 'Agree recording schedule and deliverables for the Podcast Season 2 sponsorship included in the package.',
    due_date: '2026-05-22',
  },
  {
    id: 93,
    title: 'Confirm on-stage visibility for Headline Sponsor',
    description: 'Ensure Khoros name is displayed on stage at all times per Headline Sponsorship terms.',
    due_date: '2026-05-15',
  },
  {
    id: 94,
    title: 'Agree speaking session topic with organiser',
    description: '20-minute educational session — no product promotion. Topic must be mutually agreed before it can be publicly announced.',
    due_date: '2026-05-15',
  },
  {
    id: 95,
    title: 'Finalize speaker for session',
    description: 'Confirm who from Khoros/IgniteTech will present. Michael Puhala is one option.',
    due_date: '2026-05-22',
  },
  {
    id: 96,
    title: 'Submit speaker profile to organiser',
    description: 'Send name, headshot, LinkedIn URL, and short bio to Francisco Opazo.',
    due_date: '2026-06-01',
  },
  {
    id: 97,
    title: 'Design speaker slide deck',
    description: 'Build presentation slides for the 20-minute speaking session.',
    due_date: '2026-06-22',
  },
  {
    id: 98,
    title: 'Announce speaking session topic publicly',
    description: 'Publish session details once topic is agreed with the organiser.',
    due_date: '2026-06-08',
  },
  {
    id: 99,
    title: 'Confirm Khoros team participation in Hackathon',
    description: 'Hackathon day: Jul 8, 9am–5pm at Plexal. Confirm who from the team is participating.',
    due_date: '2026-06-01',
  },
  {
    id: 100,
    title: 'Brief team on Hackathon format and goals',
    description: 'Explain Khoros participation goals and Hackathon format to attending team members.',
    due_date: '2026-06-29',
  },
  {
    id: 101,
    title: 'Arrange Khoros API / demo access for Hackathon',
    description: 'Ensure Hackathon participants have the API credentials and demo environment access they need.',
    due_date: '2026-06-29',
  },
  {
    id: 102,
    title: 'Design and order booth display graphics',
    description: 'Branded backdrop and display graphics for the Plexal booth. Allow time for print production and shipping.',
    due_date: '2026-06-01',
  },
  {
    id: 103,
    title: 'Order branded collateral and swag',
    description: 'Aurora AI / IRIS AI one-pagers, case studies, and swag for booth visitors.',
    due_date: '2026-06-01',
  },
  {
    id: 104,
    title: 'Set up badge/lead capture process',
    description: 'Configure badge scanner and lead qualification questions for booth visitors.',
    due_date: '2026-06-22',
  },
  {
    id: 105,
    title: 'Coordinate customer visit schedule',
    description: 'Schedule visits with UK Post Office and any other customers around conference days.',
    due_date: '2026-06-15',
  },
  {
    id: 106,
    title: 'Brief Account Managers and CSMs',
    description: 'Ask AMs and CSMs to introduce potentially interested customers and set up meetings at the event.',
    due_date: '2026-06-22',
  },
  {
    id: 107,
    title: 'Set up lunch with UK Post Office',
    description: 'Schedule Friday 11 Jul, 12pm lunch meeting with Thibault and UK Post Office contact.',
    due_date: '2026-06-22',
  },
  {
    id: 108,
    title: 'Prepare customer meeting agendas',
    description: 'Create talking points and agenda for each scheduled customer visit during the week.',
    due_date: '2026-07-01',
  },
  {
    id: 109,
    title: 'Book flights',
    description: 'Book for 3 people: USA ↔ London. Arrive Sun Jul 5 or Mon Jul 6. Book by May to get summer rates.',
    due_date: '2026-05-01',
  },
  {
    id: 110,
    title: 'Book hotel near Plexal',
    description: '3 rooms × 5 nights, Jul 5–10. Venue: Plexal, Queen Elizabeth Olympic Park, Stratford E20. Suggested: Staybridge Suites Stratford or Premier Inn Stratford.',
    due_date: '2026-05-15',
  },
  {
    id: 111,
    title: 'Arrange airport transfers',
    description: 'Book transfers from Heathrow/Gatwick to Plexal, Olympic Park, Stratford E20.',
    due_date: '2026-06-15',
  },
  {
    id: 112,
    title: 'Confirm final attendee list',
    description: 'Confirm who is attending from the team (Thibault, Michael, Jake + guests).',
    due_date: '2026-06-15',
  },
  {
    id: 113,
    title: 'Confirm panel speaker',
    description: 'Competitive panel includes representatives from Higher Logic, Bettermode, Bevy, and Discourse. Confirm Khoros speaker.',
    due_date: '2026-05-22',
  },
  {
    id: 114,
    title: 'Submit panel participant details',
    description: 'Send name, headshot, LinkedIn URL, and short bio to organiser for the panel discussion.',
    due_date: '2026-05-29',
  },
  {
    id: 115,
    title: 'Brief panel speaker on competitive positioning',
    description: 'Note: panel is an industry discussion — NOT a platform to promote products/services directly. Prepare talking points accordingly.',
    due_date: '2026-06-22',
  },
  {
    id: 116,
    title: 'Final logistics check',
    description: 'Verify hotel, transport, passes, and speaking/panel slots are all confirmed with the organiser.',
    due_date: '2026-06-29',
  },
  {
    id: 117,
    title: 'Brief full attending team',
    description: 'Share event objectives, schedule, booth assignments, and key contact details with everyone attending.',
    due_date: '2026-07-01',
  },
  {
    id: 118,
    title: 'Finalize slide deck and save offline',
    description: 'Ensure speaker slide deck is finalised and accessible offline on the day.',
    due_date: '2026-07-01',
  },
  {
    id: 119,
    title: 'Pack branded materials',
    description: 'Pack booth backdrop, collateral, swag, and badge scanner before departure.',
    due_date: '2026-07-04',
  },
  {
    id: 120,
    title: 'Team arrives London',
    description: 'Check in to hotel near Stratford. Venue is Plexal, Queen Elizabeth Olympic Park.',
    due_date: '2026-07-05',
  },
  {
    id: 121,
    title: 'Hackathon day at Plexal',
    description: '9am–5pm. Khoros team to participate. Ensure API/demo access is ready.',
    due_date: '2026-07-08',
  },
  {
    id: 122,
    title: 'Conference Day 1',
    description: '8:15am–5pm at Plexal. Staff booth, capture leads, attend sessions.',
    due_date: '2026-07-09',
  },
  {
    id: 123,
    title: 'Conference Day 2 — speaking session at 10am',
    description: '8:15am–5pm at Plexal. Speaking session at 10am. Sponsored After-Party 5–7pm.',
    due_date: '2026-07-10',
  },
  {
    id: 124,
    title: 'Confirm After-Party logistics',
    description: 'Sponsored After-Party runs 5–7pm on Jul 10. After-After Party possible 8–10pm — confirm security logistics.',
    due_date: '2026-07-01',
  },
  {
    id: 125,
    title: 'Thibault: lunch with UK Post Office',
    description: '12pm Jul 11. Confirm meeting agenda and location.',
    due_date: '2026-07-11',
  },
  {
    id: 126,
    title: 'UnConference day',
    description: '9:30am–4pm on Jul 11.',
    due_date: '2026-07-11',
  },
  {
    id: 127,
    title: 'Export leads and share with sales team',
    description: 'Export badge scan leads and distribute to sales team with context notes.',
    due_date: '2026-07-12',
  },
  {
    id: 128,
    title: 'Follow up with all customer contacts',
    description: 'Send personalised follow-up messages to all customer visit contacts within 48 hours of the event.',
    due_date: '2026-07-13',
  },
  {
    id: 129,
    title: 'Coordinate Podcast Season 2 deliverables',
    description: 'Work with organiser to complete recording and sponsorship deliverables for Podcast Season 2.',
    due_date: '2026-07-20',
  },
  {
    id: 130,
    title: 'Complete ROI report',
    description: 'Document leads captured, meetings held, pipeline generated, and brand visibility achieved versus the £30,000 / $30,000 spend.',
    due_date: '2026-07-25',
  },
  {
    id: 131,
    title: 'Share learnings for LCW 2027 planning',
    description: 'Write up event recap and key learnings to inform the London Community Week 2027 sponsorship decision.',
    due_date: '2026-07-31',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMER ENGAGEMENT SUMMIT 2026  (Oct 7, event_start: 2026-10-07)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 32,
    title: 'Pay contract invoice to Engage Business Media',
    description: 'Invoice due 15 Sep 2026. Amount: £57,500 (~$72,450 USD). Contact: Angelo Antoline & Megan Anderson at Engage Business Media.',
    due_date: '2026-09-15',
  },
  {
    id: 33,
    title: 'Confirm invoice details with Engage Business Media',
    description: 'Verify payment details with Angelo Antoline and Megan Anderson before processing.',
    due_date: '2026-05-01',
  },
  {
    id: 34,
    title: 'File signed contract',
    description: 'File: Khoros-Engage-Business-Media-Summit-2026. Signed 12 Mar 2026.',
    due_date: '2026-04-25',
  },
  {
    id: 35,
    title: 'Complete Exhibitor Management Platform setup',
    description: 'Complete all required setup tasks in the Exhibitor Management Platform. Angelo has access.',
    due_date: '2026-07-15',
  },
  {
    id: 36,
    title: 'Register all 6 vendor passes',
    description: 'Register all 6 vendor team passes in the Exhibitor Management Platform.',
    due_date: '2026-07-15',
  },
  {
    id: 37,
    title: 'Review confirmed attending companies list',
    description: 'Check the Exhibitor Management Platform for the list of confirmed attending companies for pre-event outreach planning.',
    due_date: '2026-08-15',
  },
  {
    id: 38,
    title: 'Submit power upgrade requirement',
    description: '32A 3-phase power required for booth setup.',
    due_date: '2026-07-01',
  },
  {
    id: 39,
    title: 'Confirm Booth #C7 add-ons',
    description: 'Add-ons to confirm: demo bench, 43" screen, poseur table, 3 stools.',
    due_date: '2026-07-01',
  },
  {
    id: 40,
    title: 'Submit lanyard branding artwork',
    description: 'Submit Khoros logo artwork to Engage for printing on all attendee lanyards.',
    due_date: '2026-07-15',
  },
  {
    id: 41,
    title: 'Submit coffee cart branding artwork',
    description: 'Submit Khoros branded cup artwork for the barista cart next to the booth.',
    due_date: '2026-07-15',
  },
  {
    id: 42,
    title: 'Design and order Platinum Expo Stand graphics',
    description: 'Print, build, and dismantle are included in the Platinum package. Allow 6–8 weeks for production.',
    due_date: '2026-08-01',
  },
  {
    id: 43,
    title: 'Order marketing collateral',
    description: 'Product brochures, Aurora AI & IRIS AI one-pagers, and customer case studies for booth.',
    due_date: '2026-08-15',
  },
  {
    id: 44,
    title: 'Order branded swag',
    description: 'Merchandise and giveaway items for booth visitors.',
    due_date: '2026-08-15',
  },
  {
    id: 45,
    title: 'Pack HDMI-to-Mac connector',
    description: 'Required for screen connections at the booth. Do not forget.',
    due_date: '2026-09-29',
  },
  {
    id: 46,
    title: 'Confirm speaker for Topic Stage presentation',
    description: 'Vellanki confirmed for 20-minute presentation. Verify availability and confirm with Engage.',
    due_date: '2026-06-01',
  },
  {
    id: 47,
    title: 'Submit speaker profile to Engage',
    description: 'Send headshot, LinkedIn URL, and short bio for Vellanki.',
    due_date: '2026-06-15',
  },
  {
    id: 48,
    title: 'Finalize presentation title and synopsis',
    description: 'Working title: "Bring Back the Human Touch in Communities with AI".',
    due_date: '2026-06-15',
  },
  {
    id: 49,
    title: 'Design Vellanki slide deck',
    description: 'Build presentation slides for the 20-minute Topic Stage session.',
    due_date: '2026-09-01',
  },
  {
    id: 50,
    title: 'Save final slide deck to USB drive',
    description: 'IMPORTANT: No remote updates are possible once on site. Final version must be saved to USB before departing.',
    due_date: '2026-10-02',
  },
  {
    id: 51,
    title: 'Add QR code stickers and slide deck inserts',
    description: 'Prepare QR code stickers for booth and venue, and insert QR slide into the presentation.',
    due_date: '2026-09-22',
  },
  {
    id: 52,
    title: 'Register Vellanki for Speaker Lounge check-in',
    description: 'Speaker Lounge is to the right of the registration desk on arrival.',
    due_date: '2026-09-22',
  },
  {
    id: 53,
    title: 'Record presentation practice run',
    description: 'Vellanki to record a practice run and share the raw recording with the team for feedback.',
    due_date: '2026-09-22',
  },
  {
    id: 54,
    title: 'Set up pre-arranged 1-2-1 meetings',
    description: 'Schedule 5 meetings via the Event App messaging tool. Included in the Platinum package.',
    due_date: '2026-09-22',
  },
  {
    id: 55,
    title: 'Download lead capture app on all devices',
    description: 'App event code: CES26. Install on all team devices before travel.',
    due_date: '2026-09-29',
  },
  {
    id: 56,
    title: 'Customize lead qualification questions',
    description: 'Set up qualification questions in the badge scanner app ahead of the event.',
    due_date: '2026-09-29',
  },
  {
    id: 57,
    title: 'Request 150 attendee contact details from Engage',
    description: 'Sponsored attendee contact list (name, company, job title, email) is included in the Platinum package.',
    due_date: '2026-08-01',
  },
  {
    id: 58,
    title: 'Book flights',
    description: '4 people: USA ↔ London Heathrow. Arrive Oct 6, depart Oct 9.',
    due_date: '2026-07-01',
  },
  {
    id: 59,
    title: 'Book hotel',
    description: 'Pestana Chelsea Bridge: 4 rooms × 3 nights, Oct 6–8. 0.5 miles from Evolution London venue.',
    due_date: '2026-07-15',
  },
  {
    id: 60,
    title: 'Arrange airport transfers',
    description: 'Book transfers from Heathrow to Evolution London, Queenstown Road, Chelsea Bridge SW11 4NJ.',
    due_date: '2026-09-22',
  },
  {
    id: 61,
    title: 'Confirm ground transport budget',
    description: 'Allocate Tube/taxi budget for team Oct 6–8.',
    due_date: '2026-09-22',
  },
  {
    id: 62,
    title: 'Set up team Slack channel',
    description: 'Create a dedicated Slack channel for real-time coordination during the event.',
    due_date: '2026-09-22',
  },
  {
    id: 63,
    title: 'Confirm materials delivery to venue',
    description: 'Coordinate final delivery arrangements for all booth materials to Evolution London.',
    due_date: '2026-09-29',
  },
  {
    id: 64,
    title: 'Confirm all staff arrival time',
    description: 'All staff must arrive at Evolution London from 7:15am on Oct 7 for stand setup.',
    due_date: '2026-10-02',
  },
  {
    id: 65,
    title: 'Download tickets and confirm passes',
    description: 'Badges are printed on-site from the registration system. Confirm all 6 team members have their vendor passes registered.',
    due_date: '2026-10-02',
  },
  {
    id: 66,
    title: 'Brief booth staff on lead capture',
    description: 'Walk all staff through the lead capture process, badge scanner app, and qualification questions.',
    due_date: '2026-10-05',
  },
  {
    id: 67,
    title: 'Final check of Exhibitor Management Platform',
    description: 'Log in and complete any outstanding tasks before the event.',
    due_date: '2026-10-05',
  },
  {
    id: 68,
    title: 'Team arrives London',
    description: 'Check in to Pestana Chelsea Bridge. Team dinner / evening briefing on event objectives and talking points.',
    due_date: '2026-10-06',
  },
  {
    id: 69,
    title: 'Team dinner and evening briefing',
    description: 'Review event objectives, booth assignments, and key talking points over dinner.',
    due_date: '2026-10-06',
  },
  {
    id: 70,
    title: 'Event day — stand setup from 7:15am',
    description: 'Arrive Evolution London from 7:15am. Check Booth #C7: demo bench, 43" screen, poseur table, 3 stools. Verify coffee cart is positioned correctly next to booth.',
    due_date: '2026-10-07',
  },
  {
    id: 71,
    title: 'Event day — print badges on arrival',
    description: 'Badges printed on-site at the registration desk.',
    due_date: '2026-10-07',
  },
  {
    id: 72,
    title: 'Event day — place QR stickers around venue',
    description: 'Place QR code stickers at booth and around the event venue.',
    due_date: '2026-10-07',
  },
  {
    id: 73,
    title: 'Event day — Vellanki Speaker Lounge check-in',
    description: 'Check in at Speaker Lounge (right of registration desk) 30 minutes before presentation.',
    due_date: '2026-10-07',
  },
  {
    id: 74,
    title: 'Event day — badge scanning throughout day',
    description: 'Scan all booth visitor badges using the Lead Capture app throughout the day.',
    due_date: '2026-10-07',
  },
  {
    id: 75,
    title: 'Event day — confirm 1-2-1 meetings',
    description: 'Verify all 5 pre-arranged meetings are scheduled and confirmed in the Event App.',
    due_date: '2026-10-07',
  },
  {
    id: 76,
    title: 'Event day — networking party',
    description: 'Summit Networking Party: free drinks and comedian, until 7pm. Team to stay for relationship-building.',
    due_date: '2026-10-07',
  },
  {
    id: 77,
    title: 'Export leads from badge scanner',
    description: 'Export all scanned leads from the Lead Capture app within 24 hours. Cross-reference with 150 sponsored attendee contacts from Engage.',
    due_date: '2026-10-08',
  },
  {
    id: 78,
    title: 'Distribute leads to sales team',
    description: 'Share leads with context notes from conversations. Includes both badge scan leads and the 150 sponsored contact list.',
    due_date: '2026-10-09',
  },
  {
    id: 79,
    title: 'Send personalised follow-up emails',
    description: 'Send follow-up to all booth visitors within 48 hours of the event.',
    due_date: '2026-10-09',
  },
  {
    id: 80,
    title: 'Share Vellanki presentation recording',
    description: 'Post session recording to Khoros content channels and share internally with team.',
    due_date: '2026-10-14',
  },
  {
    id: 81,
    title: 'Complete ROI report',
    description: 'Document leads captured, meetings held, and pipeline generated versus the £57,500 / $72,450 spend.',
    due_date: '2026-10-21',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FT FUTURE OF AI 2026  (Nov 4, event_start: 2026-11-04)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 136,
    title: 'Contact Jack Austen — confirm 2026 dates and get on sponsor list',
    description: 'Contact: jack.austen@ft.com. Confirm event dates and secure early sponsor position before prime slots fill.',
    due_date: '2026-04-20',
  },
  {
    id: 137,
    title: 'Confirm sponsorship package tier',
    description: 'Options: Lead $79K / Premium $105K / Strategic $135K. Prime slots fill early — decision needed promptly.',
    due_date: '2026-05-01',
  },
  {
    id: 138,
    title: 'Confirm budget approval',
    description: '2025 total spend was $86,000 excluding tax. Confirm 2026 budget before committing to a package.',
    due_date: '2026-05-01',
  },
  {
    id: 139,
    title: 'Secure speaking slot for Eric Vaughan',
    description: 'Build on his 2025 Keynote. Confirm format: fireside chat, panel, or keynote interview with FT editorial team.',
    due_date: '2026-05-01',
  },
  {
    id: 140,
    title: 'Request 2026 sponsorship brochure from Jack Austen',
    description: 'Get the updated package details and 2026 pricing from jack.austen@ft.com.',
    due_date: '2026-04-25',
  },
  {
    id: 141,
    title: 'Review booth options and confirm size and location',
    description: 'Earlier commitment secures better position. In 2025 Khoros had booth #7.',
    due_date: '2026-05-15',
  },
  {
    id: 142,
    title: 'Confirm add-on decisions',
    description: 'Lanyard sponsorship: $10K (confirmed in 2025). Coffee Station: $29K (new option for 2026). Decide which to include.',
    due_date: '2026-05-15',
  },
  {
    id: 143,
    title: 'Confirm brand placement rights',
    description: 'Verify Khoros/IgniteTech name appears across: website, signage, programme, emails, app, stage signage, and digital network.',
    due_date: '2026-06-01',
  },
  {
    id: 144,
    title: 'Submit Wishlist Service target list to FT Live',
    description: 'Submit target companies and job titles to drive relevant attendees. Must be submitted ~10 days before the event.',
    due_date: '2026-10-25',
  },
  {
    id: 145,
    title: 'Request VIP Speakers Dinner invitation',
    description: 'Included in Lead+ packages. Confirm Eric Vaughan and team are on the invitation list.',
    due_date: '2026-08-01',
  },
  {
    id: 146,
    title: 'Brief Eric Vaughan on 2026 speaking format',
    description: 'Explain FT editorial process and the agreed format (fireside, panel, or keynote). Reference 2025 session for context.',
    due_date: '2026-08-01',
  },
  {
    id: 147,
    title: 'Coordinate with FT Content team',
    description: 'Contacts: Yasmin Alsadoon (yasmin.alsadoon@ft.com) and Tierney Rose O\'Kelly (tierneyrose.okelly@ft.com).',
    due_date: '2026-07-01',
  },
  {
    id: 148,
    title: 'Develop 2026 keynote narrative for Eric Vaughan',
    description: 'Fresh angles: Khoros acquisition (May 2025), Adminio AI launch (Q1 2026), and Agentic AI themes. Avoid repeating 2025 content.',
    due_date: '2026-09-01',
  },
  {
    id: 149,
    title: 'Review 2025 audience Q&A for speaker prep',
    description: 'Key themes from 2025: training ROI, empathy in automation, knowledge guardians, energy demand for AI. Use to anticipate 2026 questions.',
    due_date: '2026-09-15',
  },
  {
    id: 150,
    title: 'Confirm Eric Vaughan day-of logistics',
    description: 'Arrive 40 minutes before session. FT team brings speaker to Green Room 20 minutes before for lapel mic fitting. Check spam for QR code access email from notify@22bishopsgate.com (sent 24 hrs before).',
    due_date: '2026-11-01',
  },
  {
    id: 151,
    title: 'Check spam for QR code access email',
    description: 'QR code access email sent from notify@22bishopsgate.com approximately 24 hours before the event. Check spam folder.',
    due_date: '2026-11-03',
  },
  {
    id: 152,
    title: 'Confirm 2026 attendee list',
    description: '2025 attendees: Eric Vaughan, Regina Nogueira, Jozef Kacala, Dimitry Ledin, David Harpur (Day 1 only). Confirm 2026 roster.',
    due_date: '2026-09-15',
  },
  {
    id: 153,
    title: 'Assign and communicate passes to attendees',
    description: 'Lead package includes 6 in-person passes + 15 digital passes. Assign and send registration links to each confirmed attendee.',
    due_date: '2026-09-22',
  },
  {
    id: 154,
    title: 'Register photographer/videographer',
    description: 'Register via FT support pass. In 2025: Ghelani Studios, Amit Patel (amit@ghelanistudios.com).',
    due_date: '2026-09-01',
  },
  {
    id: 155,
    title: 'Confirm TV monitor rental',
    description: '50" monitor on rolling stand with HDMI. Rented from FT AV in 2025 — confirm same option for 2026.',
    due_date: '2026-09-01',
  },
  {
    id: 156,
    title: 'Decide product demos for booth',
    description: '2025 setup: MyPersonas for visual booth display, Eloquens AI for table demos. Note: voice-mode demos are difficult on a noisy show floor — prepare attendees to type responses.',
    due_date: '2026-09-15',
  },
  {
    id: 157,
    title: 'Order booth backdrop and ship to Consolidation Centre',
    description: '8ft × 8ft printed backdrop. Ship ~10 days before event to the FT Consolidation Centre. Booth can also be set up by FT AV team — request photo from Jack Austen if team not present for setup.',
    due_date: '2026-10-22',
  },
  {
    id: 158,
    title: 'Confirm stand setup evening',
    description: 'Stand setup evening: Tue 3 Nov, 7:00pm–9:00pm (based on 2025 schedule).',
    due_date: '2026-10-20',
  },
  {
    id: 159,
    title: 'Arrange post-event courier from Consolidation Centre',
    description: 'Book courier/collection for post-event breakdown. Items left on site will be discarded.',
    due_date: '2026-10-28',
  },
  {
    id: 160,
    title: 'Order branded marketing collateral',
    description: 'Khoros/IgniteTech one-pagers, case studies, and demo materials for the booth.',
    due_date: '2026-09-22',
  },
  {
    id: 161,
    title: 'Download FT social media marketing kit',
    description: 'Download social tiles and suggested copy from the FT marketing kit. Use hashtag #FTFutureofAI and link: https://ai.live.ft.com/home',
    due_date: '2026-10-15',
  },
  {
    id: 162,
    title: 'Plan press release',
    description: '2025 press release was published successfully. Plan a 2026 version if applicable.',
    due_date: '2026-10-01',
  },
  {
    id: 163,
    title: 'Connect Natasha & Vinicius re: MyPersonas and Eloquens',
    description: 'Jack Austen to facilitate introduction with FT re: MyPersonas and Eloquens AI.',
    due_date: '2026-06-01',
  },
  {
    id: 164,
    title: 'Assign FT Live Networking App sponsor admin',
    description: 'One team member to manage the sponsor page in the FT Live Networking App, including 1:1 meeting scheduling.',
    due_date: '2026-09-01',
  },
  {
    id: 165,
    title: 'Prepare sponsor page for FT Live Networking App',
    description: 'Build out the digital sponsor page that attendees can browse in the app.',
    due_date: '2026-10-01',
  },
  {
    id: 166,
    title: 'Plan and schedule customer 1:1 meetings',
    description: 'Use the FT Live Networking App to schedule customer/prospect meetings before the event.',
    due_date: '2026-10-15',
  },
  {
    id: 167,
    title: 'Book flights',
    description: '4–6 people: USA ↔ London. Arrive 3 Nov (stand setup eve). Venue: Convene 22 Bishopsgate EC2N 4BQ. Nearest stations: Bank, Moorgate, Liverpool Street.',
    due_date: '2026-07-01',
  },
  {
    id: 168,
    title: 'Book hotel',
    description: 'Options within 10 min walk of venue: Andaz Liverpool Street (Hyatt), Clayton London Wall, Pan Pacific.',
    due_date: '2026-07-15',
  },
  {
    id: 169,
    title: 'Internal prep call with all attendees',
    description: 'Run through booth assignments, talking points, demo plan, and lead capture process.',
    due_date: '2026-10-28',
  },
  {
    id: 170,
    title: 'Final team briefing before event',
    description: 'Brief full team on booth assignments, talking points, and lead capture process. Dress code: business casual. WiFi: "Convene Guest" (no password).',
    due_date: '2026-11-01',
  },
  {
    id: 171,
    title: 'Confirm Eloquens AI demo is ready',
    description: 'Ensure Eloquens AI demo is set up and Ella Quinn email account is ready for the expected influx of interactions.',
    due_date: '2026-11-01',
  },
  {
    id: 172,
    title: 'Confirm all passes are registered',
    description: 'Verify all in-person and digital passes are activated and attendees have received registration links.',
    due_date: '2026-11-01',
  },
  {
    id: 173,
    title: 'Request Exhibition Information Pack from FT',
    description: 'Pack contains the full Consolidation Centre delivery address and other logistics details.',
    due_date: '2026-08-01',
  },
  {
    id: 174,
    title: 'Eric Vaughan: collect speaker badge on arrival',
    description: 'Speaker badge is separate from general sponsor badges. Collect at venue on arrival.',
    due_date: '2026-11-04',
  },
  {
    id: 175,
    title: 'Download QR lead scan report',
    description: 'FT provides a full PDF breakdown of all QR scans after the event.',
    due_date: '2026-11-05',
  },
  {
    id: 176,
    title: 'Collect delegate opt-in data from FT',
    description: 'Request post-event data: name, company, job title, email for all opted-in delegates.',
    due_date: '2026-11-06',
  },
  {
    id: 177,
    title: 'Distribute leads to sales team',
    description: 'Share leads with context notes from booth conversations. Combine QR scan report with delegate opt-in data.',
    due_date: '2026-11-07',
  },
  {
    id: 178,
    title: 'Request session footage from FT',
    description: 'FT provides Eric Vaughan\'s session recording approximately one week after the event.',
    due_date: '2026-11-11',
  },
  {
    id: 179,
    title: 'Collect event photos',
    description: 'Obtain photos from Ghelani Studios and the FT post-event photo report.',
    due_date: '2026-11-12',
  },
  {
    id: 180,
    title: 'Complete ROI report',
    description: 'Document leads captured, meetings held, pipeline generated, and media coverage achieved versus total spend.',
    due_date: '2026-11-18',
  },
  {
    id: 181,
    title: 'Follow up with Jack Austen on 2027 sponsorship',
    description: 'Discuss early-bird options and preferred package for FT Future of AI 2027.',
    due_date: '2026-11-20',
  },
]

const stmt = db.prepare('UPDATE planning_items SET title = ?, description = ?, due_date = ? WHERE id = ?')

let updated = 0
for (const u of updates) {
  const r = stmt.run(u.title, u.description, u.due_date, u.id)
  if (r.changes) updated++
  else console.log('  ⚠ NOT FOUND id:', u.id)
}

// Verify
const sample = db.prepare('SELECT id, title, due_date FROM planning_items WHERE id IN (86,32,136) ORDER BY id').all()
console.log('\nSample verification:')
sample.forEach(s => console.log(`  [${s.id}] ${s.due_date} | ${s.title}`))

console.log(`\n✓ Updated ${updated} planning items`)
