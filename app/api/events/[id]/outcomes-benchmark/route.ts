import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const event = db.prepare('SELECT type FROM events WHERE id = ?').get(Number(params.id)) as { type: string } | undefined
  if (!event) return NextResponse.json(null)

  const benchmarks = db.prepare(`
    SELECT
      AVG(o.leads_captured) as avg_leads,
      AVG(o.meetings_booked) as avg_meetings,
      AVG(o.roi) as avg_roi,
      AVG(o.cost_per_lead) as avg_cost_per_lead,
      COUNT(*) as event_count
    FROM event_outcomes o
    JOIN events e ON e.id = o.event_id
    WHERE e.type = ? AND e.id != ? AND o.leads_captured IS NOT NULL
  `).get(event.type, Number(params.id)) as { avg_leads: number | null; avg_meetings: number | null; avg_roi: number | null; avg_cost_per_lead: number | null; event_count: number }

  if (!benchmarks || benchmarks.event_count < 1) return NextResponse.json(null)
  return NextResponse.json({ ...benchmarks, event_type: event.type })
}
