'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SortTh } from '@/app/components/SortTh'

interface Event {
  id: number
  name: string
  type: string
  status: string
  start_date: string
  end_date: string
  location: string
  venue: string
  expected_attendees: number
  budget_total: number
  description: string
}

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-yellow-100 text-yellow-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  active: 'bg-green-100 text-green-800',
  complete: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
}

const TYPE_LABELS: Record<string, string> = {
  conference: 'Conference',
  trade_show: 'Trade Show',
  client_summit: 'Client Summit',
  sales_kickoff: 'Sales Kickoff',
  webinar: 'Webinar',
  internal_meeting: 'Internal Meeting',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

import type { SortDir } from '@/app/components/SortTh'

type SortKey = 'date' | 'budget' | 'status' | 'name' | 'type' | 'location'

const STATUS_ORDER: Record<string, number> = { active: 0, planning: 1, pending_approval: 2, complete: 3, cancelled: 4 }

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [revertConfirm, setRevertConfirm] = useState<{ id: number; name: string; destination: 'pipeline' | 'under_review' } | null>(null)

  type BadgeData = { id: number; blocked_tasks: number; overdue_tasks: number; over_budget_items: number; missing_outcomes: number }
  const [badgeMap, setBadgeMap] = useState<Record<number, BadgeData>>({})

  const fetchEvents = () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (typeFilter) params.set('type', typeFilter)
    fetch(`/api/events?${params}`)
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchEvents() }, [statusFilter, typeFilter])

  useEffect(() => {
    fetch('/api/events/summary-badges')
      .then(r => r.json())
      .then(setBadgeMap)
      .catch(() => {})
  }, [])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const [yearFilter, setYearFilter] = useState('')
  const [hideComplete, setHideComplete] = useState(false)

  useEffect(() => {
    setHideComplete(localStorage.getItem('eventsHideComplete') === '1')
  }, [])

  const availableYears = [...new Set(
    events.map(e => e.start_date ? e.start_date.slice(0, 4) : null).filter(Boolean)
  )].sort() as string[]

  const sorted = [...events]
    .filter(e => !yearFilter || (e.start_date || '').startsWith(yearFilter))
    .filter(e => !hideComplete || e.status !== 'complete')
    .filter(e => !searchFilter || e.name.toLowerCase().includes(searchFilter.toLowerCase()) || (e.location || '').toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = (a.start_date || '').localeCompare(b.start_date || '')
      else if (sortKey === 'budget') cmp = (a.budget_total || 0) - (b.budget_total || 0)
      else if (sortKey === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'type') cmp = (a.type || '').localeCompare(b.type || '')
      else if (sortKey === 'location') cmp = (a.location || '').localeCompare(b.location || '')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openMenu === null) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  const moveEvent = async (id: number, destination: 'pipeline' | 'under_review') => {
    setOpenMenu(null)
    setRevertConfirm(null)
    const res = await fetch(`/api/events/${id}?destination=${destination}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.reverted) {
      router.push(destination === 'pipeline' ? '/opportunities' : '/opportunities?tab=under_review')
    } else fetchEvents()
  }

  const requestRevert = (event: Event, destination: 'pipeline' | 'under_review') => {
    setOpenMenu(null)
    setRevertConfirm({ id: event.id, name: event.name, destination })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">Manage all your corporate events</p>
        </div>
        <div className="flex items-center gap-2">
          {sorted.length > 0 && (
            <button
              onClick={() => {
                const headers = ['Name', 'Type', 'Status', 'Start Date', 'End Date', 'Location', 'Budget Total']
                const rows = sorted.map(e => [
                  e.name,
                  TYPE_LABELS[e.type] || e.type,
                  STATUS_LABELS[e.status] || e.status,
                  e.start_date || '',
                  e.end_date || '',
                  e.location || '',
                  String(e.budget_total ?? ''),
                ])
                downloadCSV('events.csv', rows, headers)
              }}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export CSV
            </button>
          )}
          <Link
            href="/events/new"
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Event
          </Link>
        </div>
      </div>

      {/* Year toggle */}
      {availableYears.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Year</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setYearFilter('')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${!yearFilter ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              All
            </button>
            {availableYears.map(y => (
              <button
                key={y}
                onClick={() => setYearFilter(yearFilter === y ? '' : y)}
                className={`px-3 py-1.5 text-sm font-medium border-l border-gray-200 transition-colors ${yearFilter === y ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="planning">Planning</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="active">Active</option>
          <option value="complete">Complete</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="conference">Conference</option>
          <option value="trade_show">Trade Show</option>
          <option value="client_summit">Client Summit</option>
          <option value="sales_kickoff">Sales Kickoff</option>
          <option value="webinar">Webinar</option>
          <option value="internal_meeting">Internal Meeting</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideComplete}
            onChange={e => { setHideComplete(e.target.checked); localStorage.setItem('eventsHideComplete', e.target.checked ? '1' : '0') }}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
          />
          Hide completed
        </label>
        {(statusFilter || typeFilter || searchFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter(''); setSearchFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Clear filters
          </button>
        )}
        {sorted.length !== events.length && !yearFilter && (
          <span className="text-xs text-gray-400 self-center">Showing {sorted.length} of {events.length}</span>
        )}
        {yearFilter && (
          <span className="text-xs text-gray-400 self-center">{sorted.length} event{sorted.length !== 1 ? 's' : ''} in {yearFilter}</span>
        )}
      </div>

      {/* Revert Confirmation Modal */}
      {revertConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Revert to Opportunity?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will move <span className="font-medium text-gray-700">{revertConfirm.name}</span> back to the Opportunities {revertConfirm.destination === 'pipeline' ? 'pipeline' : 'Under Review'} queue. Any planning, budget items, and vendors added to this event will remain but the event will no longer appear in your active events list.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setRevertConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => moveEvent(revertConfirm.id, revertConfirm.destination)}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
              >
                Revert to {revertConfirm.destination === 'pipeline' ? 'Pipeline' : 'Under Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <SortTh label="Name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Location" col="location" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Budget" col="budget" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No events found.{' '}
                  <Link href="/events/new" className="text-blue-500 hover:underline">Create your first event</Link>
                </td>
              </tr>
            ) : (
              sorted.map(event => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/events/${event.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {event.name}
                    </Link>
                    {event.venue && <div className="text-xs text-gray-400 mt-0.5">{event.venue}</div>}
                    {badgeMap[event.id] && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {badgeMap[event.id].blocked_tasks > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⚠ {badgeMap[event.id].blocked_tasks} blocked</span>
                        )}
                        {badgeMap[event.id].overdue_tasks > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{badgeMap[event.id].overdue_tasks} overdue</span>
                        )}
                        {badgeMap[event.id].over_budget_items > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Over budget</span>
                        )}
                        {badgeMap[event.id].missing_outcomes > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">No outcomes</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{TYPE_LABELS[event.type] || event.type}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[event.status] || event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(event.start_date)}
                    {event.end_date && event.end_date !== event.start_date && (
                      <span className="text-gray-400"> – {formatDate(event.end_date)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{event.location || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right font-medium">{formatCurrency(event.budget_total)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/events/${event.id}`} className="text-blue-500 hover:text-blue-700 text-sm font-medium">View</Link>
                      <div className="relative" ref={openMenu === event.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenu(openMenu === event.id ? null : event.id)}
                          title="Revert this event back to the Opportunities pipeline"
                          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm font-medium"
                        >
                          Revert to
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {openMenu === event.id && (
                          <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                            <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">Revert event to Opportunities</div>
                            <button
                              onClick={() => requestRevert(event, 'pipeline')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Revert to Pipeline
                            </button>
                            <button
                              onClick={() => requestRevert(event, 'under_review')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Revert to Under Review
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

