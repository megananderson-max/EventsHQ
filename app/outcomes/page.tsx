'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface EventOutcome {
  id: number
  name: string
  type: string
  status: string
  start_date: string | null
  end_date: string | null
  budget_total: number
  expected_attendees: number | null
  leads_captured: number | null
  pipeline_generated: number | null
  revenue_attributed: number | null
  sponsorship_revenue: number | null
  meetings_booked: number | null
  actual_attendees: number | null
  satisfaction_score: number | null
  data_source: string | null
  concluded: boolean
  roi: number | null
  cost_per_lead: number | null
}

interface Totals {
  total_events: number
  events_with_data: number
  events_concluded: number
  total_pipeline: number
  total_revenue: number
  total_leads: number
  avg_roi: number | null
}

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const TYPE_LABELS: Record<string, string> = {
  conference: 'Conference',
  trade_show: 'Trade Show',
  client_summit: 'Client Summit',
  sales_kickoff: 'Sales Kickoff',
  webinar: 'Webinar',
  internal_meeting: 'Internal Meeting',
}

const SOURCE_LABELS: Record<string, { label: string; cls: string }> = {
  manual: { label: 'Manual', cls: 'bg-gray-100 text-gray-600' },
  ai_import: { label: 'AI Import', cls: 'bg-violet-100 text-violet-700' },
  ai_debrief: { label: 'AI Debrief', cls: 'bg-violet-100 text-violet-700' },
  benchmark: { label: 'Estimate', cls: 'bg-amber-100 text-amber-700' },
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

function formatCurrencyFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function ROIBadge({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-xs text-gray-400">—</span>
  const color = roi >= 100 ? 'text-green-700 bg-green-50 border-green-200'
    : roi >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : 'text-red-700 bg-red-50 border-red-200'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {roi >= 0 ? '+' : ''}{Math.round(roi)}%
    </span>
  )
}

type SortKey = 'name' | 'type' | 'date' | 'budget' | 'leads' | 'pipeline' | 'revenue' | 'roi' | 'satisfaction'

function SortTh({ label, col, sortKey, sortDir, onSort, align = 'right' }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void; align?: 'left' | 'right'
}) {
  const active = sortKey === col
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && active && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        )}
        {label}
        {align === 'left' && active && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        )}
      </span>
    </th>
  )
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-200',
    green: 'from-green-500/10 to-green-600/5 border-green-200',
    violet: 'from-violet-500/10 to-violet-600/5 border-violet-200',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-200',
    gray: 'from-gray-100 to-gray-50 border-gray-200',
  }
  const textMap: Record<string, string> = {
    blue: 'text-blue-700', green: 'text-green-700', violet: 'text-violet-700',
    amber: 'text-amber-700', gray: 'text-gray-700',
  }
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.gray} border rounded-xl p-5`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${textMap[color] || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function PipelineChart({ events }: { events: EventOutcome[] }) {
  const top = [...events]
    .filter(e => e.pipeline_generated != null && e.pipeline_generated > 0)
    .sort((a, b) => (b.pipeline_generated ?? 0) - (a.pipeline_generated ?? 0))
    .slice(0, 8)

  if (top.length === 0) return (
    <div className="text-center py-8 text-gray-400 text-sm">No pipeline data to visualise yet.</div>
  )

  const maxPipeline = Math.max(...top.map(e => e.pipeline_generated ?? 0))
  const maxBudget = Math.max(...top.map(e => e.budget_total ?? 0))
  const scale = Math.max(maxPipeline, maxBudget)

  return (
    <div className="space-y-3">
      {top.map((event, i) => {
        const pipelinePct = scale > 0 ? ((event.pipeline_generated ?? 0) / scale) * 100 : 0
        const budgetPct = scale > 0 ? ((event.budget_total ?? 0) / scale) * 100 : 0
        const isEstimate = event.data_source === 'benchmark'
        return (
          <div key={event.id} className="group">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-medium text-gray-500 w-5 flex-shrink-0">{i + 1}</span>
              <Link
                href={`/events/${event.id}?tab=Outcomes`}
                className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate flex-1"
              >
                {event.name}
              </Link>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(event.end_date)}</span>
              {isEstimate && (
                <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">est.</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                {/* Pipeline bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isEstimate ? 'bg-amber-400/70 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.3)_4px,rgba(255,255,255,0.3)_8px)]' : 'bg-green-500'}`}
                      style={{ width: `${Math.max(pipelinePct, 1)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-green-700 w-16 text-right flex-shrink-0">
                    {formatCurrency(event.pipeline_generated ?? 0)}
                  </span>
                </div>
                {/* Budget bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-300"
                      style={{ width: `${Math.max(budgetPct, 1)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
                    {formatCurrency(event.budget_total ?? 0)} cost
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 flex-shrink-0" />Pipeline generated</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-gray-300 flex-shrink-0" />Event cost</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400/70 flex-shrink-0" />Benchmark estimate</span>
      </div>
    </div>
  )
}

export default function OutcomesPage() {
  const [data, setData] = useState<{ events: EventOutcome[]; totals: Totals } | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillDone, setBackfillDone] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [showChart, setShowChart] = useState(true)

  const loadData = () =>
    fetch('/api/outcomes')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))

  useEffect(() => {
    loadData()
  }, [])

  // Auto-backfill: when data loads and there are concluded events with no outcomes, generate benchmarks
  useEffect(() => {
    if (!data || backfillDone || backfilling) return
    const needsBackfill = data.totals.events_concluded > data.totals.events_with_data
    if (!needsBackfill) return

    setBackfilling(true)
    fetch('/api/outcomes/backfill', { method: 'POST' })
      .then(r => r.json())
      .then(result => {
        setBackfillDone(true)
        setBackfilling(false)
        if (result.processed > 0) {
          // Reload data now that benchmarks have been generated
          setLoading(true)
          loadData()
        }
      })
      .catch(() => setBackfilling(false))
  }, [data, backfillDone, backfilling])

  const toggle = (col: SortKey) => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('desc') }
  }

  const availableYears = useMemo(() => {
    if (!data) return []
    const years = new Set<string>()
    data.events.forEach(e => { if (e.end_date) years.add(e.end_date.slice(0, 4)) })
    return Array.from(years).sort().reverse()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.events.filter(e => {
      if (filterType && e.type !== filterType) return false
      if (filterSource) {
        if (filterSource === 'no_data' && e.data_source !== null) return false
        if (filterSource !== 'no_data' && e.data_source !== filterSource) return false
      }
      if (filterYear && (!e.end_date || !e.end_date.startsWith(filterYear))) return false
      return true
    })
  }, [data, filterType, filterSource, filterYear])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'type') cmp = a.type.localeCompare(b.type)
      else if (sortKey === 'date') cmp = (a.end_date ?? '').localeCompare(b.end_date ?? '')
      else if (sortKey === 'budget') cmp = (a.budget_total ?? 0) - (b.budget_total ?? 0)
      else if (sortKey === 'leads') cmp = (a.leads_captured ?? -1) - (b.leads_captured ?? -1)
      else if (sortKey === 'pipeline') cmp = (a.pipeline_generated ?? -1) - (b.pipeline_generated ?? -1)
      else if (sortKey === 'revenue') cmp = (a.revenue_attributed ?? -1) - (b.revenue_attributed ?? -1)
      else if (sortKey === 'roi') cmp = (a.roi ?? -999) - (b.roi ?? -999)
      else if (sortKey === 'satisfaction') cmp = (a.satisfaction_score ?? -1) - (b.satisfaction_score ?? -1)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">ROI & Outcomes</h1>
        </div>
        <div className="text-gray-400 text-sm">{backfillDone ? 'Refreshing with new estimates…' : 'Loading outcomes data…'}</div>
      </div>
    )
  }

  const totals = data?.totals
  const events = data?.events ?? []

  return (
    <div className="p-8 max-w-7xl">
      {/* Backfill progress banner */}
      {backfilling && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-5">
          <svg className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <div>
            <span className="text-sm font-semibold text-amber-900">Generating benchmark estimates…</span>
            <span className="text-sm text-amber-700 ml-2">Asking AI for industry ROI ranges for your concluded events. This takes a few seconds.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ROI & Outcomes</h1>
            <p className="text-sm text-gray-500">
              {totals?.events_with_data ?? 0} of {totals?.events_concluded ?? 0} concluded events have data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Benchmark estimate
            </span>
            <span className="flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />AI extracted
            </span>
            <span className="flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Manual
            </span>
          </div>
          {sorted.length > 0 && (
            <button
              onClick={() => {
                const headers = ['Event Name', 'Type', 'Concluded Date', 'Budget', 'Leads Captured', 'Pipeline Generated', 'Revenue Attributed', 'ROI%', 'Satisfaction Score', 'Data Source']
                const rows = sorted.map(e => [
                  e.name,
                  TYPE_LABELS[e.type] || e.type,
                  e.end_date || '',
                  String(e.budget_total ?? ''),
                  String(e.leads_captured ?? ''),
                  String(e.pipeline_generated ?? ''),
                  String(e.revenue_attributed ?? ''),
                  e.roi != null ? String(Math.round(e.roi)) : '',
                  e.satisfaction_score != null ? String(e.satisfaction_score) : '',
                  SOURCE_LABELS[e.data_source ?? '']?.label || e.data_source || '',
                ])
                downloadCSV('outcomes.csv', rows, headers)
              }}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="Total Pipeline"
          value={totals?.total_pipeline ? formatCurrency(totals.total_pipeline) : '—'}
          sub="across all events with data"
          color="green"
        />
        <KPICard
          label="Total Revenue"
          value={totals?.total_revenue ? formatCurrency(totals.total_revenue) : '—'}
          sub="attributed to events"
          color="blue"
        />
        <KPICard
          label="Total Leads"
          value={totals?.total_leads ? totals.total_leads.toLocaleString() : '—'}
          sub="captured across events"
          color="violet"
        />
        <KPICard
          label="Average ROI"
          value={totals?.avg_roi != null ? `${totals.avg_roi >= 0 ? '+' : ''}${Math.round(totals.avg_roi)}%` : '—'}
          sub="return on investment"
          color={totals?.avg_roi != null && totals.avg_roi >= 0 ? 'green' : 'amber'}
        />
        <KPICard
          label="Data Coverage"
          value={totals ? `${totals.events_with_data}/${totals.events_concluded}` : '—'}
          sub="events with outcomes logged"
          color="amber"
        />
      </div>

      {/* Pipeline Visualisation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <button
          onClick={() => setShowChart(v => !v)}
          className="w-full flex items-center gap-2 px-6 py-4 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors"
        >
          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showChart ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-gray-900">Pipeline vs Cost — Top Events</span>
          <span className="text-xs text-gray-400 font-normal ml-1">click to {showChart ? 'collapse' : 'expand'}</span>
        </button>
        {showChart && (
          <div className="p-6">
            <PipelineChart events={events} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">All event types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">All years</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">All data sources</option>
          <option value="manual">Manual</option>
          <option value="ai_debrief">AI Debrief</option>
          <option value="ai_import">AI Import</option>
          <option value="benchmark">Benchmark estimates</option>
          <option value="no_data">No data yet</option>
        </select>
        {(filterType || filterYear || filterSource) && (
          <button
            onClick={() => { setFilterType(''); setFilterYear(''); setFilterSource('') }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{sorted.length} event{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <SortTh label="Event" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="left" />
                <SortTh label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="left" />
                <SortTh label="Concluded" col="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="left" />
                <SortTh label="Budget" col="budget" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Leads" col="leads" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Pipeline" col="pipeline" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Revenue" col="revenue" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="ROI" col="roi" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Sat. Score" col="satisfaction" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No events match your filters</p>
                      <p className="text-gray-400 text-xs">Outcomes are tracked for events with an end date. Concluded events get benchmark estimates automatically.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map(event => {
                  const isEstimate = event.data_source === 'benchmark'
                  const hasData = event.data_source !== null
                  return (
                    <tr key={event.id} className={`hover:bg-gray-50 transition-colors ${isEstimate ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/events/${event.id}?tab=Outcomes`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                        >
                          {event.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{TYPE_LABELS[event.type] || event.type}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(event.end_date)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
                        {event.budget_total ? formatCurrencyFull(event.budget_total) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasData && event.leads_captured != null ? (
                          <span className={`font-semibold ${isEstimate ? 'text-amber-700' : 'text-gray-800'}`}>
                            {event.leads_captured.toLocaleString()}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasData && event.pipeline_generated != null ? (
                          <span className={`font-semibold ${isEstimate ? 'text-amber-700' : 'text-green-700'}`}>
                            {formatCurrencyFull(event.pipeline_generated)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasData && event.revenue_attributed != null ? (
                          <span className={`font-semibold ${isEstimate ? 'text-amber-700' : 'text-blue-700'}`}>
                            {formatCurrencyFull(event.revenue_attributed)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ROIBadge roi={event.roi} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasData && event.satisfaction_score != null ? (
                          <span className={`text-xs font-medium ${event.satisfaction_score >= 8 ? 'text-green-600' : event.satisfaction_score >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {event.satisfaction_score}/10
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {event.data_source ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_LABELS[event.data_source]?.cls || 'bg-gray-100 text-gray-600'}`}>
                            {SOURCE_LABELS[event.data_source]?.label || event.data_source}
                          </span>
                        ) : (
                          event.concluded ? (
                            <Link
                              href={`/events/${event.id}?tab=Outcomes`}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                            >
                              Log outcomes →
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-300">Upcoming</span>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      {events.some(e => e.data_source === 'benchmark') && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Rows highlighted in amber are AI benchmark estimates — click the event to update with actual figures.
        </p>
      )}
    </div>
  )
}
