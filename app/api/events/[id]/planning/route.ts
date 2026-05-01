import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const items = db.prepare('SELECT * FROM planning_items WHERE event_id = ? ORDER BY sort_order ASC, created_at ASC').all(Number(params.id))
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const body = await req.json()
  const status = body.status ?? 'todo'
  const done = status === 'complete' ? 1 : 0
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM planning_items WHERE event_id = ?').get(Number(params.id)) as { m: number | null }).m ?? 0
  const result = db.prepare(
    'INSERT INTO planning_items (event_id, title, description, done, status, sort_order, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(Number(params.id), body.title, body.description || null, done, status, maxOrder + 1, body.assigned_to || null, body.due_date || null)
  const item = db.prepare('SELECT * FROM planning_items WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(item, { status: 201 })
}
