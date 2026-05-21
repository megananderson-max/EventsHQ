import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string; bid: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { category, description, vendor_id, planned_amount, actual_amount, po_number, invoice_number, payment_due_date, status, notes, is_estimate } = body

    db.prepare(`
      UPDATE budget_items SET category=?, description=?, vendor_id=?, planned_amount=?, actual_amount=?, po_number=?, invoice_number=?, payment_due_date=?, status=?, notes=?, is_estimate=?
      WHERE id=? AND event_id=?
    `).run(category, description, vendor_id || null, planned_amount || 0, actual_amount || 0, po_number || null, invoice_number || null, payment_due_date || null, status || 'pending', notes || null, is_estimate ? 1 : 0, params.bid, params.id)

    const item = db.prepare(`
      SELECT bi.*, v.name as vendor_name
      FROM budget_items bi
      LEFT JOIN vendors v ON bi.vendor_id = v.id
      WHERE bi.id = ?
    `).get(params.bid)

    // Auto-sync event budget_total to sum of planned_amount
    const sum = db.prepare('SELECT COALESCE(SUM(planned_amount), 0) as t FROM budget_items WHERE event_id = ?').get(params.id) as { t: number }
    db.prepare('UPDATE events SET budget_total = ? WHERE id = ?').run(sum.t, params.id)

    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update budget item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; bid: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM budget_items WHERE id=? AND event_id=?').run(params.bid, params.id)

    // Auto-sync event budget_total to sum of planned_amount
    const sum = db.prepare('SELECT COALESCE(SUM(planned_amount), 0) as t FROM budget_items WHERE event_id = ?').get(params.id) as { t: number }
    db.prepare('UPDATE events SET budget_total = ? WHERE id = ?').run(sum.t, params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete budget item' }, { status: 500 })
  }
}
