import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string; sid: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, role, email, phone, arrival_date, departure_date, hotel, notes } = body

    db.prepare(`
      UPDATE staff SET name=?, role=?, email=?, phone=?, arrival_date=?, departure_date=?, hotel=?, notes=?
      WHERE id=? AND event_id=?
    `).run(name, role, email || null, phone || null, arrival_date || null, departure_date || null, hotel || null, notes || null, params.sid, params.id)

    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(params.sid)
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; sid: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM staff WHERE id=? AND event_id=?').run(params.sid, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 })
  }
}
