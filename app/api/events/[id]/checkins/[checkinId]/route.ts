import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; checkinId: string } }) {
  const db = getDb()
  db.prepare('UPDATE event_checkins SET completed = 1 WHERE id = ? AND event_id = ?').run(Number(params.checkinId), Number(params.id))
  return NextResponse.json({ ok: true })
}
