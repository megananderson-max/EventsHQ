import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const FOCUS_QUEUE = ['all', 'cx', 'ai_tech', 'ignitetech', 'community', 'contact_center', 'social_media', 'executive']

function ensureTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
  return db
}

function get(db: ReturnType<typeof getDb>, key: string, def: string): string {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? def
}

function set(db: ReturnType<typeof getDb>, key: string, value: string) {
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value)
}

export async function GET() {
  const db = ensureTable()

  const enabled = get(db, 'opp_scan_enabled', 'true') === 'true'
  const freqHours = parseInt(get(db, 'opp_scan_freq_hours', '24'))
  const lastScanAt = get(db, 'opp_last_scan_at', '') || null
  const lastAdded = parseInt(get(db, 'opp_last_scan_added', '0'))
  const lastFocus = get(db, 'opp_last_scan_focus', '') || null

  const queue: string[] = JSON.parse(get(db, 'opp_focus_queue', JSON.stringify(FOCUS_QUEUE)))
  const nextFocus = queue[0]

  const lastMs = lastScanAt ? new Date(lastScanAt).getTime() : 0
  const nextMs = lastMs + freqHours * 3_600_000
  const isDue = enabled && Date.now() >= nextMs

  return NextResponse.json({
    enabled,
    freq_hours: freqHours,
    last_scan_at: lastScanAt,
    last_added: lastAdded,
    last_focus: lastFocus,
    next_scan_at: lastMs ? new Date(nextMs).toISOString() : null,
    next_focus: nextFocus,
    is_due: isDue,
  })
}

export async function POST(req: NextRequest) {
  const db = ensureTable()
  const body = await req.json() as { added?: number; focus_area?: string }

  set(db, 'opp_last_scan_at', new Date().toISOString())
  set(db, 'opp_last_scan_added', String(body.added ?? 0))
  set(db, 'opp_last_scan_focus', body.focus_area ?? 'all')

  // Rotate the queue: move front item to back
  const queue: string[] = JSON.parse(get(db, 'opp_focus_queue', JSON.stringify(FOCUS_QUEUE)))
  const rotated = [...queue.slice(1), queue[0]]
  set(db, 'opp_focus_queue', JSON.stringify(rotated))

  return NextResponse.json({ ok: true, next_focus: rotated[0] })
}
