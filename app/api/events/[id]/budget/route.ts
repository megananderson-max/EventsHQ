import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const items = db.prepare(`
      SELECT bi.*, v.name as vendor_name
      FROM budget_items bi
      LEFT JOIN vendors v ON bi.vendor_id = v.id
      WHERE bi.event_id = ?
      ORDER BY bi.category, bi.created_at
    `).all(params.id)
    return NextResponse.json(items)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch budget items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { category, description, vendor_id, planned_amount, actual_amount, po_number, invoice_number, payment_due_date, status, notes, is_estimate } = body

    if (!category || !description) {
      return NextResponse.json({ error: 'Category and description are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO budget_items (event_id, category, description, vendor_id, planned_amount, actual_amount, po_number, invoice_number, payment_due_date, status, notes, is_estimate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.id, category, description, vendor_id || null, planned_amount || 0, actual_amount || 0, po_number || null, invoice_number || null, payment_due_date || null, status || 'pending', notes || null, is_estimate ? 1 : 0)

    const item = db.prepare(`
      SELECT bi.*, v.name as vendor_name
      FROM budget_items bi
      LEFT JOIN vendors v ON bi.vendor_id = v.id
      WHERE bi.id = ?
    `).get(result.lastInsertRowid)
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create budget item' }, { status: 500 })
  }
}
