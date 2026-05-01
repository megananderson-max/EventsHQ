import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const events = db.prepare(`
      SELECT e.id, e.name, e.start_date, e.status
      FROM event_vendors ev
      JOIN events e ON ev.event_id = e.id
      WHERE ev.vendor_id = ?
      ORDER BY e.start_date DESC
    `).all(params.id)
    return NextResponse.json(events)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch vendor events' }, { status: 500 })
  }
}
