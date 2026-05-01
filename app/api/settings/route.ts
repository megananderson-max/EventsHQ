import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

function ensureTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
  return db
}

export async function GET() {
  const db = ensureTable()
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
  const out: Record<string, string> = {}
  rows.forEach(r => { out[r.key] = r.value })
  return NextResponse.json(out)
}

export async function PUT(req: NextRequest) {
  const db = ensureTable()
  const updates = await req.json() as Record<string, string>
  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `)
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(key, String(value))
  }
  return NextResponse.json({ ok: true })
}
