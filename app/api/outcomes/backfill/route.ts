import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { autoGenerateBenchmarkOutcomes } from '@/lib/generateBenchmark'

export async function POST() {
  try {
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]

    // Find all concluded events with no outcomes row yet
    const events = db.prepare(`
      SELECT e.id, e.name, e.type, e.location, e.expected_attendees, e.budget_total
      FROM events e
      LEFT JOIN event_outcomes o ON e.id = o.event_id
      WHERE o.event_id IS NULL
        AND e.end_date IS NOT NULL
        AND e.end_date < ?
    `).all(today) as Array<{
      id: number; name: string; type: string;
      location: string | null; expected_attendees: number | null; budget_total: number
    }>

    if (events.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No events need backfill' })
    }

    // Generate benchmarks sequentially to avoid rate limits
    let processed = 0
    const errors: string[] = []
    for (const event of events) {
      try {
        await autoGenerateBenchmarkOutcomes(db, event)
        processed++
      } catch (e) {
        errors.push(`${event.name}: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }

    return NextResponse.json({ processed, total: events.length, errors })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
