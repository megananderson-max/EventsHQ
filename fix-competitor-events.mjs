// fix-competitor-events.mjs
// Flags CMX Summit (Bevy) and Gainsight Pulse (Gainsight) as competitor-owned.
// Both verified via web research:
//   - CMX acquired by Bevy in Feb 2019 (TechCrunch, CMXHub official post)
//   - Gainsight acquired inSided (community platform) in 2022, now "Gainsight Customer Communities";
//     Gainsight explicitly markets as a Khoros alternative (gainsight.com/alternative/khoros/)
// Already flagged: id 25 (Higher Logic Super Forum), id 48 (Zendesk Relate)

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'events.db'))

const fixes = [
  {
    id: 24, // CMX Summit
    is_competitor_event: 1,
    strategic_fit: 'Low',
    recommendation: 'Do Not Attend',
    description: 'CMX was acquired by Bevy in February 2019. Bevy is a direct competitor to Khoros in the branded community software category. The CMX Summit is Bevy\'s flagship industry event — sponsoring or speaking here directly funds and promotes a competitor\'s platform. Khoros should not participate.',
    competitor_name: 'Bevy',
  },
  {
    id: 47, // Gainsight Pulse
    is_competitor_event: 1,
    strategic_fit: 'Low',
    recommendation: 'Do Not Attend',
    description: 'Gainsight acquired inSided in 2022 and rebranded it "Gainsight Customer Communities," which directly competes with Khoros Community. Gainsight actively markets their product as a Khoros alternative (gainsight.com/alternative/khoros/). Pulse is Gainsight\'s annual customer conference — not an independent industry event. Khoros should not participate.',
    competitor_name: 'Gainsight',
  },
]

// Add competitor_name column if missing
try { db.exec('ALTER TABLE opportunities ADD COLUMN competitor_name TEXT') } catch {}

const stmt = db.prepare(`
  UPDATE opportunities
  SET is_competitor_event = ?, strategic_fit = ?, recommendation = ?, description = ?, competitor_name = ?
  WHERE id = ?
`)

for (const f of fixes) {
  const r = stmt.run(f.is_competitor_event, f.strategic_fit, f.recommendation, f.description, f.competitor_name, f.id)
  console.log(r.changes ? `  ✓ [${f.id}] ${f.competitor_name} flagged` : `  ⚠ NOT FOUND id: ${f.id}`)
}

// Also add competitor_name for the already-flagged ones
db.prepare(`UPDATE opportunities SET competitor_name = 'Higher Logic' WHERE id = 25`).run()
db.prepare(`UPDATE opportunities SET competitor_name = 'Zendesk' WHERE id = 48`).run()
console.log('  ✓ [25] Higher Logic updated, [48] Zendesk updated')

const all = db.prepare(`SELECT id, name, competitor_name FROM opportunities WHERE is_competitor_event = 1`).all()
console.log(`\nAll competitor-flagged events (${all.length}):`)
all.forEach(o => console.log(`  ${o.id}: ${o.name} [${o.competitor_name}]`))
