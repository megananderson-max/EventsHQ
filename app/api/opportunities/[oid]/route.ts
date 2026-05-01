import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { oid: string } }) {
  const db = getDb()
  const body = await req.json()
  const fields = Object.entries(body).map(([k]) => `${k}=?`).join(', ')
  const values = Object.values(body)
  db.prepare(`UPDATE opportunities SET ${fields} WHERE id=?`).run(...values, Number(params.oid))
  const updated = db.prepare('SELECT * FROM opportunities WHERE id=?').get(Number(params.oid))
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { oid: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM opportunities WHERE id=?').run(Number(params.oid))
  return NextResponse.json({ success: true })
}
