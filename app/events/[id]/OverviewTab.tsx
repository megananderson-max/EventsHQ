'use client'

import { useState, useEffect, useRef } from 'react'
import { Event, EventStatusBadge, EVENT_TYPE_LABELS } from './types'

interface BudgetItem {
  id: number
  category: string
  planned_amount: number
  actual_amount: number
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  venue: 'bg-blue-500',
  catering: 'bg-green-500',
  av_tech: 'bg-purple-500',
  staffing: 'bg-orange-500',
  marketing: 'bg-pink-500',
  transport: 'bg-cyan-500',
  hotel: 'bg-indigo-500',
  misc: 'bg-gray-400',
}

export default function OverviewTab({ event, onUpdate, onTabChange }: { event: Event; onUpdate: () => void; onTabChange?: (tab: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [form, setForm] = useState({ ...event, budget_total: event.budget_total?.toString() || '0', expected_attendees: event.expected_attendees?.toString() || '' })
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [vendorCount, setVendorCount] = useState(0)
  const [taskStats, setTaskStats] = useState({ done: 0, total: 0 })

  // Undo complete toast
  const [completeToast, setCompleteToast] = useState(false)
  const [pendingCompleteForm, setPendingCompleteForm] = useState<typeof form | null>(null)
  const [previousStatus, setPreviousStatus] = useState<string | null>(null)
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Change 1 — status-transition banner state
  const [today, setToday] = useState('')
  const [statusBannerDismissed, setStatusBannerDismissed] = useState(false)
  const [markingComplete, setMarkingComplete] = useState(false)

  // Change 2 — outcomes nudge state
  const [hasOutcomes, setHasOutcomes] = useState(false)
  const [outcomeNudgeDismissed, setOutcomeNudgeDismissed] = useState(false)

  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    fetch(`/api/events/${event.id}/budget`).then(r => r.json()).then(setBudgetItems).catch(() => {})
    fetch(`/api/events/${event.id}/vendors`).then(r => r.json()).then((data: unknown[]) => setVendorCount(data.length)).catch(() => {})
    fetch(`/api/events/${event.id}/planning`).then(r => r.json()).then((data: Array<{done: number}>) => {
      setTaskStats({ done: data.filter(t => t.done).length, total: data.length })
    }).catch(() => {})
    fetch(`/api/events/${event.id}/outcomes`).then(r => r.json()).then((data: { attendees_actual?: number | null; pipeline_generated?: number | null; revenue_attributed?: number | null; satisfaction_score?: number | null }) => {
      setHasOutcomes(!!(data && (data.attendees_actual || data.pipeline_generated || data.revenue_attributed || data.satisfaction_score)))
    }).catch(() => {})
  }, [event.id])

  const totalPlanned = budgetItems.reduce((s, i) => s + (i.planned_amount || 0), 0)
  const totalActual = budgetItems.reduce((s, i) => s + (i.actual_amount || 0), 0)
  const budgetUsedPct = event.budget_total > 0 ? Math.round((totalActual / event.budget_total) * 100) : 0

  // Category breakdown
  const categories: Record<string, { planned: number; actual: number }> = {}
  for (const item of budgetItems) {
    if (!categories[item.category]) categories[item.category] = { planned: 0, actual: 0 }
    categories[item.category].planned += item.planned_amount || 0
    categories[item.category].actual += item.actual_amount || 0
  }
  const maxPlanned = Math.max(...Object.values(categories).map(c => c.planned), 1)

  const executeSave = async (formToSave: typeof form) => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formToSave,
          budget_total: parseFloat(formToSave.budget_total) || 0,
          expected_attendees: formToSave.expected_attendees ? parseInt(formToSave.expected_attendees) : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onUpdate()
      setEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    setDateError(null)
    setSaveError(null)
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      setDateError('End date must be on or after the start date.')
      return
    }

    // If changing TO complete, show a 10-second undo toast before saving
    if (form.status === 'complete' && event.status !== 'complete') {
      setPreviousStatus(event.status)
      setPendingCompleteForm({ ...form })
      setCompleteToast(true)
      setEditing(false)
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
      completeTimerRef.current = setTimeout(async () => {
        setCompleteToast(false)
        await executeSave({ ...form })
        setPendingCompleteForm(null)
        setPreviousStatus(null)
      }, 10000)
      return
    }

    await executeSave(form)
  }

  const undoComplete = () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
    setCompleteToast(false)
    // Revert form status back to previous
    if (previousStatus !== null) {
      setForm(f => ({ ...f, status: previousStatus }))
    }
    setPendingCompleteForm(null)
    setPreviousStatus(null)
    setEditing(true)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  if (editing) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Edit Event</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="conference">Conference</option>
                <option value="trade_show">Trade Show</option>
                <option value="client_summit">Client Summit</option>
                <option value="sales_kickoff">Sales Kickoff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="planning">Planning</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={form.start_date || ''} onChange={e => { set('start_date', e.target.value); setDateError(null) }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={form.end_date || ''} onChange={e => { set('end_date', e.target.value); setDateError(null) }} min={form.start_date || undefined} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${dateError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'}`} />
            </div>
          </div>
          {dateError && <p className="text-xs text-red-600 -mt-2">{dateError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input value={form.location || ''} onChange={e => set('location', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <input value={form.venue || ''} onChange={e => set('venue', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Attendees</label>
              <input type="number" value={form.expected_attendees || ''} onChange={e => set('expected_attendees', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget ($)</label>
              <input type="number" value={form.budget_total} onChange={e => set('budget_total', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-700 mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Review Notes
            </label>
            <textarea value={form.review_notes || ''} onChange={e => set('review_notes', e.target.value)} rows={3} placeholder="Notes from the review process…" className="w-full border border-amber-200 bg-amber-50/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder-gray-400" />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-3 items-center">
              <button onClick={save} disabled={saving} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium">Cancel</button>
              {saveSuccess && (
                <span className="text-sm text-green-600 font-medium transition-opacity">Saved ✓</span>
              )}
            </div>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Derived flags for the two banners
  const eventEnded = !!(today && event.end_date && event.end_date < today)
  const showStatusBanner = eventEnded && !statusBannerDismissed && (event.status === 'planning' || event.status === 'active')
  const showOutcomeNudge = eventEnded && !showStatusBanner && !outcomeNudgeDismissed && !hasOutcomes

  return (
    <div className="space-y-6">
      {/* Change 1 — Auto-suggest status transition when event has ended */}
      {showStatusBanner && (
        <div className="flex items-center gap-4 bg-yellow-50 border border-yellow-300 rounded-xl px-5 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-yellow-900">
              This event ended on {formatDate(event.end_date)} — ready to mark it as complete?
            </p>
          </div>
          <button
            onClick={async () => {
              setMarkingComplete(true)
              try {
                const res = await fetch(`/api/events/${event.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'complete' }),
                })
                if (!res.ok) throw new Error('Failed')
                onUpdate()
              } catch {
                // silently ignore — status remains unchanged
              } finally {
                setMarkingComplete(false)
              }
            }}
            disabled={markingComplete}
            className="flex-shrink-0 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
          >
            {markingComplete && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            Mark Complete
          </button>
          <button
            onClick={() => setStatusBannerDismissed(true)}
            className="flex-shrink-0 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Not yet
          </button>
        </div>
      )}

      {/* Change 2 — Post-event Outcomes nudge */}
      {showOutcomeNudge && (
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
          <div className="flex-shrink-0 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">Post-event: Log your outcomes to measure ROI</p>
          </div>
          <a href="?tab=outcomes" className="flex-shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900">
            Go to Outcomes →
          </a>
          <button
            onClick={() => setOutcomeNudgeDismissed(true)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Review Notes — prominent card shown when notes exist */}
      {event.review_notes && (
        <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Review Notes</p>
            <p className="text-sm text-amber-900 leading-relaxed">{event.review_notes}</p>
          </div>
          <button onClick={() => setEditing(true)} className="flex-shrink-0 text-amber-500 hover:text-amber-700 text-xs font-medium flex items-center gap-1 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        </div>
      )}

      {/* Event Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Event Details</h2>
          <button onClick={() => setEditing(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <InfoRow label="Name" value={event.name} />
          <InfoRow label="Type" value={EVENT_TYPE_LABELS[event.type] || event.type} />
          <InfoRow label="Status" value={<EventStatusBadge status={event.status} />} />
          <InfoRow label="Start Date" value={formatDate(event.start_date)} />
          <InfoRow label="End Date" value={formatDate(event.end_date)} />
          <InfoRow label="Location" value={event.location || '—'} />
          <InfoRow label="Venue" value={event.venue || '—'} />
          <InfoRow label="Expected Attendees" value={event.expected_attendees ? event.expected_attendees.toLocaleString() : '—'} />
          <InfoRow label="Total Budget" value={formatCurrency(event.budget_total || 0)} />
          {event.description && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</dt>
              <dd className="text-sm text-gray-800">{event.description}</dd>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Budget Used" value={`${budgetUsedPct}%`} sub={`${formatCurrency(totalActual)} of ${formatCurrency(event.budget_total || 0)}`} color={budgetUsedPct > 100 ? 'red' : 'green'} onClick={() => onTabChange?.('Budget')} hint="View Budget →" />
        <MetricCard label="Vendors" value={vendorCount.toString()} sub="attached to event" color="blue" onClick={() => onTabChange?.('Vendors')} hint="View Vendors →" />
        <MetricCard label="Tasks Done" value={`${taskStats.total ? Math.round((taskStats.done / taskStats.total) * 100) : 0}%`} sub={`${taskStats.done} of ${taskStats.total} tasks`} color="purple" onClick={() => onTabChange?.('Planning')} hint="View Planning →" />
      </div>

      {/* Budget Breakdown */}
      {Object.keys(categories).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Budget by Category</h2>
          <div className="space-y-4">
            {Object.entries(categories).sort((a, b) => b[1].planned - a[1].planned).map(([cat, vals]) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat] || 'bg-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-700 capitalize">{cat.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Planned: {formatCurrency(vals.planned)}</span>
                    <span className={vals.actual > vals.planned ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      Actual: {formatCurrency(vals.actual)}
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`absolute h-full rounded-full ${CATEGORY_COLORS[cat] || 'bg-gray-400'} opacity-30`}
                    style={{ width: `${(vals.planned / maxPlanned) * 100}%` }}
                  />
                  <div
                    className={`absolute h-full rounded-full ${vals.actual > vals.planned ? 'bg-red-500' : CATEGORY_COLORS[cat] || 'bg-gray-400'}`}
                    style={{ width: `${Math.min((vals.actual / maxPlanned) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Undo Complete Toast */}
      {completeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg whitespace-nowrap">
          <span>Event marked as complete</span>
          <span className="text-gray-500 mx-1">&middot;</span>
          <button
            onClick={undoComplete}
            className="font-semibold text-blue-300 hover:text-blue-200 underline underline-offset-2"
          >
            Undo
          </button>
          <button
            onClick={() => {
              if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
              setCompleteToast(false)
              if (pendingCompleteForm) executeSave(pendingCompleteForm)
              setPendingCompleteForm(null)
              setPreviousStatus(null)
            }}
            className="text-gray-400 hover:text-gray-200 ml-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}

function MetricCard({ label, value, sub, color, onClick, hint }: { label: string; value: string; sub: string; color: string; onClick?: () => void; hint?: string }) {
  const colorMap: Record<string, string> = {
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center w-full transition-all ${onClick ? 'hover:border-blue-300 hover:shadow-md cursor-pointer group' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
      {hint && <p className="text-[10px] text-blue-400 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">{hint}</p>}
    </Tag>
  )
}
