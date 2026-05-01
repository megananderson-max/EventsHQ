import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const ros = db.prepare('SELECT * FROM run_of_show WHERE event_id = ? ORDER BY event_day ASC, start_time ASC').all(params.id)
    return NextResponse.json(ros)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch run of show' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { event_day, start_time, end_time, activity, owner, location, notes, status } = body

    if (!start_time || !activity) {
      return NextResponse.json({ error: 'Start time and activity are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO run_of_show (event_id, event_day, start_time, end_time, activity, owner, location, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.id, event_day || 1, start_time, end_time || null, activity, owner || null, location || null, notes || null, status || 'planned')

    const ros = db.prepare('SELECT * FROM run_of_show WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(ros, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create run of show entry' }, { status: 500 })
  }
}
