import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const members = db.prepare('SELECT id, name, first_name, last_name, email, is_me, role FROM team_members ORDER BY is_me DESC, name ASC').all()
  return NextResponse.json(members)
}

export async function POST(request: Request) {
  const db = getDb()
  const { first_name, last_name, email, is_me, role } = await request.json()
  if (!first_name?.trim()) return NextResponse.json({ error: 'First name is required' }, { status: 400 })

  const fullName = [first_name.trim(), last_name?.trim()].filter(Boolean).join(' ')

  // If marking as me, unset others first
  if (is_me) db.prepare('UPDATE team_members SET is_me = 0').run()

  const result = db.prepare(
    "INSERT INTO team_members (name, first_name, last_name, email, is_me, role) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(fullName, first_name.trim(), last_name?.trim() || null, email?.trim() || null, is_me ? 1 : 0, role || 'user')

  const member = db.prepare('SELECT id, name, first_name, last_name, email, is_me, role FROM team_members WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(member, { status: 201 })
}
