import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(params.id)
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    return NextResponse.json(vendor)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch vendor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, category, contact_name, contact_email, contact_phone, website, notes } = body

    db.prepare(`
      UPDATE vendors SET name=?, category=?, contact_name=?, contact_email=?, contact_phone=?, website=?, notes=?
      WHERE id=?
    `).run(name, category, contact_name || null, contact_email || null, contact_phone || null, website || null, notes || null, params.id)

    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(params.id)
    return NextResponse.json(vendor)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM vendors WHERE id = ?').run(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 })
  }
}
