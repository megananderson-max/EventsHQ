import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string; vid: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { status, contract_value, contract_url, notes } = body

    db.prepare(`
      UPDATE event_vendors SET status=?, contract_value=?, contract_url=?, notes=?
      WHERE id=? AND event_id=?
    `).run(status, contract_value || null, contract_url || null, notes || null, params.vid, params.id)

    const ev = db.prepare(`
      SELECT ev.*, v.name as vendor_name, v.category, v.contact_name, v.contact_email
      FROM event_vendors ev
      JOIN vendors v ON ev.vendor_id = v.id
      WHERE ev.id = ?
    `).get(params.vid)
    return NextResponse.json(ev)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update event vendor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; vid: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM event_vendors WHERE id=? AND event_id=?').run(params.vid, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove vendor from event' }, { status: 500 })
  }
}
