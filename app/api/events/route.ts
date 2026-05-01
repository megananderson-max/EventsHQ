import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    let query = 'SELECT * FROM events WHERE 1=1'
    const params: (string | number)[] = []

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    if (type) {
      query += ' AND type = ?'
      params.push(type)
    }
    query += ' ORDER BY created_at DESC'

    const events = db.prepare(query).all(...params)
    return NextResponse.json(events)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description, review_notes } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO events (name, type, status, start_date, end_date, location, venue, expected_attendees, budget_total, description, review_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, status || 'planning', start_date || null, end_date || null, location || null, venue || null, expected_attendees || null, budget_total || 0, description || null, review_notes || null)

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
