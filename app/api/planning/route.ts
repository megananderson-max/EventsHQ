import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const items = db.prepare(`
    SELECT
      p.id, p.event_id, p.title, p.description, p.done,
      p.status, p.assigned_to, p.due_date, p.sort_order, p.created_at,
      e.name AS event_name, e.status AS event_status, e.start_date AS event_start_date
    FROM planning_items p
    JOIN events e ON e.id = p.event_id
    ORDER BY
      e.start_date ASC,
      p.sort_order ASC,
      p.created_at ASC
  `).all()
  return NextResponse.json(items)
}
