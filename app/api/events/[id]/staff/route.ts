import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const staffList = db.prepare('SELECT * FROM staff WHERE event_id = ? ORDER BY role, name').all(params.id)
    return NextResponse.json(staffList)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, role, email, phone, arrival_date, departure_date, hotel, notes } = body

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO staff (event_id, name, role, email, phone, arrival_date, departure_date, hotel, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.id, name, role, email || null, phone || null, arrival_date || null, departure_date || null, hotel || null, notes || null)

    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(staff, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 })
  }
}
