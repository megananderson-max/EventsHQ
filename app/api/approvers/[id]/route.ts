import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    db.prepare(`DELETE FROM approvers WHERE id = ?`).run(params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name, email, title } = await req.json() as {
      name?: string
      email?: string
      title?: string
    }
    const db = getDb()
    const fields: string[] = []
    const vals: unknown[] = []
    if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()) }
    if (email !== undefined) { fields.push('email = ?'); vals.push(email.trim().toLowerCase()) }
    if (title !== undefined) { fields.push('title = ?'); vals.push(title?.trim() || null) }
    if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    vals.push(params.id)
    db.prepare(`UPDATE approvers SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
    const updated = db.prepare(`SELECT * FROM approvers WHERE id = ?`).get(params.id)
    return NextResponse.json({ approver: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
