import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  // Join events with event_outcomes, only events that have an end_date (concluded or upcoming-concluded)
  const rows = db.prepare(`
    SELECT
      e.id, e.name, e.type, e.status, e.start_date, e.end_date,
      e.budget_total, e.expected_attendees,
      o.leads_captured, o.pipeline_generated, o.revenue_attributed,
      o.sponsorship_revenue, o.meetings_booked, o.attendees_actual AS actual_attendees,
      o.satisfaction_score, o.data_source
    FROM events e
    LEFT JOIN event_outcomes o ON e.id = o.event_id
    WHERE e.end_date IS NOT NULL
    ORDER BY e.end_date DESC
  `).all() as Array<{
    id: number; name: string; type: string; status: string;
    start_date: string | null; end_date: string | null;
    budget_total: number; expected_attendees: number | null;
    leads_captured: number | null; pipeline_generated: number | null;
    revenue_attributed: number | null; sponsorship_revenue: number | null;
    meetings_booked: number | null; actual_attendees: number | null;
    satisfaction_score: number | null; data_source: string | null;
  }>

  // Compute derived fields per row
  const today = new Date().toISOString().split('T')[0]
  const events = rows.map(row => {
    const concluded = row.end_date ? row.end_date < today : false
    const roi = (() => {
      if (!row.revenue_attributed || !row.budget_total) return null
      const spon = row.sponsorship_revenue ?? 0
      return ((row.revenue_attributed + spon - row.budget_total) / row.budget_total) * 100
    })()
    const costPerLead = row.leads_captured && row.budget_total
      ? row.budget_total / row.leads_captured
      : null
    return { ...row, concluded, roi, cost_per_lead: costPerLead }
  })

  // Aggregate totals for events that have outcomes data
  const withData = events.filter(e => e.data_source !== null)
  const totals = {
    total_events: events.length,
    events_with_data: withData.length,
    events_concluded: events.filter(e => e.concluded).length,
    total_pipeline: withData.reduce((s, e) => s + (e.pipeline_generated ?? 0), 0),
    total_revenue: withData.reduce((s, e) => s + (e.revenue_attributed ?? 0), 0),
    total_leads: withData.reduce((s, e) => s + (e.leads_captured ?? 0), 0),
    avg_roi: (() => {
      const roiEvents = withData.filter(e => e.roi !== null)
      if (!roiEvents.length) return null
      return roiEvents.reduce((s, e) => s + e.roi!, 0) / roiEvents.length
    })(),
  }

  return NextResponse.json({ events, totals })
}
