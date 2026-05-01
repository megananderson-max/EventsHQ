import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const db = getDb()
  const body = await req.json()
  const status = body.status ?? 'todo'
  const done = (status === 'complete' || body.done) ? 1 : 0
  db.prepare(
    'UPDATE planning_items SET title = ?, description = ?, done = ?, status = ?, assigned_to = ?, due_date = ? WHERE id = ? AND event_id = ?'
  ).run(body.title, body.description ?? null, done, status, body.assigned_to ?? null, body.due_date ?? null, Number(params.pid), Number(params.id))
  const item = db.prepare('SELECT * FROM planning_items WHERE id = ?').get(Number(params.pid))
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM planning_items WHERE id = ? AND event_id = ?').run(Number(params.pid), Number(params.id))
  return NextResponse.json({ success: true })
}
