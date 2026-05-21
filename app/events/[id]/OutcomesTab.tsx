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
  notes: string | null
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

interface PeerBenchmarkData {
  avg_leads: number | null
  avg_meetings: number | null
  avg_roi: number | null
  avg_cost_per_lead: number | null
  event_count: number
  event_type: string
}

type OutcomeField = keyof Omit<OutcomesData, 'data_source' | 'notes'>

const FIELD_CONFIG: Record<OutcomeField, { label: string; isCurrency: boolean; isFloat: boolean; max?: number }> = {
  leads_captured:      { label: 'Leads Captured',        isCurrency: false, isFloat: false },
  pipeline_generated:  { label: 'Pipeline Generated',    isCurrency: true,  isFloat: false },
  revenue_attributed:  { label: 'Revenue Attributed',    isCurrency: true,  isFloat: false },
  sponsorship_revenue: { label: 'Sponsorship Revenue',   isCurrency: true,  isFloat: false },
  meetings_booked:     { label: 'Meetings Booked',       isCurrency: false, isFloat: false },
  attendees_actual:    { label: 'Actual Attendees',      isCurrency: false, isFloat: false },
  satisfaction_score:  { label: 'Satisfaction Score',    isCurrency: false, isFloat: true,  max: 10 },
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatK(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return n.toString()
}

function getDebriefPlaceholder(type: string): string {
  if (type === 'conference' || type === 'trade_show')
    return 'How many leads did we capture? Any meetings booked? What pipeline came from this event? Estimated revenue? How was the overall experience (1-10)? Any notable wins or partnerships?'
  if (type === 'client_summit')
    return 'Which clients attended? Any renewals or upsells committed? What deals were influenced? How was satisfaction? Key outcomes?'
  if (type === 'sales_kickoff')
    return 'How many attendees? What was the satisfaction score? Any immediate pipeline impact? Key outcomes?'
  return 'How did the event go? How many attendees? Any leads captured or meetings booked? What pipeline was generated? Overall satisfaction (1-10)?'
}

function DataSourceBadge({ source }: { source: string | null }) {
  if (!source) return null
  const map: Record<string, { label: string; classes: string }> = {
    manual:     { label: 'Manual',    classes: 'bg-gray-100 text-gray-600' },
    ai_import:  { label: 'AI Import', classes: 'bg-violet-100 text-violet-700' },
    ai_debrief: { label: 'AI Debrief', classes: 'bg-violet-100 text-violet-700' },
    benchmark:  { label: 'Estimate',  classes: 'bg-amber-100 text-amber-700' },
  }
  const config = map[source] || { label: source, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.classes}`}>
      {config.label}
    </span>
  )
}

// Inline-editable metric card — click value to edit, blur/Enter saves
function InlineEditCard({
  label, displayValue, fieldValue, color, sub, showRoiTooltip,
  onSave, isCurrency, isFloat, max,
}: {
  label: string
  displayValue: string
  fieldValue: number | null | undefined
  color: string
  sub?: string
  showRoiTooltip?: boolean
  onSave: (v: number | null) => Promise<void>
  isCurrency: boolean
  isFloat: boolean
  max?: number
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const colorMap: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-600',
    purple: 'text-purple-600', gray: 'text-gray-400',
  }

  const startEdit = () => {
    setVal(fieldValue != null ? String(fieldValue) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = async () => {
    if (!editing) return
    setSaving(true)
    const parsed = val.trim() === '' ? null : (isFloat ? parseFloat(val) : parseInt(val, 10))
    await onSave(parsed)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-4 text-center cursor-pointer group relative transition-colors ${editing ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}`}
      onClick={() => !editing && startEdit()}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center justify-center gap-1">
        {label}
        {showRoiTooltip && (
          <span className="relative group/tip inline-flex items-center">
            <span className="text-gray-400 hover:text-gray-600 cursor-help text-sm leading-none select-none">ⓘ</span>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2.5 text-xs text-gray-700 font-normal normal-case tracking-normal text-left opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 leading-relaxed">
              {ROI_TOOLTIP}
            </span>
          </span>
        )}
      </p>
      {editing ? (
        <div onClick={e => e.stopPropagation()} className="flex flex-col items-center gap-1.5">
          <input
            ref={inputRef}
            type="number"
            step={isFloat ? '0.1' : '1'}
            min={0}
            max={max}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={commit}
            className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
            placeholder="—"
          />
          {isCurrency && <span className="text-[10px] text-gray-400">Enter amount in USD</span>}
        </div>
      ) : (
        <>
          <p className={`text-2xl font-bold ${colorMap[color] || 'text-gray-900'} flex items-center justify-center gap-1.5`}>
            {saving ? (
              <svg className="w-5 h-5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : displayValue}
            <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </>
      )}
    </div>
  )
}

function InlineEditPill({
  label, fieldValue, isCurrency, isFloat, max, onSave,
}: {
  label: string
  fieldValue: number | null
  isCurrency: boolean
  isFloat: boolean
  max?: number
  onSave: (v: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = fieldValue == null ? '—'
    : isCurrency ? formatCurrency(fieldValue)
    : isFloat ? `${fieldValue}/10`
    : fieldValue.toLocaleString()

  const startEdit = () => {
    setVal(fieldValue != null ? String(fieldValue) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = async () => {
    if (!editing) return
    setSaving(true)
    const parsed = val.trim() === '' ? null : (isFloat ? parseFloat(val) : parseInt(val, 10))
    await onSave(parsed)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div
      className={`flex items-center gap-2 border rounded-full px-4 py-1.5 cursor-pointer group transition-colors ${editing ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:border-blue-300'}`}
      onClick={() => !editing && startEdit()}
    >
      <span className="text-xs text-gray-500 font-medium flex-shrink-0">{label}:</span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          step={isFloat ? '0.1' : '1'}
          min={0}
          max={max}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={commit}
          onClick={e => e.stopPropagation()}
          className="w-24 border-0 bg-transparent text-xs font-semibold text-gray-800 focus:outline-none"
          placeholder="—"
        />
      ) : (
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
          {saving ? '…' : displayValue}
          <svg className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
        </span>
      )}
    </div>
  )
}

const ROI_TOOLTIP = 'ROI = (Revenue Attributed − Budget Spent) ÷ Budget Spent × 100. Pipeline Generated is shown separately — it represents potential deals not yet closed. The 22% pipeline-to-revenue conversion used in AI estimates is a B2B industry average. Update Revenue Attributed with your actual closed revenue as deals progress.'

export default function OutcomesTab({ eventId, event }: OutcomesTabProps) {
  const [outcomes, setOutcomes] = useState<OutcomesData | null>(null)
  const [loading, setLoading] = useState(true)

  const [debriefText, setDebriefText] = useState('')
  const [debriefLoading, setDebriefLoading] = useState(false)
  const [debriefError, setDebriefError] = useState<string | null>(null)
  const [debriefPreview, setDebriefPreview] = useState<Partial<OutcomesData> & { extraction_summary?: string } | null>(null)
  const [previewSaving, setPreviewSaving] = useState(false)
  const [notesEdit, setNotesEdit] = useState(false)
  const [notesVal, setNotesVal] = useState('')

  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  const [peerBenchmark, setPeerBenchmark] = useState<PeerBenchmarkData | null>(null)

  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().split('T')[0]) }, [])
  const eventEnded = event.end_date && today ? event.end_date < today : false
  const hasAutoFetchedBenchmark = useRef(false)

  const fetchOutcomes = useCallback(() => {
    fetch(`/api/events/${eventId}/outcomes`)
      .then(r => r.json())
      .then(data => { setOutcomes(data || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [eventId])

  useEffect(() => { fetchOutcomes() }, [fetchOutcomes])

  useEffect(() => {
    fetch(`/api/events/${eventId}/outcomes-benchmark`)
      .then(r => r.json())
      .then(setPeerBenchmark)
      .catch(() => {})
  }, [eventId])

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
      fetch('/api/outcomes/backfill', { method: 'POST' })
        .then(() => fetchOutcomes())
        .catch(() => {})
        .finally(() => setBenchmarkLoading(false))
    }
  }, [loading, eventEnded, outcomes, fetchOutcomes])

  // Save a single field inline
  const saveField = useCallback(async (field: OutcomeField, value: number | null) => {
    await fetch(`/api/events/${eventId}/outcomes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value, data_source: 'manual' }),
    })
    fetchOutcomes()
  }, [eventId, fetchOutcomes])

  const saveNotes = async () => {
    await fetch(`/api/events/${eventId}/outcomes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesVal, data_source: outcomes?.data_source ?? 'manual' }),
    })
    fetchOutcomes()
    setNotesEdit(false)
  }

  // Step 1: extract (dry run — no save)
  const extractDebrief = async () => {
    if (!debriefText.trim()) return
    setDebriefLoading(true)
    setDebriefError(null)
    setDebriefPreview(null)
    try {
      const res = await fetch(`/api/events/${eventId}/debrief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: debriefText, dry_run: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setDebriefPreview(data)
    } catch (e: unknown) {
      setDebriefError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setDebriefLoading(false)
    }
  }

  // Step 2: user confirms (or edits) preview, then saves
  const confirmDebrief = async () => {
    if (!debriefPreview) return
    setPreviewSaving(true)
    try {
      await fetch(`/api/events/${eventId}/outcomes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...debriefPreview, data_source: 'ai_import' }),
      })
      fetchOutcomes()
      setDebriefText('')
      setDebriefPreview(null)
    } finally {
      setPreviewSaving(false)
    }
  }

  // Derived metrics
  const roi = (() => {
    if (!outcomes) return null
    const rev = outcomes.revenue_attributed
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
      </div>
    )
  }

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

  const isEstimate = outcomes?.data_source === 'benchmark'

  return (
    <div className="space-y-6">
      {/* Peer benchmark strip */}
      {peerBenchmark && peerBenchmark.event_count >= 2 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="text-xs font-medium text-gray-500 shrink-0">
            Your {peerBenchmark.event_type.replace(/_/g, ' ')} average (across {peerBenchmark.event_count} events):
          </span>
          {peerBenchmark.avg_leads != null && <span className="text-xs text-gray-600">Avg leads: <span className="font-semibold text-gray-800">{Math.round(peerBenchmark.avg_leads).toLocaleString()}</span></span>}
          {peerBenchmark.avg_meetings != null && <span className="text-xs text-gray-600">Avg meetings: <span className="font-semibold text-gray-800">{Math.round(peerBenchmark.avg_meetings).toLocaleString()}</span></span>}
          {peerBenchmark.avg_roi != null && <span className="text-xs text-gray-600">Avg ROI: <span className="font-semibold text-gray-800">{Math.round(peerBenchmark.avg_roi)}%</span></span>}
          {peerBenchmark.avg_cost_per_lead != null && <span className="text-xs text-gray-600">Avg cost/lead: <span className="font-semibold text-gray-800">{formatCurrency(peerBenchmark.avg_cost_per_lead)}</span></span>}
        </div>
      )}

      {/* Estimate banner */}
      {isEstimate && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-900">Industry benchmark estimates — click any value to update</p>
            <p className="text-xs text-amber-700 mt-0.5">These figures are AI-generated. Click any metric card to edit it directly, or use the AI import below to extract actuals from your notes.</p>
          </div>
        </div>
      )}

      {/* Data source + hint */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <DataSourceBadge source={outcomes?.data_source ?? null} />
        <span>Click any metric to edit it directly</span>
      </div>

      {/* ROI Metric Cards — all inline-editable */}
      <div className="grid grid-cols-4 gap-4">
        <InlineEditCard
          label="Leads Captured"
          displayValue={outcomes?.leads_captured != null ? outcomes.leads_captured.toLocaleString() : '—'}
          fieldValue={outcomes?.leads_captured}
          color="blue" isCurrency={false} isFloat={false}
          onSave={v => saveField('leads_captured', v)}
        />
        <InlineEditCard
          label="Pipeline Generated"
          displayValue={outcomes?.pipeline_generated != null ? formatCurrency(outcomes.pipeline_generated) : '—'}
          fieldValue={outcomes?.pipeline_generated}
          color="green" isCurrency={true} isFloat={false}
          onSave={v => saveField('pipeline_generated', v)}
        />
        <InlineEditCard
          label="Revenue Attributed"
          displayValue={outcomes?.revenue_attributed != null ? formatCurrency(outcomes.revenue_attributed) : '—'}
          fieldValue={outcomes?.revenue_attributed}
          color="purple" isCurrency={true} isFloat={false}
          onSave={v => saveField('revenue_attributed', v)}
        />
        <InlineEditCard
          label="ROI"
          displayValue={roi != null ? `${roi >= 0 ? '+' : ''}${Math.round(roi)}%` : '—'}
          fieldValue={outcomes?.revenue_attributed}
          color={roi == null ? 'gray' : roi >= 0 ? 'green' : 'red'}
          sub={roi != null ? (roi >= 0 ? 'vs. budget invested' : 'below break-even') : 'edit Revenue to calculate'}
          showRoiTooltip isCurrency={true} isFloat={false}
          onSave={v => saveField('revenue_attributed', v)}
        />
      </div>

      {/* Secondary metrics row — all inline-editable */}
      <div className="flex flex-wrap gap-3">
        <InlineEditPill label="Meetings Booked"     fieldValue={outcomes?.meetings_booked ?? null}    isCurrency={false} isFloat={false} onSave={v => saveField('meetings_booked', v)} />
        <InlineEditPill label="Actual Attendees"    fieldValue={outcomes?.attendees_actual ?? null}   isCurrency={false} isFloat={false} onSave={v => saveField('attendees_actual', v)} />
        <InlineEditPill label="Satisfaction Score"  fieldValue={outcomes?.satisfaction_score ?? null} isCurrency={false} isFloat={true}  max={10} onSave={v => saveField('satisfaction_score', v)} />
        <InlineEditPill label="Cost per Lead"       fieldValue={costPerLead ?? null}                  isCurrency={true}  isFloat={false} onSave={v => saveField('leads_captured', v ? Math.round(event.budget_total / v) : null)} />
        {(outcomes?.sponsorship_revenue != null || true) && (
          <InlineEditPill label="Sponsorship Revenue" fieldValue={outcomes?.sponsorship_revenue ?? null} isCurrency={true} isFloat={false} onSave={v => saveField('sponsorship_revenue', v)} />
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes</span>
          {!notesEdit && (
            <button onClick={() => { setNotesVal(outcomes?.notes ?? ''); setNotesEdit(true) }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
              </svg>
              Edit
            </button>
          )}
        </div>
        {notesEdit ? (
          <div className="space-y-2">
            <textarea
              value={notesVal}
              onChange={e => setNotesVal(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              placeholder="Add post-event notes…"
            />
            <div className="flex gap-2">
              <button onClick={saveNotes} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg">Save</button>
              <button onClick={() => setNotesEdit(false)} className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-medium">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {outcomes?.notes || <span className="text-gray-300 italic">No notes yet — click Edit to add</span>}
          </p>
        )}
      </div>

      {/* ── AI IMPORT ACTUALS ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100">
          <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <h3 className="font-semibold text-gray-900 text-sm">Import Actuals with AI</h3>
          <DataSourceBadge source={outcomes?.data_source ?? null} />
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Paste your post-event report, CRM export, debrief notes, or any text containing actual results — AI will extract the metrics for you to review before saving.
          </p>

          {!debriefPreview ? (
            <>
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
              <button
                onClick={extractDebrief}
                disabled={debriefLoading || !debriefText.trim()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {debriefLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Extracting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Extract Actuals
                  </>
                )}
              </button>
            </>
          ) : (
            /* Preview step — user reviews and optionally edits before saving */
            <div className="space-y-4">
              {debriefPreview.extraction_summary && (
                <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 text-xs text-violet-800">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>{debriefPreview.extraction_summary}</span>
                </div>
              )}

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Review extracted values — edit before confirming</p>

              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(FIELD_CONFIG) as [OutcomeField, typeof FIELD_CONFIG[OutcomeField]][]).map(([field, cfg]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{cfg.label}</label>
                    <input
                      type="number"
                      step={cfg.isFloat ? '0.1' : '1'}
                      min={0}
                      max={cfg.max}
                      value={debriefPreview[field] != null ? String(debriefPreview[field]) : ''}
                      onChange={e => setDebriefPreview(p => p ? { ...p, [field]: e.target.value === '' ? null : (cfg.isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10)) } : p)}
                      placeholder="—"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={debriefPreview.notes ?? ''}
                    onChange={e => setDebriefPreview(p => p ? { ...p, notes: e.target.value } : p)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    placeholder="Qualitative notes…"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={confirmDebrief}
                  disabled={previewSaving}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  {previewSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      Confirm &amp; Save Actuals
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDebriefPreview(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  ← Back to edit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Industry Benchmark */}
      <BenchmarkCard
        benchmark={benchmark}
        benchmarkLoading={benchmarkLoading}
        benchmarkError={benchmarkError}
        onGetBenchmark={runBenchmark}
      />
    </div>
  )
}

function BenchmarkCard({ benchmark, benchmarkLoading, benchmarkError, onGetBenchmark }: {
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
          <h3 className="font-semibold text-gray-900 text-sm">Industry Benchmark</h3>
          {benchmark?.confidence && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{benchmark.confidence} confidence</span>
          )}
        </div>
        {!benchmark && (
          <button onClick={onGetBenchmark} disabled={benchmarkLoading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {benchmarkLoading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Fetching…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>Get Industry Benchmarks</>
            )}
          </button>
        )}
      </div>

      {benchmarkError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{benchmarkError}</div>}
      {!benchmark && !benchmarkLoading && !benchmarkError && (
        <p className="text-sm text-gray-400">Compare your event performance against industry averages for this event type.</p>
      )}
      {benchmarkLoading && <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Fetching benchmarks…</div>}

      {benchmark && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <BenchmarkRow label="Pipeline Expected" value={`${formatCurrency(benchmark.pipeline_min)} – ${formatCurrency(benchmark.pipeline_max)}`} sub={`${formatK(benchmark.pipeline_min)}–${formatK(benchmark.pipeline_max)}`} />
            <BenchmarkRow label="Leads Typically Captured" value={`${benchmark.leads_min}–${benchmark.leads_max} leads`} />
            <BenchmarkRow label="Typical ROI" value={`${benchmark.roi_min}%–${benchmark.roi_max}%`} />
            <BenchmarkRow label="Cost per Lead" value={`${formatCurrency(benchmark.cost_per_lead_min)} – ${formatCurrency(benchmark.cost_per_lead_max)}`} />
          </div>
          {benchmark.basis && <div className="text-xs text-gray-500 pt-2 border-t border-gray-100"><span className="font-medium text-gray-600">Basis: </span>{benchmark.basis}</div>}
          {benchmark.caveat && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-xs text-amber-700">{benchmark.caveat}</p>
            </div>
          )}
          <button onClick={onGetBenchmark} disabled={benchmarkLoading} className="text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50">Refresh benchmarks</button>
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
