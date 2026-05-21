import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const eventId = Number(params.id)

  const event = db.prepare('SELECT type FROM events WHERE id = ?').get(eventId) as { type: string } | undefined
  if (!event) return NextResponse.json([])

  // Find vendors used in past events of the same type, not yet attached to this event
  const suggestions = db.prepare(`
    SELECT DISTINCT v.id, v.name, v.category, v.contact_name, v.contact_email, v.website,
      COUNT(ev2.id) as times_used,
      MAX(e2.start_date) as last_used_date,
      e2.name as last_used_event
    FROM vendors v
    JOIN event_vendors ev2 ON ev2.vendor_id = v.id
    JOIN events e2 ON e2.id = ev2.event_id
    WHERE e2.type = ?
      AND e2.id != ?
      AND v.id NOT IN (
        SELECT vendor_id FROM event_vendors WHERE event_id = ?
      )
    GROUP BY v.id
    ORDER BY times_used DESC, last_used_date DESC
    LIMIT 10
  `).all(event.type, eventId, eventId) as Array<{
    id: number; name: string; category: string; contact_name: string | null;
    contact_email: string | null; website: string | null;
    times_used: number; last_used_date: string | null; last_used_event: string | null
  }>

  return NextResponse.json(suggestions)
}
