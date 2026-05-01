import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM event_outcomes WHERE event_id = ?').get(Number(params.id))
  return NextResponse.json(row ?? null)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const body = await req.json()
  const existing = (db.prepare('SELECT * FROM event_outcomes WHERE event_id = ?').get(Number(params.id)) ?? {}) as Record<string, unknown>
  const merged = {
    leads_captured: body.leads_captured ?? existing.leads_captured ?? null,
    meetings_booked: body.meetings_booked ?? existing.meetings_booked ?? null,
    pipeline_generated: body.pipeline_generated ?? existing.pipeline_generated ?? null,
    revenue_attributed: body.revenue_attributed ?? existing.revenue_attributed ?? null,
    sponsorship_revenue: body.sponsorship_revenue ?? existing.sponsorship_revenue ?? null,
    attendees_actual: body.attendees_actual ?? existing.attendees_actual ?? null,
    satisfaction_score: body.satisfaction_score ?? existing.satisfaction_score ?? null,
    notes: body.notes ?? existing.notes ?? null,
    data_source: body.data_source ?? existing.data_source ?? 'manual',
  }
  db.prepare(`
    INSERT OR REPLACE INTO event_outcomes
    (event_id, leads_captured, meetings_booked, pipeline_generated, revenue_attributed,
     sponsorship_revenue, attendees_actual, satisfaction_score, notes, data_source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(Number(params.id), merged.leads_captured, merged.meetings_booked, merged.pipeline_generated,
    merged.revenue_attributed, merged.sponsorship_revenue, merged.attendees_actual,
    merged.satisfaction_score, merged.notes, merged.data_source)
  return NextResponse.json(db.prepare('SELECT * FROM event_outcomes WHERE event_id = ?').get(Number(params.id)))
}
