import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const vendors = db.prepare(`
      SELECT ev.*, v.name as vendor_name, v.category, v.contact_name, v.contact_email, v.contact_phone, v.website
      FROM event_vendors ev
      JOIN vendors v ON ev.vendor_id = v.id
      WHERE ev.event_id = ?
      ORDER BY ev.created_at DESC
    `).all(params.id)
    return NextResponse.json(vendors)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch event vendors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { vendor_id, status, contract_value, contract_url, notes } = body

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id is required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO event_vendors (event_id, vendor_id, status, contract_value, contract_url, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.id, vendor_id, status || 'rfp_sent', contract_value || null, contract_url || null, notes || null)

    const ev = db.prepare(`
      SELECT ev.*, v.name as vendor_name, v.category, v.contact_name, v.contact_email
      FROM event_vendors ev
      JOIN vendors v ON ev.vendor_id = v.id
      WHERE ev.id = ?
    `).get(result.lastInsertRowid)
    return NextResponse.json(ev, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add vendor to event' }, { status: 500 })
  }
}
