'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import OverviewTab from './OverviewTab'
import VendorsTab from './VendorsTab'
import BudgetTab from './BudgetTab'
import PlanningTab from './PlanningTab'
import OutcomesTab from './OutcomesTab'
import { Event, EventStatusBadge, EVENT_TYPE_LABELS } from './types'

const TABS = ['Overview', 'Task List', 'Vendors', 'Budget', 'Outcomes'] as const
type Tab = typeof TABS[number]

interface AISetupResult {
  summary: string
  budget_added: number
  planning_added: number
  vendor_suggestions: Array<{ name: string; category: string; notes: string }>
  suggested_budget_total: number
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [confirmRevert, setConfirmRevert] = useState(false)

  const moveToOpportunity = async (destination: 'pipeline' | 'under_review') => {
    const res = await fetch(`/api/events/${id}?destination=${destination}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.reverted) router.push(destination === 'pipeline' ? '/opportunities' : '/opportunities?tab=under_review')
  }
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [loading, setLoading] = useState(true)
  const [tabCounts, setTabCounts] = useState<{ planning: number; vendors: number; budget: number } | null>(null)

  const fetchTabCounts = useCallback(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/events/${id}/planning`).then(r => r.json()).catch(() => []),
      fetch(`/api/events/${id}/vendors`).then(r => r.json()).catch(() => []),
      fetch(`/api/events/${id}/budget`).then(r => r.json()).catch(() => []),
    ]).then(([planning, vendors, budget]) => {
      setTabCounts({
        planning: Array.isArray(planning) ? planning.length : 0,
        vendors: Array.isArray(vendors) ? vendors.length : 0,
        budget: Array.isArray(budget) ? budget.length : 0,
      })
    })
  }, [id])

  useEffect(() => { fetchTabCounts() }, [fetchTabCounts])
  const [aiSetupOpen, setAiSetupOpen] = useState(false)
  const [aiSetupRunning, setAiSetupRunning] = useState(false)
  const [aiSetupResult, setAiSetupResult] = useState<AISetupResult | null>(null)
  const [aiSetupError, setAiSetupError] = useState<string | null>(null)
  const [importUrls, setImportUrls] = useState<string[]>([''])
  const [importText, setImportText] = useState('')

  const fetchEvent = useCallback(() => {
    fetch(`/api/events/${id}`)
      .then(r => r.json())
      .then(data => { setEvent(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  // Auto-open AI import modal when coming from post-event notification
  useEffect(() => {
    if (searchParams.get('upload') === '1') setAiSetupOpen(true)
    // NEW: honour ?tab= param to open a specific tab directly
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      const TAB_MAP: Record<string, string> = {
        planning: 'Task List',
        vendors: 'Vendors',
        budget: 'Budget',
        outcomes: 'Outcomes',
        overview: 'Overview',
        execution: 'Execution',
      }
      const mapped = TAB_MAP[tabParam.toLowerCase()]
      if (mapped) setActiveTab(mapped as Tab)
    }
  }, [searchParams])

  const addUrlField = () => setImportUrls(u => [...u, ''])
  const removeUrlField = (i: number) => setImportUrls(u => u.filter((_, idx) => idx !== i))
  const updateUrl = (i: number, val: string) => setImportUrls(u => u.map((v, idx) => idx === i ? val : v))

  const runAiSetup = async () => {
    setAiSetupRunning(true)
    setAiSetupError(null)
    setAiSetupResult(null)
    try {
      const validUrls = importUrls.filter(u => u.trim())
      const res = await fetch(`/api/events/${id}/ai-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: validUrls,
          pasted_content: importText.trim() || null,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI setup failed')
      setAiSetupResult(data)
      fetchEvent()
      fetchTabCounts()
    } catch (e: unknown) {
      setAiSetupError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setAiSetupRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-gray-400">Loading event...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <p className="text-gray-500">Event not found.</p>
          <Link href="/events" className="text-blue-500 hover:underline mt-2 inline-block">Back to Events</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Events
      </Link>

      {/* Post-event upload banner */}
      {event.end_date && event.end_date < new Date().toISOString().split('T')[0] && !event.post_event_completed && (
        <div className="mb-5 flex items-center gap-4 bg-violet-50 border border-violet-200 rounded-xl px-5 py-4">
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-violet-900">This event has concluded — upload your post-event info</p>
            <p className="text-xs text-violet-700 mt-0.5">Import documents or paste content (vendor invoices, contact sheets, notes, actuals) and AI will update this event automatically.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setAiSetupOpen(true); setAiSetupResult(null); setAiSetupError(null); setImportUrls(['']); setImportText('') }}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Upload info
            </button>
            <button
              onClick={async () => {
                await fetch(`/api/events/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_event_completed: 1 }) })
                fetchEvent()
              }}
              className="px-4 py-2 text-sm text-violet-700 hover:text-violet-900 border border-violet-300 hover:border-violet-400 rounded-lg bg-white transition-colors"
            >
              Mark done
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <EventStatusBadge status={event.status} />
            <span className="text-sm text-gray-500">{EVENT_TYPE_LABELS[event.type] || event.type}</span>
            {event.location && <span className="text-sm text-gray-400">· {event.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {confirmRevert ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Move back to pipeline?</span>
              <button
                onClick={() => { setConfirmRevert(false); moveToOpportunity('pipeline') }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              >
                Yes, Revert
              </button>
              <button
                onClick={() => setConfirmRevert(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRevert(true)}
              className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Revert to Opportunity
            </button>
          )}
          <button
            onClick={() => { setAiSetupOpen(true); setAiSetupResult(null); setAiSetupError(null); setImportUrls(['']); setImportText('') }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Import &amp; Update with AI
          </button>
        </div>
      </div>

      {/* AI Import Modal */}
      {aiSetupOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                <h3 className="font-semibold text-gray-900">Import &amp; Update with AI</h3>
              </div>
              <button onClick={() => setAiSetupOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {!aiSetupResult ? (
                <>
                  <p className="text-sm text-gray-600">
                    Claude will read the links and content you provide, then automatically populate <strong>budget line items</strong>, <strong>planning tasks</strong>, and <strong>vendor suggestions</strong> for <em>{event.name}</em>.
                  </p>

                  {/* URL inputs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Links <span className="text-gray-400 font-normal">(Google Drive folders, event websites, invoices, etc.)</span>
                    </label>
                    <div className="space-y-2">
                      {importUrls.map((url, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={url}
                            onChange={e => updateUrl(i, e.target.value)}
                            placeholder="https://drive.google.com/drive/folders/... or any URL"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                          {importUrls.length > 1 && (
                            <button onClick={() => removeUrlField(i)} className="text-gray-400 hover:text-red-500 p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={addUrlField} className="mt-2 text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Add another link
                    </button>
                  </div>

                  {/* Paste area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paste content <span className="text-gray-400 font-normal">(invoices, emails, budget tables, notes — optional)</span>
                    </label>
                    <textarea
                      value={importText}
                      onChange={e => setImportText(e.target.value)}
                      placeholder="Paste any text here — invoice details, email confirmations, pricing tables, or planning notes..."
                      rows={5}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
                    />
                  </div>

                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-700 space-y-1">
                    <p className="font-medium">Claude will extract and add:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-violet-600">
                      <li>Budget line items from invoices, contracts, and pricing pages</li>
                      <li>Planning tasks (pre-event through post-event)</li>
                      <li>Vendor suggestions based on the event type and content</li>
                    </ul>
                    <p className="text-violet-500 mt-1">Existing items will not be duplicated. Works with Drive folders, event websites, or any URL.</p>
                  </div>

                  {aiSetupError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{aiSetupError}</div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={runAiSetup}
                      disabled={aiSetupRunning}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {aiSetupRunning ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          Claude is analyzing your content...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          Import with AI
                        </>
                      )}
                    </button>
                    <button onClick={() => setAiSetupOpen(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    Event setup complete
                  </div>
                  <p className="text-sm text-gray-600">{aiSetupResult.summary}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{aiSetupResult.budget_added}</div>
                      <div className="text-xs text-blue-600 mt-0.5">budget items added</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{aiSetupResult.planning_added}</div>
                      <div className="text-xs text-green-600 mt-0.5">planning tasks added</div>
                    </div>
                  </div>
                  {aiSetupResult.vendor_suggestions?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Suggested vendors to add:</p>
                      <div className="space-y-1.5">
                        {aiSetupResult.vendor_suggestions.slice(0, 4).map((v, i) => (
                          <div key={i} className="text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <span className="font-medium text-gray-800">{v.name}</span>
                            <span className="text-gray-500 ml-1">({v.category})</span>
                            {v.notes && <span className="block text-gray-400 mt-0.5">{v.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => { setAiSetupOpen(false); setActiveTab('Task List') }}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      View Planning
                    </button>
                    <button
                      onClick={() => { setAiSetupOpen(false); setActiveTab('Budget') }}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      View Budget
                    </button>
                    <button onClick={() => setAiSetupOpen(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          {TABS.map(tab => {
            const count = tab === 'Task List' ? tabCounts?.planning : tab === 'Vendors' ? tabCounts?.vendors : tab === 'Budget' ? tabCounts?.budget : null
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'text-blue-600 border-blue-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
                {count != null && count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium leading-none ${activeTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && <OverviewTab event={event} onUpdate={fetchEvent} onTabChange={setActiveTab} />}
      {activeTab === 'Task List' && <PlanningTab eventId={id} />}
      {activeTab === 'Vendors' && <VendorsTab eventId={id} />}
      {activeTab === 'Budget' && <BudgetTab eventId={id} budgetTotal={event.budget_total} />}
      {activeTab === 'Outcomes' && <OutcomesTab eventId={id} event={event} />}
    </div>
  )
}
