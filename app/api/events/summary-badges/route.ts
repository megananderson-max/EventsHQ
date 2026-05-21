import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const badges = db.prepare(`
    SELECT
      e.id,
      COUNT(CASE WHEN p.status = 'blocked' THEN 1 END) as blocked_tasks,
      COUNT(CASE WHEN p.due_date < date('now') AND p.status != 'complete' AND p.done = 0 THEN 1 END) as overdue_tasks,
      COUNT(CASE WHEN b.actual_amount > b.planned_amount AND b.planned_amount > 0 THEN 1 END) as over_budget_items,
      CASE WHEN o.event_id IS NULL AND e.end_date < date('now') THEN 1 ELSE 0 END as missing_outcomes
    FROM events e
    LEFT JOIN planning_items p ON p.event_id = e.id
    LEFT JOIN budget_items b ON b.event_id = e.id
    LEFT JOIN event_outcomes o ON o.event_id = e.id
    GROUP BY e.id
  `).all() as Array<{id: number; blocked_tasks: number; overdue_tasks: number; over_budget_items: number; missing_outcomes: number}>

  const map: Record<number, typeof badges[0]> = {}
  badges.forEach(b => { map[b.id] = b })
  return NextResponse.json(map)
}
