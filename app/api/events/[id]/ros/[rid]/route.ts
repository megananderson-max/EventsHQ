import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string; rid: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { event_day, start_time, end_time, activity, owner, location, notes, status } = body

    db.prepare(`
      UPDATE run_of_show SET event_day=?, start_time=?, end_time=?, activity=?, owner=?, location=?, notes=?, status=?
      WHERE id=? AND event_id=?
    `).run(event_day || 1, start_time, end_time || null, activity, owner || null, location || null, notes || null, status || 'planned', params.rid, params.id)

    const ros = db.prepare('SELECT * FROM run_of_show WHERE id = ?').get(params.rid)
    return NextResponse.json(ros)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update run of show entry' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; rid: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM run_of_show WHERE id=? AND event_id=?').run(params.rid, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete run of show entry' }, { status: 500 })
  }
}
