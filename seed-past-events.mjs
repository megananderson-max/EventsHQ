import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'events.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const insertEvent = db.prepare(`
  INSERT INTO events (name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertVendor = db.prepare(`
  INSERT OR IGNORE INTO vendors (name, category, contact_name, contact_email, contact_phone, website, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const getVendorByName = db.prepare(`SELECT id FROM vendors WHERE name = ?`)

const insertEV = db.prepare(`
  INSERT INTO event_vendors (event_id, vendor_id, status, contract_value, notes)
  VALUES (?, ?, ?, ?, ?)
`)

const insertBudget = db.prepare(`
  INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, invoice_number, status, notes, is_estimate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Helper: for completed events, planned = actual (no variance; budget reflects real spend)
const paid = (eventId, category, description, vendorId, amount, invoiceNumber, notes) =>
  insertBudget.run(eventId, category, description, vendorId, amount, amount, invoiceNumber, 'paid', notes, 0)

const run = db.transaction(() => {

  // ─── Clean up existing records for these 3 events ────────────────────────────
  const eventNames = ['Gen AI Expo 2026', 'Pepcom Digital Experience! 2026', 'ShowStoppers @ CES 2026']
  const placeholders = eventNames.map(() => '?').join(',')
  const existingIds = db.prepare(`SELECT id FROM events WHERE name IN (${placeholders})`).all(...eventNames).map(r => r.id)
  if (existingIds.length > 0) {
    const idPh = existingIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM budget_items WHERE event_id IN (${idPh})`).run(...existingIds)
    db.prepare(`DELETE FROM event_vendors WHERE event_id IN (${idPh})`).run(...existingIds)
    db.prepare(`DELETE FROM events WHERE id IN (${idPh})`).run(...existingIds)
  }

  // ─── Vendors ──────────────────────────────────────────────────────────────────
  insertVendor.run('Technology Marketing Corporation (TMC)', 'venue',      'Michael Genaro',            'mgenaro@tmcnet.com',                       null, 'https://tmcnet.com',        'Organizer of ITEXPO / TECHSUPERSHOW / GenAI Expo. Invoices via Shelton, CT.')
  insertVendor.run('Freeman',                                'av_tech',    'Freeman Exhibitor Services',  'exhibitorservices@freeman.com',            null, 'https://freeman.com',       'Official trade show logistics vendor — flooring, labor, material handling, cleaning.')
  insertVendor.run('Broward County Convention Center (BCCC)','venue',      null,                         null,                                       null, null,                        'F&B catering and WiFi exhibitor services at ITEXPO / GenAI Expo 2026.')
  insertVendor.run('Exhibit Supply',                         'production', 'Exhibit Supply',              'info@exhibitsupply.com',                  null, 'https://exhibitsupply.com', 'Booth display and fabric graphics rental.')
  insertVendor.run('Edlen Electrical Exhibition Services',   'production', null,                         'exhibitorservices-ftlauderdale@edlen.com',  null, 'https://edlen.com',         'Electrical / utilities services at Broward County Convention Center.')
  insertVendor.run('Pepcom Inc.',                            'venue',      'Diane Brauer',                null,                                       null, 'https://pepcom.com',        'Organizer of Digital Experience! @ CES. Tax ID 65-0820359.')
  insertVendor.run('ShowStoppers (LL&J LLC)',                'venue',      'Lauren Merel',                'lauren@showstoppers.com',                  null, 'https://showstoppers.com',  'Organizer of ShowStoppers @ CES. 3-hour invitation-only media reception at Bellagio.')
  insertVendor.run('Veloxity',                               'technology', null,                          null,                                       null, null,                        'Kiosk rental vendor. Invoice 29388-1201 covered Pepcom & ShowStoppers @ CES 2026.')
  insertVendor.run('CEO Magazine',                           'media',      null,                          null,                                       null, null,                        'Editorial coverage / media placement at CES 2026 events.')

  const tmcId    = getVendorByName.get('Technology Marketing Corporation (TMC)').id
  const freemanId = getVendorByName.get('Freeman').id
  const bcccId   = getVendorByName.get('Broward County Convention Center (BCCC)').id
  const esId     = getVendorByName.get('Exhibit Supply').id
  const edlenId  = getVendorByName.get('Edlen Electrical Exhibition Services').id
  const pepcomId = getVendorByName.get('Pepcom Inc.').id
  const ssId     = getVendorByName.get('ShowStoppers (LL&J LLC)').id
  const veloxId  = getVendorByName.get('Veloxity').id
  const ceoMagId = getVendorByName.get('CEO Magazine').id

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. Gen AI Expo 2026  (Feb 10–12, Fort Lauderdale)
  //    All amounts are actuals from signed invoices / receipts.
  //    budget_total = sum of all actual spend.
  // ═══════════════════════════════════════════════════════════════════════════════

  // Actual amounts from invoices
  const genAiActuals = {
    sponsorship:   30000,
    barista:       8592.99,
    leadCapture:   600,
    giveaways:     483.40,
    customShirts:  792.44,
    exhibitSupply: 1270,
    freemanFloor:  4762.38,
    freemanLabor:  3689.90,
    freemanExtra:  339.19,
    electrical:    883.34,
    wifi:          2755.25,
    photographer:  2262.84,
    kiosks:        4320,
    headphones:    265.50,
  }
  const genAiTotal = Object.values(genAiActuals).reduce((s, v) => s + v, 0)

  const genAi = insertEvent.run(
    'Gen AI Expo 2026',
    'trade_show',
    'complete',
    '2026-02-10',
    '2026-02-12',
    'Fort Lauderdale, FL',
    'Broward County Convention Center',
    2000,
    genAiTotal,
    'IgniteTech exhibited as Exclusive Presenting Sponsor of the Generative AI Expo 2026, co-located with ITEXPO #TECHSUPERSHOW. The team showcased Eloquens AI and MyPersonas® AI solutions at booth #834 (20×20). Eric Vaughan participated in a panel "The Human Side of AI: Driving Enterprise Adoption and Upskilling for the Copilot Era" on February 11, 2026. Organized by Technology Marketing Corporation (TMC).'
  )
  const genAiId = genAi.lastInsertRowid

  insertEV.run(genAiId, tmcId,     'completed', genAiActuals.sponsorship,                                             'Exclusive Presenting Sponsor of GenAI Expo 2026 + Platinum Sponsor of MSP Expo 2026. Invoice #39195.')
  insertEV.run(genAiId, freemanId, 'completed', genAiActuals.freemanFloor + genAiActuals.freemanLabor + genAiActuals.freemanExtra, 'Booth logistics: carpet/flooring, cleaning, decor, labor, material handling. Invoices #9000248634, #9000282642, #9000304216.')
  insertEV.run(genAiId, bcccId,    'completed', genAiActuals.barista + genAiActuals.wifi,                             'F&B / barista package (Invoice 0061700) + Wi-Fi Package 2Mbps/10 Users.')
  insertEV.run(genAiId, esId,      'completed', genAiActuals.exhibitSupply,                                           'Booth fabric graphics display rental. Invoice ACC-PAY-2026-00030.')
  insertEV.run(genAiId, edlenId,   'completed', genAiActuals.electrical,                                              'Electrical / utilities services at Broward County Convention Center. Invoice MI2602-001788901.')

  paid(genAiId, 'sponsorship', 'TMC — Exclusive Presenting Sponsor GenAI Expo 2026 + Platinum Sponsor MSP Expo (Invoice #39195)',
    tmcId,    genAiActuals.sponsorship,   '39195',               '20×20 booth, lanyard sponsor, Tuesday lunch keynote, badge insert, logo, show app sponsor, chair drop, solutions showcase presentation, panel speaking opportunity.')

  paid(genAiId, 'catering',    'BCCC — Barista Package for Booth #834 (Invoice 0061700)',
    bcccId,   genAiActuals.barista,       '0061700',             'Day 1: seltzers, wine and drinks. Day 2: coffee. Paid via Visa *4911.')

  paid(genAiId, 'production',  'Exhibit Supply — Booth Fabric Graphics Display Rental (Invoice ACC-PAY-2026-00030)',
    esId,     genAiActuals.exhibitSupply, 'ACC-PAY-2026-00030',  'Booth fabric/graphic display hardware rental for GenAI Expo.')

  paid(genAiId, 'production',  'Freeman — Booth Carpet, Padding & Decor Services (Invoice #9000248634)',
    freemanId, genAiActuals.freemanFloor, '9000248634',          'Flooring $4,472.60, Cleaning $234.14, Decor $55.64. Booth #834, Broward County Convention Center.')

  paid(genAiId, 'production',  'Freeman — Labor & Material Handling (Invoice #9000282642)',
    freemanId, genAiActuals.freemanLabor, '9000282642',          'Labor & Equipment $2,204.74, Material Handling & Shipping $1,485.16.')

  paid(genAiId, 'production',  'Freeman — Additional Post-Show Labor (Invoice #9000304216)',
    freemanId, genAiActuals.freemanExtra, '9000304216',          'Post-show additional labor charge.')

  paid(genAiId, 'production',  'Edlen — Electrical Services (Invoice MI2602-001788901)',
    edlenId,  genAiActuals.electrical,    'MI2602-001788901',    'Electrical / utilities at Broward County Convention Center booth #834.')

  paid(genAiId, 'technology',  'BCCC Exhibitor Store — Wi-Fi Package 2Mbps / 10 Users, Booth #834',
    bcccId,   genAiActuals.wifi,          null,                  'Wi-Fi Package for booth #834 during show days Feb 10–12.')

  paid(genAiId, 'technology',  'Lead Capture — Badge Kit for Third-Party Lead Tool',
    null,     genAiActuals.leadCapture,   null,                  '3-pack license ($599.00) + additional license. Badge kit to capture leads at booth using third-party tool.')

  paid(genAiId, 'technology',  'Kiosk Rental — Both Days Including Delivery',
    null,     genAiActuals.kiosks,        null,                  'Kiosk rental for both show days (Feb 10–11) including delivery and setup.')

  paid(genAiId, 'media',       'Photographer / Videographer',
    null,     genAiActuals.photographer,  null,                  'Photo and video coverage of IgniteTech booth and event activities at GenAI Expo 2026.')

  paid(genAiId, 'branding',    'Giveaways — Hourglasses & Mirrors',
    null,     genAiActuals.giveaways,     null,                  'Hourglasses sourced from storage; mirrors ordered. Only distributed to attendees who took a product demo.')

  paid(genAiId, 'branding',    'Custom Shirts / Branded Attire for Booth Staff',
    null,     genAiActuals.customShirts,  null,                  'Custom branded shirts for IgniteTech booth staff at GenAI Expo 2026.')

  paid(genAiId, 'other',       'Disposable Headphones for Kiosk Demos',
    null,     genAiActuals.headphones,    null,                  '25 units, sanitized as required for kiosk demo stations.')

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. Pepcom Digital Experience! 2026  (Jan 5, 2026, Las Vegas)
  //    All amounts are actuals. budget_total = sum of actual spend.
  // ═══════════════════════════════════════════════════════════════════════════════

  const pepcomActuals = {
    sponsorship:  14000,
    wifi:         1200,
    kiosk:        1310,
    photographer: 543.91,
    ceoMag:       500,
  }
  const pepcomTotal = Object.values(pepcomActuals).reduce((s, v) => s + v, 0)

  const pepcomEvt = insertEvent.run(
    'Pepcom Digital Experience! 2026',
    'trade_show',
    'complete',
    '2026-01-05',
    '2026-01-05',
    'Las Vegas, NV',
    'Paris Hotel Las Vegas',
    500,
    pepcomTotal,
    'IgniteTech exhibited as a Premier Exhibitor at Pepcom\'s Digital Experience! 2026, co-located with CES at Paris Hotel, Las Vegas. The team demonstrated MyPersonas® and Eloquens AI to hundreds of international technology journalists and media. Organized by Pepcom Inc. Invoice 26-CES1104.'
  )
  const pepcomId2 = pepcomEvt.lastInsertRowid

  insertEV.run(pepcomId2, pepcomId,  'completed', pepcomActuals.sponsorship + pepcomActuals.wifi, 'Premier Exhibitor package (Invoice 26-CES1104: $14,000) + WiFi/Connectivity (Invoice DE-AV: $1,200).')
  insertEV.run(pepcomId2, veloxId,   'completed', pepcomActuals.kiosk,                           'Kiosk rental — half share of Invoice 29388-1201 ($2,620 total split with ShowStoppers @ CES 2026).')
  insertEV.run(pepcomId2, ceoMagId,  'completed', pepcomActuals.ceoMag,                          'CEO Magazine editorial coverage at CES 2026.')

  paid(pepcomId2, 'sponsorship', 'Pepcom — Premier Exhibitor Fee, Digital Experience! @ CES (Invoice 26-CES1104)',
    pepcomId, pepcomActuals.sponsorship,  '26-CES1104', 'Premier Exhibitor level at Paris Hotel, Las Vegas, January 5, 2026.')

  paid(pepcomId2, 'technology',  'Pepcom — WiFi / Connectivity for Demos (Invoice DE-AV)',
    pepcomId, pepcomActuals.wifi,         'DE-AV',      'Two or more WiFi connections for demo at booth. Paid via Visa *0665.')

  paid(pepcomId2, 'technology',  'Veloxity — Kiosk Rental, Half Share (Invoice 29388-1201)',
    veloxId,  pepcomActuals.kiosk,        '29388-1201', '$1,310 = half of $2,620 total. Invoice 29388-1201 covers both Pepcom and ShowStoppers @ CES 2026 kiosk rental.')

  paid(pepcomId2, 'media',       'Photographer / Videographer',
    null,     pepcomActuals.photographer, null,         'Photography and video coverage at Pepcom Digital Experience! @ CES 2026.')

  paid(pepcomId2, 'media',       'CEO Magazine — Editorial Coverage at CES',
    ceoMagId, pepcomActuals.ceoMag,       null,         'Editorial media placement / coverage during CES 2026.')

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. ShowStoppers @ CES 2026  (Jan 6, 2026, Las Vegas)
  //    All amounts are actuals. budget_total = sum of actual spend.
  // ═══════════════════════════════════════════════════════════════════════════════

  const ssActuals = {
    sponsorship:  20000,
    wifi:         950,
    kiosk:        1310,
    photographer: 543.91,
    ceoMag:       500,
  }
  const ssTotal = Object.values(ssActuals).reduce((s, v) => s + v, 0)

  const ssEvt = insertEvent.run(
    'ShowStoppers @ CES 2026',
    'trade_show',
    'complete',
    '2026-01-06',
    '2026-01-06',
    'Las Vegas, NV',
    'Bellagio Hotel Las Vegas',
    900,
    ssTotal,
    'IgniteTech exhibited at ShowStoppers @ CES 2026, a 3-hour invitation-only media reception (5pm preview, 6–9pm main event) at the Bellagio Hotel, Las Vegas. The event welcomed 900+ international journalists from 47 countries. IgniteTech showcased MyPersonas® AI and Eloquens AI to top-tier global media. Organized by LL&J LLC dba ShowStoppers. Invoice Ignite E-11192025-1. Paid via wire transfer Dec 4, 2025.'
  )
  const ssId2 = ssEvt.lastInsertRowid

  insertEV.run(ssId2, ssId,     'completed', ssActuals.sponsorship,  'Exhibitor agreement signed Nov 2025. Invoice Ignite E-11192025-1. Paid via wire transfer Dec 4, 2025.')
  insertEV.run(ssId2, veloxId,  'completed', ssActuals.kiosk,        'Kiosk rental — half share of Invoice 29388-1201 ($2,620 total split with Pepcom Digital Experience! 2026).')
  insertEV.run(ssId2, ceoMagId, 'completed', ssActuals.ceoMag,       'CEO Magazine editorial coverage at CES 2026.')

  paid(ssId2, 'sponsorship', 'ShowStoppers — Exhibitor Fee @ CES 2026 (Invoice Ignite E-11192025-1)',
    ssId,     ssActuals.sponsorship,  'E-11192025-1', '3-hour invitation-only media reception at Bellagio Hotel. 900+ journalists from 47 countries. Wire transfer paid Dec 4, 2025.')

  paid(ssId2, 'technology',  'ShowStoppers / Bellagio — WiFi / Connectivity for Demos',
    null,     ssActuals.wifi,         null,           'WiFi connectivity for demo setup at Bellagio Hotel during ShowStoppers media reception.')

  paid(ssId2, 'technology',  'Veloxity — Kiosk Rental, Half Share (Invoice 29388-1201)',
    veloxId,  ssActuals.kiosk,        '29388-1201',   '$1,310 = half of $2,620 total. Invoice 29388-1201 covers both ShowStoppers @ CES 2026 and Pepcom Digital Experience! 2026 kiosk rental.')

  paid(ssId2, 'media',       'Photographer / Videographer',
    null,     ssActuals.photographer, null,           'Photography and video coverage at ShowStoppers @ CES 2026, Bellagio Hotel.')

  paid(ssId2, 'media',       'CEO Magazine — Editorial Coverage at CES',
    ceoMagId, ssActuals.ceoMag,       null,           'Editorial media placement / coverage during CES 2026.')

  console.log(`✓ Gen AI Expo 2026            → event ID ${genAiId}  | actual total: $${genAiTotal.toFixed(2)}`)
  console.log(`✓ Pepcom Digital Exp 2026     → event ID ${pepcomId2} | actual total: $${pepcomTotal.toFixed(2)}`)
  console.log(`✓ ShowStoppers @ CES 2026     → event ID ${ssId2}  | actual total: $${ssTotal.toFixed(2)}`)
})

run()
db.close()
console.log('\nAll 3 past events seeded with actuals only — budget = 100% of actual spend.')
