import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { autoGenerateBenchmarkOutcomes } from '@/lib/generateBenchmark'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const event = db.prepare(`
      SELECT e.*, o.id as opportunity_id
      FROM events e
      LEFT JOIN opportunities o ON o.event_id = e.id
      WHERE e.id = ?
    `).get(params.id)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    return NextResponse.json(event)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description, review_notes } = body

    db.prepare(`
      UPDATE events SET name=?, type=?, status=?, start_date=?, end_date=?, location=?, venue=?, expected_attendees=?, budget_total=?, description=?, review_notes=?
      WHERE id=?
    `).run(name, type, status, start_date || null, end_date || null, location || null, venue || null, expected_attendees || null, budget_total || 0, description || null, review_notes ?? null, params.id)

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(params.id)

    // Auto-generate benchmark estimates when event is marked complete for the first time
    if (status === 'complete') {
      const ev = event as { id: number; name: string; type: string; location: string | null; expected_attendees: number | null; budget_total: number }
      // Fire without awaiting — runs in background after response is sent
      autoGenerateBenchmarkOutcomes(db, { id: ev.id, name: ev.name, type: ev.type, location: ev.location, expected_attendees: ev.expected_attendees, budget_total: ev.budget_total }).catch(() => {})
    }

    return NextResponse.json(event)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const sets: string[] = []
    const values: unknown[] = []
    if (body.post_event_completed !== undefined) {
      sets.push('post_event_completed = ?')
      values.push(body.post_event_completed ? 1 : 0)
    }
    if (body.execution_notes !== undefined) {
      sets.push('execution_notes = ?')
      values.push(body.execution_notes || null)
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    values.push(params.id)
    db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(params.id)
    return NextResponse.json(event)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const eventId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    // 'pipeline' = approved opportunities tab, 'under_review' = pending_approval tab
    const destination = searchParams.get('destination') ?? 'under_review'
    const oppStatus = destination === 'pipeline' ? 'approved' : 'pending_approval'

    // Check if this event was promoted from an opportunity
    const opp = db.prepare('SELECT id FROM opportunities WHERE event_id = ?').get(eventId) as { id: number } | undefined
    if (opp) {
      db.prepare('UPDATE opportunities SET added_to_events = 0, status = ?, event_id = NULL WHERE id = ?').run(oppStatus, opp.id)
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId)
      return NextResponse.json({ success: true, reverted: true, destination })
    }

    // No linked opportunity — create one from the event data then delete the event
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as Record<string, unknown> | undefined
    if (event) {
      db.prepare(`
        INSERT INTO opportunities (name, type, start_date, end_date, location, venue, expected_attendees,
          budget_estimate_high, description, status, added_to_events, strategic_fit, recommendation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Medium', 'Evaluate')
      `).run(event.name, event.type, event.start_date, event.end_date, event.location, event.venue,
        event.expected_attendees, event.budget_total, event.description, oppStatus)
    }
    db.prepare('DELETE FROM events WHERE id = ?').run(eventId)
    return NextResponse.json({ success: true, reverted: true, destination })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
