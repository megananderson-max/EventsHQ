import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const approvers = db.prepare(`
      SELECT id, name, email, title, created_at
      FROM approvers
      ORDER BY name ASC
    `).all()
    return NextResponse.json({ approvers })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, title } = await req.json() as {
      name: string
      email: string
      title?: string
    }
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
    }
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO approvers (name, email, title)
      VALUES (?, ?, ?)
    `).run(name.trim(), email.trim().toLowerCase(), title?.trim() || null)
    const created = db.prepare(`SELECT * FROM approvers WHERE id = ?`).get(result.lastInsertRowid)
    return NextResponse.json({ approver: created })
  } catch (err: unknown) {
    const msg = String(err)
    if (msg.includes('UNIQUE')) return NextResponse.json({ error: 'That email is already saved as an approver' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
