import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  // Return all past events so frontend can fuzzy-match
  const events = db.prepare(`
    SELECT id, name, start_date, status,
      (SELECT COUNT(*) FROM event_outcomes WHERE event_id = events.id) as has_outcomes
    FROM events ORDER BY start_date DESC
  `).all()
  return NextResponse.json(events)
}
