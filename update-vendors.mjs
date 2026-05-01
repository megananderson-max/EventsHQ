import Database from 'better-sqlite3'

const db = new Database('events.db')

// Update vendor contact info with what we found in Drive
const updates = [
  // BCCC - WiFi contact: Latela Blue
  { id: 27, contact_name: 'Latela Blue', contact_email: 'lblue@ftlauderdalecc.com', contact_phone: null },
  // Edlen - phone and updated email found in ordering confirmation
  { id: 29, contact_name: null, contact_email: 'exhibitorservices-miami@edlen.com', contact_phone: '(305) 623-5335' },
  // Pepcom - Diane Brauer email and phone
  { id: 30, contact_name: 'Diane Brauer', contact_email: 'diane@pepcom.com', contact_phone: '(561) 278-5601' },
  // Veloxity - email and phone from invoice
  { id: 39, contact_name: null, contact_email: 'lucky@veloxity.us', contact_phone: '(855) 844-5060' },
]

const updateStmt = db.prepare(`
  UPDATE vendors SET
    contact_name = COALESCE(:contact_name, contact_name),
    contact_email = COALESCE(:contact_email, contact_email),
    contact_phone = COALESCE(:contact_phone, contact_phone)
  WHERE id = :id
`)

for (const u of updates) {
  updateStmt.run(u)
  console.log(`Updated vendor ${u.id}`)
}

// Delete unused duplicate vendor records (not referenced in budget_items or event_vendors)
const duplicateIds = [32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49]
const deleteStmt = db.prepare('DELETE FROM vendors WHERE id = ?')

for (const id of duplicateIds) {
  deleteStmt.run(id)
  console.log(`Deleted duplicate vendor ${id}`)
}

// Verify final state
const vendors = db.prepare(`
  SELECT id, name, contact_name, contact_email, contact_phone
  FROM vendors
  WHERE name IN (
    'Broward County Convention Center (BCCC)',
    'Edlen Electrical Exhibition Services',
    'Pepcom Inc.',
    'ShowStoppers (LL&J LLC)',
    'Veloxity',
    'Freeman',
    'Technology Marketing Corporation (TMC)',
    'CEO Magazine'
  )
  ORDER BY name, id
`).all()

console.log('\nUpdated vendor contacts:')
for (const v of vendors) {
  console.log(`  [${v.id}] ${v.name}: ${v.contact_name || '—'} | ${v.contact_email || '—'} | ${v.contact_phone || '—'}`)
}

db.close()
console.log('\nDone.')
