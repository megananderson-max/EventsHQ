import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'

// GET — return current user's profile + whether they need to set their name
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const db = getDb()
  const email = session.user.email

  const token = db.prepare(
    'SELECT email, name, image, name_confirmed FROM user_tokens WHERE email = ?'
  ).get(email) as { email: string; name: string | null; image: string | null; name_confirmed: number } | undefined

  // Check if they already have a team_members record linked to their email
  const teamMember = db.prepare(
    'SELECT id, name, first_name, last_name, role, job_function FROM team_members WHERE email = ?'
  ).get(email) as { id: number; name: string; first_name: string; last_name: string | null; role: string; job_function: string } | undefined

  return NextResponse.json({
    email,
    name: teamMember?.name || token?.name || null,
    image: session.user.image || null,
    nameConfirmed: !!token?.name_confirmed || !!teamMember,
    teamMemberId: teamMember?.id || null,
    role: teamMember?.role || 'user',
  })
}

// PUT — save user's chosen display name
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const db = getDb()
  const email = session.user.email
  const { first_name, last_name } = await req.json() as { first_name: string; last_name?: string }

  if (!first_name?.trim()) return NextResponse.json({ error: 'First name is required' }, { status: 400 })

  const fullName = [first_name.trim(), last_name?.trim()].filter(Boolean).join(' ')

  // Mark name as confirmed in user_tokens
  db.prepare(
    'UPDATE user_tokens SET name = ?, name_confirmed = 1 WHERE email = ?'
  ).run(fullName, email)

  // Create or update team_members record for this user
  const existing = db.prepare('SELECT id FROM team_members WHERE email = ?').get(email) as { id: number } | undefined

  if (existing) {
    db.prepare(
      'UPDATE team_members SET name = ?, first_name = ?, last_name = ? WHERE id = ?'
    ).run(fullName, first_name.trim(), last_name?.trim() || null, existing.id)
  } else {
    db.prepare(
      `INSERT INTO team_members (name, first_name, last_name, email, is_me, role, job_function)
       VALUES (?, ?, ?, ?, 0, 'user', 'other')`
    ).run(fullName, first_name.trim(), last_name?.trim() || null, email)
  }

  return NextResponse.json({ ok: true, name: fullName })
}
