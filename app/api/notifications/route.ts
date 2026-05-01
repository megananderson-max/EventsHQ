import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const me = db.prepare('SELECT name FROM team_members WHERE is_me = 1 LIMIT 1').get() as { name: string } | undefined
  const myName = me?.name ?? null

  const baseQuery = `
    SELECT pi.id, pi.title, pi.due_date, pi.assigned_to, pi.event_id, pi.done,
           e.name as event_name
    FROM planning_items pi
    JOIN events e ON pi.event_id = e.id
    WHERE pi.done = 0
      AND pi.assigned_to = ?
  `

  const withDue = (db.prepare(`${baseQuery} AND pi.due_date IS NOT NULL ORDER BY pi.due_date ASC`).all(myName)) as {
    id: number; title: string; due_date: string; assigned_to: string | null;
    event_id: number; done: number; event_name: string
  }[]

  const noDue = (db.prepare(`${baseQuery} AND pi.due_date IS NULL ORDER BY pi.id ASC`).all(myName)) as {
    id: number; title: string; due_date: string | null; assigned_to: string | null;
    event_id: number; done: number; event_name: string
  }[]

  const overdue = withDue.filter(i => i.due_date < today)
  const dueSoon = withDue.filter(i => i.due_date >= today && i.due_date <= in7Days)
  const upcoming = withDue.filter(i => i.due_date > in7Days && i.due_date <= in90Days)

  // Post-event wrap-up: events whose end_date has passed and post-event info not yet uploaded
  const postEventEvents = db.prepare(`
    SELECT id, name, end_date
    FROM events
    WHERE end_date IS NOT NULL
      AND end_date < ?
      AND (post_event_completed IS NULL OR post_event_completed = 0)
    ORDER BY end_date DESC
  `).all(today) as { id: number; name: string; end_date: string }[]

  return NextResponse.json({
    overdue,
    due_soon: dueSoon,
    upcoming,
    no_due_date: noDue,
    post_event_events: postEventEvents,
    my_name: myName,
    total: overdue.length + dueSoon.length + postEventEvents.length,
    total_with_upcoming: withDue.length + noDue.length + postEventEvents.length,
  })
}
