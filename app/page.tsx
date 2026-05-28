'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { SortTh, useSortState } from '@/app/components/SortTh'
import SetupPreferencesModal from '@/app/components/SetupPreferencesModal'

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
  created_at: string
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
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Opportunity {
  id: number
  name: string
  start_date: string | null
  location: string | null
  budget_estimate_low: number | null
  budget_estimate_high: number | null
  strategic_fit: string
  recommendation: string
  organizer: string | null
  review_notes: string | null
  status: string
}

interface PlanningItem {
  id: number
  event_id: number
  title: string
  status: string
  assigned_to: string | null
  due_date: string | null
}

interface TeamMember {
  id: number
  name: string
  first_name: string | null
  last_name: string | null
  is_me: number
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [showWorkflowBanner, setShowWorkflowBanner] = useState(false)
  const [showRecentEvents, setShowRecentEvents] = useState(true)
  const [hideCompletedEvents, setHideCompletedEvents] = useState(false)
  const [showUnderReview, setShowUnderReview] = useState(true)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [prefsConfigured, setPrefsConfigured] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [eventsNeedingOutcomes, setEventsNeedingOutcomes] = useState<Event[]>([])
  const [dismissedOutcomePrompt, setDismissedOutcomePrompt] = useState(false)
  const [myOverdueTasks, setMyOverdueTasks] = useState(0)
  const [dismissedTaskBanner, setDismissedTaskBanner] = useState(false)

  useEffect(() => {
    setHideCompletedEvents(localStorage.getItem('dashHideComplete') === '1')
  }, [])

  useEffect(() => {
    if (localStorage.getItem('workflowBannerDismissed') !== '1') setShowWorkflowBanner(true)
  }, [])

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then((data: Event[]) => {
        setEvents(data)
        setLoading(false)
        // Compute events needing outcomes
        const today = new Date().toISOString().split('T')[0]
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const needsOutcomes = data.filter(e =>
          e.end_date &&
          e.end_date < today &&
          e.end_date > thirtyDaysAgo &&
          (e.status === 'active' || e.status === 'complete' || e.status === 'planning') &&
          !(e as Event & { post_event_completed?: number }).post_event_completed
        )
        setEventsNeedingOutcomes(needsOutcomes)
      })
      .catch(() => setLoading(false))

    Promise.all([
      fetch('/api/opportunities').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ])
      .then(([oppData, s]) => {
        const opps = oppData.opportunities || []
        setOpportunities(opps)
        const configured = s.opp_prefs_configured === 'true'
        setPrefsConfigured(configured)
        setPrefsLoaded(true)
        // Only auto-show setup modal when prefs aren't configured AND no opportunities yet
        if (!configured && opps.length === 0) setShowSetupModal(true)
      })
      .catch(() => {
        // Fetch failed — treat as not configured so modal can appear if needed
        setPrefsLoaded(true)
      })

    Promise.all([
      fetch('/api/planning').then(r => r.json()),
      fetch('/api/team-members').then(r => r.json()),
    ])
      .then(([planningData, teamData]: [PlanningItem[], TeamMember[]]) => {
        const me = teamData.find(m => m.is_me === 1)
        if (!me) return
        const myName = [me.first_name, me.last_name].filter((v): v is string => Boolean(v)).join(' ') || me.name
        const today = new Date().toISOString().split('T')[0]
        const overdue = planningData.filter(item =>
          item.status !== 'complete' &&
          item.due_date !== null &&
          item.due_date <= today &&
          item.assigned_to === myName
        )
        setMyOverdueTasks(overdue.length)
      })
      .catch(() => {})
  }, [])

  const FIT_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
  const STATUS_ORDER: Record<string, number> = { active: 0, planning: 1, pending_approval: 2, complete: 3, cancelled: 4 }

  const { sortKey: evtKey, sortDir: evtDir, toggle: evtToggle } = useSortState<'name' | 'type' | 'status' | 'date' | 'location' | 'budget'>('date')
  const { sortKey: oppKey, sortDir: oppDir, toggle: oppToggle } = useSortState<'name' | 'organizer' | 'date' | 'location' | 'fit'>('date')

  const highFitPipeline = opportunities.filter(o => o.strategic_fit === 'High' && o.status === 'pipeline')

  const underReview = [...opportunities.filter(o => o.status === 'pending_approval')].sort((a, b) => {
    let cmp = 0
    if (oppKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (oppKey === 'organizer') cmp = (a.organizer || '').localeCompare(b.organizer || '')
    else if (oppKey === 'date') cmp = (a.start_date || '').localeCompare(b.start_date || '')
    else if (oppKey === 'location') cmp = (a.location || '').localeCompare(b.location || '')
    else if (oppKey === 'fit') cmp = (FIT_ORDER[a.strategic_fit] ?? 9) - (FIT_ORDER[b.strategic_fit] ?? 9)
    return oppDir === 'asc' ? cmp : -cmp
  })

  const recentEvents = [...events].sort((a, b) => {
    let cmp = 0
    if (evtKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (evtKey === 'type') cmp = (a.type || '').localeCompare(b.type || '')
    else if (evtKey === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    else if (evtKey === 'date') cmp = (a.start_date || '').localeCompare(b.start_date || '')
    else if (evtKey === 'location') cmp = (a.location || '').localeCompare(b.location || '')
    else if (evtKey === 'budget') cmp = (a.budget_total || 0) - (b.budget_total || 0)
    return evtDir === 'asc' ? cmp : -cmp
  }).slice(0, 8)

  const totalUnderReviewEstimate = underReview.reduce((sum, o) => {
    const est = o.budget_estimate_high != null && o.budget_estimate_low != null
      ? (o.budget_estimate_high + o.budget_estimate_low) / 2
      : (o.budget_estimate_high ?? o.budget_estimate_low ?? 0)
    return sum + est
  }, 0)

  return (
    <div className="p-8">
      {prefsLoaded && showSetupModal && (
        <SetupPreferencesModal
          onClose={() => setShowSetupModal(false)}
          onSaved={() => { setPrefsConfigured(true); setShowSetupModal(false) }}
          closeLabel="Skip for now"
          isFirstTime={!prefsConfigured}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          {!showWorkflowBanner && (
            <button
              onClick={() => setShowWorkflowBanner(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              How this works
            </button>
          )}
        </div>
      </div>
      {showWorkflowBanner && (
        <div className="mb-6 flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900 mb-1">How this app works</p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-blue-700">
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">1</span> Set your <strong>Search Preferences</strong> so the AI knows your company &amp; goals</span>
              <svg className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">2</span> AI finds &amp; scores <strong>Opportunities</strong> — move the best ones to Under Review</span>
              <svg className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">3</span> <strong>Confirm</strong> to create an Event — AI auto-fills budget, tasks &amp; vendors</span>
            </div>
          </div>
          <button
            onClick={() => { setShowWorkflowBanner(false); localStorage.setItem('workflowBannerDismissed', '1') }}
            className="text-blue-400 hover:text-blue-600 flex-shrink-0 ml-2"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Quarterly Snapshot */}
      <QuarterSnapshot events={events} opportunities={opportunities} loading={loading} />

      {/* Today's Tasks Banner */}
      {myOverdueTasks > 0 && !dismissedTaskBanner && (
        <div className="mb-4 flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">
              You have {myOverdueTasks} task{myOverdueTasks !== 1 ? 's' : ''} due today or overdue
            </p>
            <Link href="/notifications" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View My Tasks →
            </Link>
          </div>
          <button
            onClick={() => setDismissedTaskBanner(true)}
            className="text-blue-400 hover:text-blue-600 flex-shrink-0 ml-2"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Post-Event Outcome Prompts */}
      {eventsNeedingOutcomes.length > 0 && !dismissedOutcomePrompt && (
        <div className="mb-4 flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {eventsNeedingOutcomes.length} event{eventsNeedingOutcomes.length !== 1 ? 's' : ''} ended recently — ready to log outcomes?
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {eventsNeedingOutcomes.slice(0, 2).map(e => e.name).join(' · ')}
              {eventsNeedingOutcomes.length > 2 ? ` · +${eventsNeedingOutcomes.length - 2} more` : ''}
            </p>
          </div>
          <Link
            href={`/events/${eventsNeedingOutcomes[0].id}?tab=outcomes`}
            className="flex-shrink-0 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Log Outcomes →
          </Link>
          <button
            onClick={() => setDismissedOutcomePrompt(true)}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0 ml-1"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Recent Events Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <button
            onClick={() => setShowRecentEvents(v => !v)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showRecentEvents ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="font-semibold text-gray-900">Recent Events</h2>
          </button>
          {showRecentEvents && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none flex-shrink-0">
              <input
                type="checkbox"
                checked={hideCompletedEvents}
                onChange={e => { setHideCompletedEvents(e.target.checked); localStorage.setItem('dashHideComplete', e.target.checked ? '1' : '0') }}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
              />
              Hide completed
            </label>
          )}
          <Link href="/events" className="text-blue-500 hover:text-blue-600 text-sm font-medium flex-shrink-0">View all</Link>
        </div>
        {showRecentEvents && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <SortTh label="Event" col="name" sortKey={evtKey} sortDir={evtDir} onSort={evtToggle} align="left" />
                  <SortTh label="Type" col="type" sortKey={evtKey} sortDir={evtDir} onSort={evtToggle} align="left" />
                  <SortTh label="Status" col="status" sortKey={evtKey} sortDir={evtDir} onSort={evtToggle} align="left" />
                  <SortTh label="Date" col="date" sortKey={evtKey} sortDir={evtDir} onSort={evtToggle} align="left" />
                  <SortTh label="Location" col="location" sortKey={evtKey} sortDir={evtDir} onSort={evtToggle} align="left" />
                  <SortTh label="Budget" col="budget" sortKey={evtKey} sortDir={evtDir} onSort={evtToggle} align="right" />
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading...</td>
                  </tr>
                ) : recentEvents.filter(e => !hideCompletedEvents || e.status !== 'complete').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      {hideCompletedEvents && recentEvents.length > 0 ? 'All events are complete.' : <>No events yet.{' '}<Link href="/events/new" className="text-blue-500 hover:underline">Create your first event</Link></>}
                    </td>
                  </tr>
                ) : (
                  recentEvents.filter(e => !hideCompletedEvents || e.status !== 'complete').map(event => (
                    <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/events/${event.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {event.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{TYPE_LABELS[event.type] || event.type}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[event.status] || event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(event.start_date)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{event.location || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right font-medium">{formatCurrency(event.budget_total)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/events/${event.id}`} className="text-blue-500 hover:text-blue-700 text-sm font-medium">View</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Under Review — compact summary card linking to the full tab */}
      {underReview.length > 0 && (
        <Link
          href="/opportunities?tab=under_review"
          className="group block bg-white rounded-xl border border-amber-200 hover:border-amber-400 shadow-sm mt-8 px-6 py-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Under Review</span>
                  <span className="text-xs bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full">{underReview.length}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {underReview.slice(0, 3).map(o => o.name).join(' · ')}
                  {underReview.length > 3 ? ` · +${underReview.length - 3} more` : ''}
                </p>
                {totalUnderReviewEstimate > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">Est. budget: {formatCurrency(totalUnderReviewEstimate)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 group-hover:text-amber-700">
              Review all
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </Link>
      )}

      {/* High-Fit Pipeline Opportunities */}
      {highFitPipeline.length > 0 && (
        <Link
          href="/opportunities?tab=opportunities"
          className="group block bg-white rounded-xl border border-violet-200 hover:border-violet-400 shadow-sm mt-4 px-6 py-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">High-Fit Opportunities</span>
                  <span className="text-xs bg-violet-500 text-white font-bold px-1.5 py-0.5 rounded-full">{highFitPipeline.length}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {highFitPipeline.slice(0, 3).map(o => o.name).join(' · ')}
                  {highFitPipeline.length > 3 ? ` · +${highFitPipeline.length - 3} more` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-violet-600 group-hover:text-violet-700">
              Review all
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}

// Generate quarters from `back` quarters before current through `fwd` quarters ahead
function buildQuarters(back = 4, fwd = 6) {
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3)
  const currentY = now.getFullYear()

  let q = currentQ - back
  let y = currentY
  while (q < 0) { q += 4; y-- }

  const total = back + 1 + fwd
  const quarters = []
  for (let i = 0; i < total; i++) {
    const startMonth = q * 3
    const endMonth = startMonth + 2
    const lastDay = new Date(y, endMonth + 1, 0).getDate()
    quarters.push({
      label: `Q${q + 1} ${y}`,
      startDate: `${y}-${String(startMonth + 1).padStart(2, '0')}-01`,
      endDate: `${y}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      isCurrent: q === currentQ && y === currentY,
    })
    q++
    if (q > 3) { q = 0; y++ }
  }
  return quarters
}

function QuarterSnapshot({ events, opportunities, loading }: { events: Event[]; opportunities: Opportunity[]; loading: boolean }) {
  const [quarters, setQuarters] = useState<ReturnType<typeof buildQuarters>>([])
  const [windowStart, setWindowStart] = useState(0)
  const [today, setToday] = useState('')
  const [currentYear, setCurrentYear] = useState(0)
  const [showDetails, setShowDetails] = useState(false)

  // Initialise date-dependent values client-side only to avoid hydration mismatch
  useEffect(() => {
    const q = buildQuarters(4, 8)
    const currentIdx = q.findIndex(qq => qq.isCurrent)
    setQuarters(q)
    setWindowStart(Math.max(0, currentIdx - 1))
    setToday(new Date().toISOString().slice(0, 10))
    setCurrentYear(new Date().getFullYear())
  }, [])

  const visible = quarters.slice(windowStart, windowStart + 4)

  const qData = visible.map(q => {
    const qEvents = events.filter(e => e.start_date && e.start_date >= q.startDate && e.start_date <= q.endDate)
    const qOpps = opportunities.filter(o => o.start_date && o.start_date >= q.startDate && o.start_date <= q.endDate)
    const qConfirmed = qEvents.filter(e => e.status !== 'pending_approval')
    const qPending = qEvents.filter(e => e.status === 'pending_approval')
    return {
      ...q,
      budget: qEvents.reduce((s, e) => s + (e.budget_total || 0), 0),
      budgetConfirmed: qConfirmed.reduce((s, e) => s + (e.budget_total || 0), 0),
      budgetPending: qPending.reduce((s, e) => s + (e.budget_total || 0), 0),
      eventCount: qEvents.length,
      eventCountConfirmed: qConfirmed.length,
      eventCountPending: qPending.length,
      confirmedEventNames: qConfirmed.map(e => e.name),
      pendingEventNames: qPending.map(e => e.name),
      active: qEvents.filter(e => e.status === 'active' || e.status === 'planning' || e.status === 'complete').length,
      complete: qEvents.filter(e => e.status === 'complete').length,
      underReview: qOpps.filter(o => o.status === 'pending_approval').length,
      upcoming: qEvents.filter(e => e.start_date && e.start_date >= today).length,
      isPast: q.endDate < today,
    }
  })

  const canPrev = windowStart > 0
  const canNext = windowStart + 4 < quarters.length

  const prevQuarter = windowStart > 0 ? quarters[windowStart - 1] : null
  const nextQuarter = windowStart + 4 < quarters.length ? quarters[windowStart + 4] : null

  const NavBtn = ({ dir }: { dir: 'prev' | 'next' }) => {
    const neighbour = dir === 'prev' ? prevQuarter : nextQuarter
    return (
      <button
        onClick={() => setWindowStart(i => dir === 'prev' ? Math.max(0, i - 1) : Math.min(quarters.length - 4, i + 1))}
        disabled={dir === 'prev' ? !canPrev : !canNext}
        className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors flex-shrink-0 min-w-[44px]"
        aria-label={dir === 'prev' ? 'Previous quarter' : 'Next quarter'}
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dir === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
        </svg>
        {neighbour && (
          <span className="text-[9px] text-gray-400 font-medium leading-none">{neighbour.label}</span>
        )}
      </button>
    )
  }

  type RowKey = 'budgetConfirmed' | 'budgetPending' | 'active' | 'underReview' | 'upcoming'
  const rows: { key: RowKey; label: string; color: string; dimColor: string; alwaysShow: boolean; format: 'currency' | 'count' }[] = [
    { key: 'budgetConfirmed', label: 'Budget – Confirmed',        color: 'text-blue-700',   dimColor: 'text-blue-200',   alwaysShow: true,  format: 'currency' },
    { key: 'budgetPending',   label: 'Budget – Pending Approval', color: 'text-orange-600', dimColor: 'text-orange-200', alwaysShow: true,  format: 'currency' },
    { key: 'active',          label: 'Active',                    color: 'text-green-700',  dimColor: 'text-green-300',  alwaysShow: false, format: 'count'    },
    { key: 'underReview',     label: 'Under Review',              color: 'text-amber-700',  dimColor: 'text-amber-300',  alwaysShow: false, format: 'count'    },
    { key: 'upcoming',        label: 'Upcoming',                  color: 'text-purple-700', dimColor: 'text-purple-300', alwaysShow: false, format: 'count'    },
  ]

  const hasNoEvents = !loading && events.length === 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
      {loading ? (
        <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      ) : hasNoEvents ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No events yet — let&apos;s get started</p>
          <p className="text-xs text-gray-400 mb-5 max-w-sm">Your budget and event timeline will appear here. Add your first event manually, or let AI discover opportunities for you.</p>
          <div className="flex items-center gap-3">
            <Link href="/opportunities"
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Browse Opportunities
            </Link>
          </div>
        </div>
      ) : (
        <>
        <div className="flex items-stretch gap-2">
          <div className="flex items-center"><NavBtn dir="prev" /></div>

          {/* Grid: row labels + 4 quarter columns */}
          <div className="flex-1 grid grid-cols-[auto_repeat(4,1fr)] gap-x-4">

            {/* Header row */}
            <div /> {/* empty label cell */}
            {qData.map(q => (
              <div key={q.label} className={`text-center pb-4 border-b-2 ${q.isCurrent ? 'border-blue-400' : 'border-gray-100'}`}>
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className={`font-bold text-sm ${q.isCurrent ? 'text-gray-900' : q.isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                    {q.label}
                  </span>
                  {q.isCurrent && <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 font-semibold leading-none">now</span>}
                </div>
                <p className="text-[10px] text-gray-400">
                  {new Date(q.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' – '}
                  {new Date(q.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}

            {/* Data rows */}
            {rows.filter(r => r.alwaysShow || showDetails).map((row, rowIdx, visibleRows) => (
              <React.Fragment key={row.key}>
                {/* Row label */}
                <div className={`flex items-center pr-4 ${rowIdx > 0 ? 'border-t border-gray-100' : ''} pt-2 ${rowIdx < visibleRows.length - 1 ? 'pb-2' : ''}`}>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{row.label}</span>
                </div>

                {/* Quarter values */}
                {qData.map(q => {
                  const numVal = row.key === 'budgetConfirmed' ? q.budgetConfirmed
                    : row.key === 'budgetPending' ? q.budgetPending
                    : (q as unknown as Record<string, number>)[row.key]
                  const isEmpty = numVal === 0
                  const display = row.format === 'currency'
                    ? (numVal > 0 ? formatCurrency(numVal) : '—')
                    : String(numVal)

                  const cellClass = `text-center ${rowIdx > 0 ? 'border-t border-gray-100' : ''} pt-2 ${rowIdx < visibleRows.length - 1 ? 'pb-2' : ''}`

                  const tooltipNames = row.key === 'budgetConfirmed' ? q.confirmedEventNames
                    : row.key === 'budgetPending' ? q.pendingEventNames
                    : []
                  const hasTooltip = tooltipNames && tooltipNames.length > 0 && !isEmpty

                  const inner = (
                    <span className={`text-base font-bold tabular-nums ${isEmpty ? row.dimColor : row.color} ${q.isPast && !q.isCurrent ? 'opacity-60' : ''}`}>
                      {display}
                    </span>
                  )

                  return (
                    <div key={`${q.label}-${row.key}`} className={cellClass}>
                      {hasTooltip ? (
                        <div className="relative inline-block group/tip">
                          <span className={`text-base font-bold tabular-nums cursor-default underline decoration-dotted decoration-gray-300 underline-offset-2 ${isEmpty ? row.dimColor : row.color} ${q.isPast && !q.isCurrent ? 'opacity-60' : ''}`}>
                            {display}
                          </span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block z-50 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                              {tooltipNames.map((name, i) => (
                                <div key={i} className="flex items-center gap-1.5 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white opacity-50 flex-shrink-0" />
                                  {name}
                                </div>
                              ))}
                            </div>
                            <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                          </div>
                        </div>
                      ) : (
                        row.key === 'underReview' && !isEmpty
                          ? <Link href="/opportunities?tab=under_review" className="hover:underline">{inner}</Link>
                          : inner
                      )}
                      {row.key === 'budgetConfirmed' && q.eventCountConfirmed > 0 && (
                        <span className="block text-[10px] text-gray-400 mt-0.5">{q.eventCountConfirmed} event{q.eventCountConfirmed !== 1 ? 's' : ''}</span>
                      )}
                      {row.key === 'budgetPending' && q.eventCountPending > 0 && (
                        <span className="block text-[10px] text-gray-400 mt-0.5">{q.eventCountPending} event{q.eventCountPending !== 1 ? 's' : ''}</span>
                      )}
                      {row.key === 'active' && q.active > 0 && (
                        <span className="block text-[10px] text-gray-400 mt-0.5">
                          {q.complete === q.active ? 'all complete' : q.complete > 0 ? `${q.complete} complete` : 'in planning'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center"><NavBtn dir="next" /></div>
        </div>
        {/* Expand/collapse details */}
        <div className="flex justify-center mt-3">
          <button
            onClick={() => setShowDetails(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showDetails ? 'Hide details' : 'Show event details'}
          </button>
        </div>
        {/* Annual summary strip */}
        {(() => {
          const yearStr = String(currentYear)
          const yearEvents = events.filter(e => e.start_date?.startsWith(yearStr))
          const yearBudgetConfirmed = yearEvents.filter(e => e.status !== 'pending_approval').reduce((s, e) => s + (e.budget_total || 0), 0)
          const yearBudgetPending = yearEvents.filter(e => e.status === 'pending_approval').reduce((s, e) => s + (e.budget_total || 0), 0)
          const yearActive = yearEvents.filter(e => ['active', 'planning', 'complete'].includes(e.status)).length
          const yearComplete = yearEvents.filter(e => e.status === 'complete').length
          const yearReview = opportunities.filter(o => o.start_date?.startsWith(yearStr) && o.status === 'pending_approval').length
          return (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{currentYear} Full Year</span>
              <div className="flex items-center gap-8 flex-1 flex-wrap">
                <div>
                  <span className="text-sm font-bold text-blue-700">{yearBudgetConfirmed > 0 ? formatCurrency(yearBudgetConfirmed) : '—'}</span>
                  <span className="text-xs text-gray-400 ml-1.5">confirmed budget</span>
                </div>
                {yearBudgetPending > 0 && (
                  <div>
                    <span className="text-sm font-bold text-orange-600">{formatCurrency(yearBudgetPending)}</span>
                    <span className="text-xs text-gray-400 ml-1.5">pending approval</span>
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-green-700">{yearActive}</span>
                  <span className="text-xs text-gray-400 ml-1.5">
                    active events{yearComplete > 0 ? ` · ${yearComplete} complete` : ''}
                  </span>
                </div>
                {yearReview > 0 && (
                  <div>
                    <Link href="/opportunities?tab=under_review" className="hover:underline">
                      <span className="text-sm font-bold text-amber-700">{yearReview}</span>
                      <span className="text-xs text-gray-400 ml-1.5">under review</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
        </>
      )}
    </div>
  )
}

