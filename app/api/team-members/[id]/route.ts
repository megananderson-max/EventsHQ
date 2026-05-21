import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const db = getDb()
  const id = parseInt(params.id)
  const { first_name, last_name, name, email, is_me, role, job_function } = await request.json()

  const resolvedFirst = first_name?.trim() || name?.trim() || ''
  if (!resolvedFirst) return NextResponse.json({ error: 'First name is required' }, { status: 400 })

  const resolvedLast = last_name?.trim() || null
  const fullName = [resolvedFirst, resolvedLast].filter(Boolean).join(' ')

  // If marking as me, unset others first
  if (is_me) db.prepare('UPDATE team_members SET is_me = 0 WHERE id != ?').run(id)

  // Get old name before updating so we can cascade to task assignments
  const old = db.prepare('SELECT name FROM team_members WHERE id = ?').get(id) as { name: string } | undefined
  const oldName = old?.name

  db.prepare(
    'UPDATE team_members SET name = ?, first_name = ?, last_name = ?, email = ?, is_me = ?, role = ?, job_function = ? WHERE id = ?'
  ).run(fullName, resolvedFirst, resolvedLast, email?.trim() || null, is_me ? 1 : 0, role || 'user', job_function || 'other', id)

  // Cascade name change to any planning task assignments
  if (oldName && oldName !== fullName) {
    db.prepare('UPDATE planning_items SET assigned_to = ? WHERE assigned_to = ?').run(fullName, oldName)
  }

  const member = db.prepare('SELECT id, name, first_name, last_name, email, is_me, role, job_function FROM team_members WHERE id = ?').get(id)
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(member)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const db = getDb()
  const id = parseInt(params.id)
  db.prepare('DELETE FROM team_members WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
