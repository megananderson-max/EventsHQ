import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'events.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planning',
      start_date TEXT,
      end_date TEXT,
      location TEXT,
      venue TEXT,
      expected_attendees INTEGER,
      budget_total REAL DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      website TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      status TEXT NOT NULL DEFAULT 'rfp_sent',
      contract_value REAL,
      contract_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      vendor_id INTEGER REFERENCES vendors(id),
      planned_amount REAL NOT NULL DEFAULT 0,
      actual_amount REAL DEFAULT 0,
      po_number TEXT,
      invoice_number TEXT,
      payment_due_date TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      assigned_to TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS run_of_show (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      event_day INTEGER DEFAULT 1,
      start_time TEXT NOT NULL,
      end_time TEXT,
      activity TEXT NOT NULL,
      owner TEXT,
      location TEXT,
      notes TEXT,
      status TEXT DEFAULT 'planned',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      arrival_date TEXT,
      departure_date TEXT,
      hotel TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planning_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Opportunities cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      start_date TEXT,
      end_date TEXT,
      location TEXT,
      venue TEXT,
      expected_attendees INTEGER,
      budget_estimate_low REAL,
      budget_estimate_high REAL,
      strategic_fit TEXT,
      audience_match TEXT,
      recommendation TEXT,
      description TEXT,
      status TEXT DEFAULT 'pipeline',
      added_to_events INTEGER DEFAULT 0,
      event_id INTEGER REFERENCES events(id),
      generated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Team members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      is_me INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
  try { db.exec(`ALTER TABLE team_members ADD COLUMN email TEXT`) } catch {}

  // Migrate: add review_notes to events (carried over from opportunity)
  try { db.exec(`ALTER TABLE events ADD COLUMN review_notes TEXT`) } catch {}
  // Migrate: track whether post-event info has been uploaded
  try { db.exec(`ALTER TABLE events ADD COLUMN post_event_completed INTEGER DEFAULT 0`) } catch {}
  // Migrate: add payment_due_date if missing
  try { db.exec(`ALTER TABLE budget_items ADD COLUMN payment_due_date TEXT`) } catch {}
  // Migrate: add is_estimate flag (1 = estimated cost, 0 = contracted/actual price)
  try { db.exec(`ALTER TABLE budget_items ADD COLUMN is_estimate INTEGER DEFAULT 0`) } catch {}
  // Migrate: extend opportunities table with richer fields
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN organizer TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN website TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN past_sponsors TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN priority_score INTEGER`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN speaking_opportunity TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN networking_value TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN focus_area TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN region TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN why_now TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN notes TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN relevant_for TEXT DEFAULT 'khoros'`) } catch {}
  // Migrate: add DNA notes and competitor flag to opportunities
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN dna_notes TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN is_competitor_event INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN competitor_name TEXT`) } catch {}
  // Migrate: add company_profiles JSON column to app_settings
  try { db.exec("ALTER TABLE app_settings ADD COLUMN company_profiles TEXT") } catch {}
  // Migrate: add execution_notes to events for event-day lessons learned
  try { db.exec(`ALTER TABLE events ADD COLUMN execution_notes TEXT`) } catch {}
  // Migrate: audience research enrichment fields on opportunities
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN audience_research_notes TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN event_health TEXT`) } catch {}
  // Migrate: auto-flag fields — set by AI during scanning
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN auto_flagged INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN flag_reason TEXT`) } catch {}

  // Workflow documentation — AI-generated, cached in DB
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_docs (
      id INTEGER PRIMARY KEY,
      content TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      trigger TEXT DEFAULT 'manual'
    )
  `)

  // Per-user Gmail OAuth tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      email TEXT PRIMARY KEY,
      name TEXT,
      image TEXT,
      gmail_refresh_token TEXT,
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `)
  // Migrate: add name_confirmed to user_tokens so we know if user has set their display name
  try { db.exec(`ALTER TABLE user_tokens ADD COLUMN name_confirmed INTEGER DEFAULT 0`) } catch {}
  // Migrate: add role column to team_members
  try { db.exec(`ALTER TABLE team_members ADD COLUMN role TEXT DEFAULT 'user'`) } catch {}
  // Migrate: add first_name + last_name to team_members (older DBs)
  try { db.exec(`ALTER TABLE team_members ADD COLUMN first_name TEXT`) } catch {}
  try { db.exec(`ALTER TABLE team_members ADD COLUMN last_name TEXT`) } catch {}
  try { db.exec(`ALTER TABLE team_members ADD COLUMN job_function TEXT DEFAULT 'other'`) } catch {}
  // Migrate: add assigned_to + due_date + description to planning_items
  try { db.exec(`ALTER TABLE planning_items ADD COLUMN assigned_to TEXT`) } catch {}
  try { db.exec(`ALTER TABLE planning_items ADD COLUMN due_date TEXT`) } catch {}
  try { db.exec(`ALTER TABLE planning_items ADD COLUMN description TEXT`) } catch {}
  try { db.exec(`ALTER TABLE planning_items ADD COLUMN status TEXT DEFAULT 'todo'`) } catch {}
  // Backfill status from done flag
  try { db.exec(`UPDATE planning_items SET status = 'complete' WHERE done = 1 AND (status IS NULL OR status = 'todo')`) } catch {}
  // Migrate: add planning_items if missing (for existing DBs)
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

  // Outcomes table — one row per event, upsertable
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_outcomes (
      event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      leads_captured INTEGER,
      meetings_booked INTEGER,
      pipeline_generated REAL,
      revenue_attributed REAL,
      sponsorship_revenue REAL,
      attendees_actual INTEGER,
      satisfaction_score REAL,
      notes TEXT,
      data_source TEXT DEFAULT 'manual',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Migrate event_outcomes to add meetings_booked column if it doesn't exist
  try { db.exec(`ALTER TABLE event_outcomes ADD COLUMN meetings_booked INTEGER`) } catch {}
  // Migrate: add computed outcome metrics
  try { db.exec(`ALTER TABLE event_outcomes ADD COLUMN cost_per_lead REAL`) } catch {}
  try { db.exec(`ALTER TABLE event_outcomes ADD COLUMN roi REAL`) } catch {}

  // Approvers table — saved list of people who can approve event spend
  db.exec(`
    CREATE TABLE IF NOT EXISTS approvers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Migrate: approval workflow columns on opportunities
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN approver_name TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN approver_email TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN approval_sent_at TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN approval_thread_id TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN last_followup_at TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN followup_count INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN contact_name TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN contact_email TEXT`) } catch {}
  try { db.exec(`ALTER TABLE opportunities ADD COLUMN budget_research_notes TEXT`) } catch {}

  // Check-ins table — recreate with UNIQUE constraint to prevent duplicate rows
  // Drop and recreate to fix any duplicate rows created before the constraint existed
  try {
    db.exec(`DROP TABLE IF EXISTS event_checkins`)
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        checkin_type TEXT NOT NULL,
        due_date TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(event_id, checkin_type)
      )
    `)
  } catch {}
}

function seedData(db: Database.Database) {
  // Insert events
  const insertEvent = db.prepare(`
    INSERT INTO events (name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const e1 = insertEvent.run('TechSummit 2026', 'conference', 'active', '2026-06-15', '2026-06-17', 'San Francisco, CA', 'Moscone Center', 500, 250000, 'Annual technology conference bringing together industry leaders and innovators.')
  const e2 = insertEvent.run('Q2 Sales Kickoff', 'sales_kickoff', 'planning', '2026-07-08', '2026-07-09', 'Las Vegas, NV', 'Aria Resort', 200, 120000, 'Quarterly sales team alignment and motivation event.')
  const e3 = insertEvent.run('Enterprise Client Summit', 'client_summit', 'planning', '2026-09-10', '2026-09-10', 'New York, NY', 'Park Hyatt', 80, 85000, 'Executive-level client engagement and relationship building summit.')

  const e1Id = e1.lastInsertRowid as number

  // Insert vendors
  const insertVendor = db.prepare(`
    INSERT INTO vendors (name, category, contact_name, contact_email, contact_phone, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const v1 = insertVendor.run('Moscone AV Solutions', 'av_tech', 'Mike Chen', 'mike@mosconeav.com', '415-555-0101', 'Preferred AV partner for Moscone Center events.')
  const v2 = insertVendor.run('Bay Area Catering Co', 'catering', 'Sarah Johnson', 'sarah@bacatering.com', '415-555-0202', 'Full-service catering with vegetarian and vegan options.')
  const v3 = insertVendor.run('ExpoStaff Agency', 'staffing', 'Tom Rivera', 'tom@expostaff.com', '415-555-0303', 'Event staffing specialists with trained brand ambassadors.')
  const v4 = insertVendor.run('Premier Transport Services', 'transport', 'Lisa Wang', 'lisa@premiertransport.com', '415-555-0404', 'Executive and group transportation solutions.')
  const v5 = insertVendor.run('Global Event Marketing', 'marketing', 'David Park', 'david@globaleventmkt.com', '415-555-0505', 'Full-service event marketing and promotion agency.')

  const v1Id = v1.lastInsertRowid as number
  const v2Id = v2.lastInsertRowid as number
  const v3Id = v3.lastInsertRowid as number
  const v4Id = v4.lastInsertRowid as number
  const v5Id = v5.lastInsertRowid as number

  // Attach vendors to TechSummit 2026
  const insertEV = db.prepare(`
    INSERT INTO event_vendors (event_id, vendor_id, status, contract_value, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  insertEV.run(e1Id, v1Id, 'contracted', 45000, 'Full AV setup including main stage, breakout rooms, and streaming.')
  insertEV.run(e1Id, v2Id, 'contracted', 62000, 'All meals and coffee breaks for 3 days, 500 attendees.')
  insertEV.run(e1Id, v3Id, 'shortlisted', 28000, 'Registration staff, session monitors, and floor support.')
  insertEV.run(e1Id, v4Id, 'rfp_sent', null, 'Shuttle service from major hotels to Moscone.')
  insertEV.run(e1Id, v5Id, 'contracted', 35000, 'Pre-event promotion, social media, and on-site signage.')

  // Budget items for TechSummit 2026
  const insertBudget = db.prepare(`
    INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, po_number, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertBudget.run(e1Id, 'venue', 'Moscone Center venue rental - 3 days', null, 75000, 75000, 'PO-2026-001', 'paid', 'Includes main hall + 8 breakout rooms')
  insertBudget.run(e1Id, 'av_tech', 'AV equipment and production', v1Id, 45000, 42500, 'PO-2026-002', 'invoiced', 'Final invoice pending post-event review')
  insertBudget.run(e1Id, 'catering', 'Full catering service - 3 days', v2Id, 62000, 0, 'PO-2026-003', 'approved', 'Net 30 after event')
  insertBudget.run(e1Id, 'staffing', 'Event staff agency fees', v3Id, 28000, 0, null, 'pending', 'Awaiting final headcount confirmation')
  insertBudget.run(e1Id, 'marketing', 'Pre-event marketing campaign', v5Id, 35000, 31000, 'PO-2026-004', 'paid', 'Digital and print materials')
  insertBudget.run(e1Id, 'transport', 'Shuttle service', v4Id, 8000, 0, null, 'pending', 'Budget estimate, contract pending')
  insertBudget.run(e1Id, 'misc', 'Speaker gifts and awards', null, 5000, 3200, 'PO-2026-005', 'paid', 'Custom trophies and gift bags')

  // Tasks for TechSummit 2026
  const insertTask = db.prepare(`
    INSERT INTO tasks (event_id, title, description, category, assigned_to, due_date, status, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertTask.run(e1Id, 'Confirm keynote speakers', 'Finalize speaker agreements and travel arrangements', 'vendor', 'Jane Smith', '2026-05-01', 'done', 'critical')
  insertTask.run(e1Id, 'Finalize AV production schedule', 'Coordinate with Moscone AV on tech rehearsal times', 'vendor', 'Mike Chen', '2026-05-15', 'done', 'high')
  insertTask.run(e1Id, 'Send attendee registration confirmation emails', 'Batch email with agenda and logistics info', 'admin', 'Sarah Lee', '2026-06-01', 'in_progress', 'high')
  insertTask.run(e1Id, 'Coordinate hotel room block', 'Reserve block at Marriott Marquis for VIP attendees', 'logistics', 'Tom Rivera', '2026-05-20', 'done', 'medium')
  insertTask.run(e1Id, 'Set up event app', 'Configure and populate event mobile app with sessions', 'admin', 'Dev Team', '2026-06-10', 'in_progress', 'medium')
  insertTask.run(e1Id, 'Print signage and banners', 'Order and proof all directional and sponsor signage', 'marketing', 'Lisa Park', '2026-06-05', 'todo', 'medium')
  insertTask.run(e1Id, 'Brief security team', 'Walkthrough with venue security on protocols', 'logistics', 'James Wilson', '2026-06-14', 'todo', 'high')
  insertTask.run(e1Id, 'Arrange post-event survey', 'Set up attendee satisfaction survey in SurveyMonkey', 'admin', 'Sarah Lee', '2026-06-14', 'todo', 'low')

  // Run of Show for TechSummit 2026
  const insertROS = db.prepare(`
    INSERT INTO run_of_show (event_id, event_day, start_time, end_time, activity, owner, location, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Day 1
  insertROS.run(e1Id, 1, '07:00', '08:30', 'Registration & Badge Pickup Opens', 'Registration Team', 'Main Lobby', 'Staff briefing at 6:45am', 'confirmed')
  insertROS.run(e1Id, 1, '08:00', '09:00', 'Breakfast & Networking', 'Catering', 'Hall B Foyer', 'Coffee, pastries, fruit', 'confirmed')
  insertROS.run(e1Id, 1, '09:00', '09:15', 'Opening Remarks', 'CEO', 'Main Stage', 'AV check at 8:30am', 'confirmed')
  insertROS.run(e1Id, 1, '09:15', '10:15', 'Opening Keynote', 'Keynote Speaker 1', 'Main Stage', 'Slides due by June 10', 'planned')
  insertROS.run(e1Id, 1, '10:15', '10:30', 'Break', null, 'Hall B Foyer', null, 'planned')
  insertROS.run(e1Id, 1, '10:30', '12:00', 'Breakout Sessions - Round 1', 'Session Leads', 'Rooms 101-108', '8 parallel tracks', 'planned')
  insertROS.run(e1Id, 1, '12:00', '13:30', 'Lunch', 'Catering', 'Hall C', 'Buffet style, vegan options available', 'planned')
  insertROS.run(e1Id, 1, '13:30', '15:00', 'Breakout Sessions - Round 2', 'Session Leads', 'Rooms 101-108', null, 'planned')
  insertROS.run(e1Id, 1, '17:00', '19:00', 'Welcome Reception', 'Events Team', 'Rooftop Terrace', 'Cocktails and appetizers', 'planned')
  // Day 2
  insertROS.run(e1Id, 2, '08:00', '09:00', 'Breakfast', 'Catering', 'Hall B Foyer', null, 'planned')
  insertROS.run(e1Id, 2, '09:00', '10:00', 'Keynote Day 2', 'Keynote Speaker 2', 'Main Stage', null, 'planned')
  insertROS.run(e1Id, 2, '10:00', '12:00', 'Panel Discussions', 'Moderators', 'Main Stage + Rooms', '3 simultaneous panels', 'planned')
  insertROS.run(e1Id, 2, '19:00', '22:00', 'Gala Dinner', 'Events Team', 'Grand Ballroom', 'Black tie optional', 'planned')
  // Day 3
  insertROS.run(e1Id, 3, '09:00', '10:30', 'Workshop Sessions', 'Workshop Leads', 'Rooms 201-206', 'Hands-on technical workshops', 'planned')
  insertROS.run(e1Id, 3, '12:00', '13:00', 'Closing Lunch', 'Catering', 'Hall C', null, 'planned')
  insertROS.run(e1Id, 3, '13:00', '14:00', 'Closing Keynote & Awards', 'CEO', 'Main Stage', 'Awards ceremony included', 'planned')

  // Staff for TechSummit 2026
  const insertStaff = db.prepare(`
    INSERT INTO staff (event_id, name, role, email, phone, arrival_date, departure_date, hotel, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertStaff.run(e1Id, 'Jane Smith', 'Event Director', 'jane.smith@company.com', '415-555-1001', '2026-06-13', '2026-06-18', 'Marriott Marquis', 'Lead coordinator, primary point of contact')
  insertStaff.run(e1Id, 'Tom Rivera', 'Logistics Manager', 'tom.rivera@company.com', '415-555-1002', '2026-06-14', '2026-06-17', 'Marriott Marquis', 'Handles all ground transportation and load-in')
  insertStaff.run(e1Id, 'Sarah Lee', 'Registration Lead', 'sarah.lee@company.com', '415-555-1003', '2026-06-14', '2026-06-17', 'Hilton Union Square', 'Managing 10 registration volunteers')
  insertStaff.run(e1Id, 'Mike Torres', 'AV Liaison', 'mike.torres@company.com', '415-555-1004', '2026-06-14', '2026-06-18', 'Hilton Union Square', 'Works directly with Moscone AV team')
  insertStaff.run(e1Id, 'Lisa Park', 'Sponsor Relations', 'lisa.park@company.com', '415-555-1005', '2026-06-14', '2026-06-17', 'Marriott Marquis', 'Managing all sponsor booths and deliverables')
}
