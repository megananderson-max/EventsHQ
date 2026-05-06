'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface OutcomesTabProps {
  eventId: string
  event: {
    name: string
    type: string
    end_date: string
    budget_total: number
    status: string
  }
}

interface OutcomesData {
  leads_captured: number | null
  pipeline_generated: number | null
  revenue_attributed: number | null
  sponsorship_revenue: number | null
  meetings_booked: number | null
  attendees_actual: number | null
  satisfaction_score: number | null
  data_source: string | null
}

interface BenchmarkData {
  pipeline_min: number
  pipeline_max: number
  leads_min: number
  leads_max: number
  roi_min: number
  roi_max: number
  cost_per_lead_min: number
  cost_per_lead_max: number
  basis: string
  caveat: string
  confidence: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatK(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return n.toString()
}

function getDebriefPlaceholder(type: string): string {
  if (type === 'conference' || type === 'trade_show') {
    return 'How many leads did we capture? Any meetings booked? What pipeline came from this event? Estimated revenue? How was the overall experience (1-10)? Any notable wins or partnerships?'
  }
  if (type === 'client_summit') {
    return 'Which clients attended? Any renewals or upsells committed? What deals were influenced? How was satisfaction? Key outcomes?'
  }
  if (type === 'sales_kickoff') {
    return 'How many attendees? What was the satisfaction score? Any immediate pipeline impact? Key outcomes?'
  }
  return 'How did the event go? How many attendees? Any leads captured or meetings booked? What pipeline was generated? Overall satisfaction (1-10)?'
}

function DataSourceBadge({ source }: { source: string | null }) {
  if (!source) return null
  const map: Record<string, { label: string; classes: string }> = {
    manual: { label: 'Manual', classes: 'bg-gray-100 text-gray-600' },
    ai_import: { label: 'AI Import', classes: 'bg-violet-100 text-violet-700' },
    ai_debrief: { label: 'AI Debrief', classes: 'bg-violet-100 text-violet-700' },
    benchmark: { label: 'Benchmark', classes: 'bg-amber-100 text-amber-700' },
  }
  const key = source.toLowerCase().replace(' ', '_')
  const config = map[key] || { label: source, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.classes}`}>
      {config.label}
    </span>
  )
}

export default function OutcomesTab({ eventId, event }: OutcomesTabProps) {
  const [outcomes, setOutcomes] = useState<OutcomesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<OutcomesData>>({})

  const [debriefText, setDebriefText] = useState('')
  const [debriefLoading, setDebriefLoading] = useState(false)
  const [debriefError, setDebriefError] = useState<string | null>(null)

  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)
  const [estimatingForm, setEstimatingForm] = useState(false)
  const [estimateApplied, setEstimateApplied] = useState(false)

  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().split('T')[0]) }, [])
  const eventEnded = event.end_date && today ? event.end_date < today : false
  const hasAutoFetchedBenchmark = useRef(false)

  const fetchOutcomes = useCallback(() => {
    fetch(`/api/events/${eventId}/outcomes`)
      .then(r => r.json())
      .then(data => {
        setOutcomes(data || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [eventId])

  useEffect(() => { fetchOutcomes() }, [fetchOutcomes])

  const runBenchmark = useCallback(async () => {
    setBenchmarkLoading(true)
    setBenchmarkError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/benchmark`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Benchmark failed')
      setBenchmark(data)
    } catch (e: unknown) {
      setBenchmarkError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBenchmarkLoading(false)
    }
  }, [eventId])

  // Auto-save benchmark estimates when event has ended but no outcomes recorded yet
  useEffect(() => {
    if (!loading && eventEnded && !outcomes && !hasAutoFetchedBenchmark.current) {
      hasAutoFetchedBenchmark.current = true
      setBenchmarkLoading(true)
      // Call backfill — saves midpoint estimates to DB, then reload outcomes
      fetch('/api/outcomes/backfill', { method: 'POST' })
        .then(() => fetchOutcomes())
        .catch(() => {})
        .finally(() => setBenchmarkLoading(false))
    }
  }, [loading, eventEnded, outcomes, fetchOutcomes])

  // Derived metrics
  const roi = (() => {
    if (!outcomes) return null
    const rev = outcomes.revenue_attributed
    const pipe = outcomes.pipeline_generated
    const spon = outcomes.sponsorship_revenue ?? 0
    const budget = event.budget_total
    if (rev == null || budget == null || budget === 0) return null
    return ((rev + spon - budget) / budget) * 100
  })()

  const costPerLead = (() => {
    if (!outcomes) return null
    const leads = outcomes.leads_captured
    const budget = event.budget_total
    if (!leads || !budget) return null
    return budget / leads
  })()

  const startEdit = () => {
    setEditForm({
      leads_captured: outcomes?.leads_captured ?? undefined,
      pipeline_generated: outcomes?.pipeline_generated ?? undefined,
      revenue_attributed: outcomes?.revenue_attributed ?? undefined,
      sponsorship_revenue: outcomes?.sponsorship_revenue ?? undefined,
      meetings_booked: outcomes?.meetings_booked ?? undefined,
      attendees_actual: outcomes?.attendees_actual ?? undefined,
      satisfaction_score: outcomes?.satisfaction_score ?? undefined,
    })
    setEditing(true)
  }

  const estimateWithAI = async () => {
    setEstimatingForm(true)
    setEstimateApplied(false)
    try {
      const res = await fetch(`/api/events/${eventId}/benchmark`, { method: 'POST' })
      const bm = await res.json()
      if (!res.ok) throw new Error(bm.error || 'Benchmark failed')
      setBenchmark(bm)
      // Pre-fill form with midpoints from benchmark ranges
      setEditForm(f => ({
        ...f,
        leads_captured: Math.round((bm.leads_min + bm.leads_max) / 2),
        pipeline_generated: Math.round((bm.pipeline_min + bm.pipeline_max) / 2),
        revenue_attributed: Math.round(
          Math.round((bm.pipeline_min + bm.pipeline_max) / 2) *
          // Revenue is typically 20-30% of pipeline for initial attribution
          0.22
        ),
        meetings_booked: Math.round((bm.leads_min + bm.leads_max) / 2 * 0.27),
        satisfaction_score: 7.5,
      }))
      setEstimateApplied(true)
    } catch {
      // silently fail — user can still fill in manually
    } finally {
      setEstimatingForm(false)
    }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await fetch(`/api/events/${eventId}/outcomes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, data_source: 'manual' }),
      })
      fetchOutcomes()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const runDebrief = async () => {
    if (!debriefText.trim()) return
    setDebriefLoading(true)
    setDebriefError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/debrief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: debriefText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Debrief failed')
      fetchOutcomes()
      setDebriefText('')
    } catch (e: unknown) {
      setDebriefError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setDebriefLoading(false)
    }
  }

  // Loading or auto-generating estimates
  if (loading || (benchmarkLoading && !outcomes)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-48 gap-3">
        <svg className="w-6 h-6 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-sm text-gray-500 font-medium">
          {benchmarkLoading && !loading ? 'Generating ROI estimates…' : 'Loading outcomes…'}
        </p>
        {benchmarkLoading && !loading && (
          <p className="text-xs text-gray-400">Asking AI for industry benchmarks for this event type</p>
        )}
      </div>
    )
  }

  // Event hasn't ended yet — no data possible
  if (!outcomes && !eventEnded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center py-16">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm font-medium">ROI estimates will be generated once this event concludes.</p>
        <p className="text-gray-400 text-xs mt-1">Check back after {event.end_date ? new Date(event.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'the event ends'}.</p>
      </div>
    )
  }

  // Main outcomes view
  const isEstimate = outcomes?.data_source === 'benchmark'

  return (
    <div className="space-y-6">
      {/* Estimate banner — shown when data is AI-generated benchmarks, not actuals */}
      {isEstimate && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Industry benchmark estimates</p>
            <p className="text-xs text-amber-700 mt-0.5">
              These figures are AI-generated based on typical results for this event type and size. Update them with actual numbers as they become available, or use the AI debrief below to extract figures from your notes.
            </p>
          </div>
        </div>
      )}

      {/* ROI Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <ROIMetricCard
          label="Leads Captured"
          value={outcomes?.leads_captured != null ? outcomes.leads_captured.toLocaleString() : '—'}
          color="blue"
        />
        <ROIMetricCard
          label="Pipeline Generated"
          value={outcomes?.pipeline_generated != null ? formatCurrency(outcomes.pipeline_generated) : '—'}
          color="green"
        />
        <ROIMetricCard
          label="Revenue Attributed"
          value={outcomes?.revenue_attributed != null ? formatCurrency(outcomes.revenue_attributed) : '—'}
          color="purple"
        />
        <ROIMetricCard
          label="ROI"
          value={roi != null ? `${roi >= 0 ? '+' : ''}${Math.round(roi)}%` : '—'}
          color={roi == null ? 'gray' : roi >= 0 ? 'green' : 'red'}
          sub={roi != null ? (roi >= 0 ? 'vs. budget invested' : 'below break-even') : 'insufficient data'}
          showRoiTooltip
        />
      </div>

      {/* Secondary metrics row */}
      <div className="flex flex-wrap gap-3">
        <StatPill
          label="Meetings Booked"
          value={outcomes?.meetings_booked != null ? outcomes.meetings_booked.toString() : '—'}
        />
        <StatPill
          label="Actual Attendees"
          value={outcomes?.attendees_actual != null ? outcomes.attendees_actual.toLocaleString() : '—'}
        />
        <StatPill
          label="Satisfaction Score"
          value={outcomes?.satisfaction_score != null ? `${outcomes.satisfaction_score}/10` : '—'}
        />
        <StatPill
          label="Cost per Lead"
          value={costPerLead != null ? formatCurrency(costPerLead) : '—'}
        />
        {outcomes?.sponsorship_revenue != null && (
          <StatPill
            label="Sponsorship Revenue"
            value={formatCurrency(outcomes.sponsorship_revenue)}
          />
        )}
      </div>

      {/* Edit / Save button row */}
      <div className="flex items-center justify-end">
        {editing ? (
          <div className="flex items-center gap-3">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-blue-500 hover:text-blue-700 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Outcomes
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Form header with AI estimate option */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Edit Outcome Metrics</h3>
            <button
              onClick={estimateWithAI}
              disabled={estimatingForm}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              {estimatingForm ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Generating estimates…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                  Fill with AI estimates
                </>
              )}
            </button>
          </div>

          {estimateApplied && (
            <div className="flex items-center gap-2 mx-6 mt-4 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Fields filled with AI benchmark estimates — review and adjust before saving.</span>
            </div>
          )}

          <div className="p-6 grid grid-cols-2 gap-4">
            <EditField
              label="Leads Captured"
              value={editForm.leads_captured}
              onChange={v => setEditForm(f => ({ ...f, leads_captured: v }))}
            />
            <EditField
              label="Pipeline Generated ($)"
              value={editForm.pipeline_generated}
              onChange={v => setEditForm(f => ({ ...f, pipeline_generated: v }))}
            />
            <div>
              <EditField
                label="Revenue Attributed ($)"
                value={editForm.revenue_attributed}
                onChange={v => setEditForm(f => ({ ...f, revenue_attributed: v }))}
              />
              <p className="text-xs text-gray-400 mt-1">Tip: Start with your actual closed revenue from this event. If deals are still open, use Pipeline Generated as a leading indicator.</p>
            </div>
            <EditField
              label="Sponsorship Revenue ($)"
              value={editForm.sponsorship_revenue}
              onChange={v => setEditForm(f => ({ ...f, sponsorship_revenue: v }))}
            />
            <EditField
              label="Meetings Booked"
              value={editForm.meetings_booked}
              onChange={v => setEditForm(f => ({ ...f, meetings_booked: v }))}
            />
            <EditField
              label="Actual Attendees"
              value={editForm.attendees_actual}
              onChange={v => setEditForm(f => ({ ...f, attendees_actual: v }))}
            />
            <EditField
              label="Satisfaction Score (0–10)"
              value={editForm.satisfaction_score}
              onChange={v => setEditForm(f => ({ ...f, satisfaction_score: v }))}
              step="0.1"
              max={10}
            />
          </div>
        </div>
      )}

      {/* AI Debrief section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 to-violet-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            <h3 className="font-semibold text-gray-900 text-sm">AI Post-Event Debrief</h3>
            <DataSourceBadge source={outcomes?.data_source ?? null} />
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Answer the questions below and AI will extract updated metrics from your responses.</p>
          <textarea
            value={debriefText}
            onChange={e => setDebriefText(e.target.value)}
            placeholder={getDebriefPlaceholder(event.type)}
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
          />
          {debriefError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{debriefError}</div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={runDebrief}
              disabled={debriefLoading || !debriefText.trim()}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {debriefLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Extracting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  Extract with AI
                </>
              )}
            </button>
            <span className="text-xs text-gray-400">Metrics above will be updated automatically</span>
          </div>
        </div>
      </div>

      {/* Benchmark section */}
      <BenchmarkCard
        benchmark={benchmark}
        benchmarkLoading={benchmarkLoading}
        benchmarkError={benchmarkError}
        onGetBenchmark={runBenchmark}
      />
    </div>
  )
}

const ROI_TOOLTIP = 'ROI = (Revenue Attributed − Budget Spent) ÷ Budget Spent × 100. Pipeline Generated is shown separately — it represents potential deals not yet closed. The 22% pipeline-to-revenue conversion used in AI estimates is a B2B industry average. Update Revenue Attributed with your actual closed revenue as deals progress.'

function ROIMetricCard({ label, value, color, sub, showRoiTooltip }: { label: string; value: string; color: string; sub?: string; showRoiTooltip?: boolean }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    gray: 'text-gray-400',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center justify-center gap-1">
        {label}
        {showRoiTooltip && (
          <span className="relative group inline-flex items-center">
            <span className="text-gray-400 hover:text-gray-600 cursor-help text-sm leading-none select-none">ⓘ</span>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2.5 text-xs text-gray-700 font-normal normal-case tracking-normal text-left opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed">
              {ROI_TOOLTIP}
            </span>
          </span>
        )}
      </p>
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5">
      <span className="text-xs text-gray-500 font-medium">{label}:</span>
      <span className="text-xs font-semibold text-gray-800">{value}</span>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  step,
  max,
}: {
  label: string
  value: number | null | undefined
  onChange: (v: number | null) => void
  step?: string
  max?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        step={step || '1'}
        min={0}
        max={max}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="—"
      />
    </div>
  )
}

function BenchmarkCard({
  benchmark,
  benchmarkLoading,
  benchmarkError,
  onGetBenchmark,
}: {
  benchmark: BenchmarkData | null
  benchmarkLoading: boolean
  benchmarkError: string | null
  onGetBenchmark: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 className="font-semibold text-gray-900 text-sm">Industry Benchmark Estimate</h3>
          {benchmark?.confidence && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {benchmark.confidence} confidence
            </span>
          )}
        </div>
        {!benchmark && (
          <button
            onClick={onGetBenchmark}
            disabled={benchmarkLoading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {benchmarkLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Fetching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Get Industry Benchmarks
              </>
            )}
          </button>
        )}
      </div>

      {benchmarkError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{benchmarkError}</div>
      )}

      {!benchmark && !benchmarkLoading && !benchmarkError && (
        <p className="text-sm text-gray-400">Compare your event performance against industry averages for this event type.</p>
      )}

      {benchmarkLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400 text-sm">Fetching benchmarks...</div>
        </div>
      )}

      {benchmark && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <BenchmarkRow
              label="Pipeline Expected"
              value={`${formatCurrency(benchmark.pipeline_min)} – ${formatCurrency(benchmark.pipeline_max)}`}
              sub={`${formatK(benchmark.pipeline_min)}–${formatK(benchmark.pipeline_max)} pipeline expected for this event type`}
            />
            <BenchmarkRow
              label="Leads Typically Captured"
              value={`${benchmark.leads_min}–${benchmark.leads_max} leads`}
            />
            <BenchmarkRow
              label="Typical ROI"
              value={`${benchmark.roi_min}%–${benchmark.roi_max}%`}
            />
            <BenchmarkRow
              label="Cost per Lead"
              value={`${formatCurrency(benchmark.cost_per_lead_min)} – ${formatCurrency(benchmark.cost_per_lead_max)}`}
            />
          </div>
          {benchmark.basis && (
            <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span className="font-medium text-gray-600">Basis: </span>{benchmark.basis}
            </div>
          )}
          {benchmark.caveat && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700">{benchmark.caveat}</p>
            </div>
          )}
          <button
            onClick={onGetBenchmark}
            disabled={benchmarkLoading}
            className="text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
          >
            Refresh benchmarks
          </button>
        </div>
      )}
    </div>
  )
}

function BenchmarkRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
