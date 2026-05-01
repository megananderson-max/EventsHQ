'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SetupPreferencesModal from '@/app/components/SetupPreferencesModal'
import Tooltip from '@/app/components/Tooltip'

interface Opportunity {
  id?: number
  name: string
  type: string
  start_date: string | null
  end_date: string | null
  location: string | null
  venue: string | null
  organizer: string | null
  website: string | null
  expected_attendees: number | null
  budget_estimate_low: number | null
  budget_estimate_high: number | null
  strategic_fit: string
  focus_area: string | null
  region: string | null
  audience_match: string | null
  recommendation: string
  description: string | null
  past_sponsors: string | null
  speaking_opportunity: string | null
  networking_value: string | null
  why_now: string | null
  priority_score: number | null
  relevant_for: string | null  // 'ignitetech' | 'khoros' | 'both'
  status?: string
  added_to_events?: number
  generated_at?: string | null
  is_competitor_event?: number
  competitor_name?: string | null
  review_notes?: string | null
  dna_notes?: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
}

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const FIT_COLORS: Record<string, string> = {
  High: 'bg-green-100 text-green-800 border-green-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low: 'bg-gray-100 text-gray-600 border-gray-200',
}
const REC_COLORS: Record<string, string> = {
  Sponsor: 'bg-blue-100 text-blue-800 border-blue-200',
  Evaluate: 'bg-gray-100 text-gray-600 border-gray-200',
  Speak: 'bg-pink-100 text-pink-800 border-pink-200',
}

const FOCUS_AREAS = [
  { val: 'all', label: 'All Focus Areas' },
  { val: 'ignitetech', label: '🟧 IgniteTech Only' },
  { val: 'cx', label: '🎯 CX & Customer Success' },
  { val: 'community', label: '🌐 Community Management' },
  { val: 'contact_center', label: '📞 Contact Center' },
  { val: 'social_media', label: '📱 Social Media & MarTech' },
  { val: 'ai_tech', label: '🤖 AI & Enterprise Tech' },
  { val: 'executive', label: '👔 Executive Leadership' },
]

const REGIONS = [
  { val: 'all', label: 'Global' },
  { val: 'north_america', label: '🇺🇸 North America' },
  { val: 'europe', label: '🇪🇺 Europe' },
  { val: 'apac', label: '🌏 APAC' },
]

function PriorityBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 65 ? 'bg-yellow-500' : 'bg-gray-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold ${score >= 80 ? 'text-green-600' : score >= 65 ? 'text-yellow-600' : 'text-gray-500'}`}>
        {score}
      </span>
    </div>
  )
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<Record<number, boolean>>({})
  const [lastAdded, setLastAdded] = useState<number | null>(null)
  const [addedEventIds, setAddedEventIds] = useState<Record<number, number>>({}) // oppId -> eventId

  type ConfirmStep = 'creating' | 'researching' | 'done' | 'error'
  type ConfirmState = {
    step: ConfirmStep
    opp: Opportunity
    eventId?: number
    budgetAdded?: number
    planningAdded?: number
    vendorsLinked?: number
    suggestedTotal?: number
    summary?: string
    error?: string
  }
  const [confirming, setConfirming] = useState<ConfirmState | null>(null)
  const [pageTab, setPageTab] = useState<'opportunities' | 'under_review' | 'do_not_attend'>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t === 'under_review') return 'under_review'
      if (t === 'do_not_attend') return 'do_not_attend'
    }
    return 'opportunities'
  })
  const [toast, setToast] = useState<string | null>(null)
  const [reviewNotesDraft, setReviewNotesDraft] = useState<Record<number, string>>({})
  const [savedNotes, setSavedNotes] = useState<Record<number, boolean>>({})

  // Do Not Attend modal
  const [dnaModal, setDnaModal] = useState<{ opp: Opportunity } | null>(null)
  const [dnaDraft, setDnaDraft] = useState({ isCompetitor: false, competitorName: '', notes: '' })
  const [dnaEditingId, setDnaEditingId] = useState<number | null>(null)
  const [dnaEditDraft, setDnaEditDraft] = useState({ isCompetitor: false, competitorName: '', notes: '' })

  // Under Review filters
  const [urSearch, setUrSearch] = useState('')
  const [urSort, setUrSort] = useState<'name' | 'date' | 'budget' | 'fit'>('date')
  const [urSortDir, setUrSortDir] = useState<'asc' | 'desc'>('asc')
  const [urQuarter, setUrQuarter] = useState('')
  const [urYear, setUrYear] = useState('')

  // Sync tab with URL param whenever it changes (e.g. sidebar nav click)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'under_review') setPageTab('under_review')
    else if (tab === 'do_not_attend') setPageTab('do_not_attend')
    else if (!tab) setPageTab('opportunities')
  }, [searchParams])

  // Search config
  const [focusArea, setFocusArea] = useState<string>('all')
  const [region, setRegion] = useState<string>('all')

  // Filter/sort
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterFit, setFilterFit] = useState<string>('all')
  const [filterRec, setFilterRec] = useState<string>('all')
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterFocus, setFilterFocus] = useState<string>('all')
  const [filterCompany, setFilterCompany] = useState<string>('all')
  const [filterSpeaking, setFilterSpeaking] = useState<boolean>(false)
  const [filterNew, setFilterNew] = useState<boolean>(false)
  const [filterDatePreset, setFilterDatePreset] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'cost_asc' | 'cost_desc' | 'fit'>('priority')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  type ScanStatus = {
    enabled: boolean
    freq_hours: number
    last_scan_at: string | null
    last_added: number
    last_focus: string | null
    next_scan_at: string | null
    next_focus: string
    is_due: boolean
  }
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [showScanSettings, setShowScanSettings] = useState(false)
  const [savingFreq, setSavingFreq] = useState(false)
  const [oppView, setOppView] = useState<'cards' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('opp_view')
      if (v === 'list') return 'list'
    }
    return 'cards'
  })
  const [listExpandedId, setListExpandedId] = useState<number | null>(null)
  const [showPrefsModal, setShowPrefsModal] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [confirmEventOpp, setConfirmEventOpp] = useState<Opportunity | null>(null)
  const [showFilterCustomizer, setShowFilterCustomizer] = useState(false)
  const [visibleFilters, setVisibleFilters] = useState<string[]>(['fit', 'focus', 'region', 'date', 'sort'])
  const [userFocusAreas, setUserFocusAreas] = useState<string[]>([])
  const [userRegions, setUserRegions] = useState<string[]>([])

  const loadScanStatus = () =>
    fetch('/api/opportunities/auto-scan')
      .then(r => r.json())
      .then(setScanStatus)
      .catch(() => {})

  const saveFreq = async (hours: number) => {
    setSavingFreq(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opp_scan_freq_hours: String(hours) }),
    }).catch(() => {})
    await loadScanStatus()
    setSavingFreq(false)
  }

  const saveVisibleFilters = async (filters: string[]) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opp_visible_filters: filters.join(',') }),
    }).catch(() => {})
  }

  const toggleVisibleFilter = (key: string) => {
    setVisibleFilters(prev => {
      const next = prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
      saveVisibleFilters(next)
      return next
    })
  }

  const toggleEnabled = async () => {
    if (!scanStatus) return
    const next = !scanStatus.enabled
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opp_scan_enabled: next ? 'true' : 'false' }),
    }).catch(() => {})
    await loadScanStatus()
  }

  // Load persisted opportunities on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/opportunities').then(r => r.json()),
      fetch('/api/opportunities/auto-scan').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ])
      .then(([data, status, settings]) => {
        if (data.opportunities?.length) {
          setOpportunities(data.opportunities)
          setGeneratedAt(data.generated_at)
        }
        setScanStatus(status)
        if (settings.opp_focus_areas) setUserFocusAreas(settings.opp_focus_areas.split(',').filter(Boolean))
        if (settings.opp_regions)     setUserRegions(settings.opp_regions.split(',').filter(Boolean))
        if (settings.opp_visible_filters) setVisibleFilters(settings.opp_visible_filters.split(',').filter(Boolean))
      })
      .finally(() => setInitialLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_area: focusArea, region }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate')
      setOpportunities(data.opportunities)
      setGeneratedAt(data.generated_at)
      setLastAdded(data.added || 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const moveToReview = async (opp: Opportunity) => {
    if (!opp.id) return
    setAdding(a => ({ ...a, [opp.id!]: true }))
    await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending_approval' }),
    }).catch(() => {})
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: 'pending_approval' } : o))
    setAdding(a => ({ ...a, [opp.id!]: false }))
    setPageTab('under_review')
    router.replace('/opportunities?tab=under_review', { scroll: false })
    setToast(`"${opp.name}" moved to Under Review`)
    setTimeout(() => setToast(null), 4000)
  }

  const removeFromReview = async (opp: Opportunity) => {
    if (!opp.id) return
    await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pipeline' }),
    }).catch(() => {})
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: 'pipeline' } : o))
  }

  const moveToDoNotAttend = (opp: Opportunity) => {
    setDnaDraft({ isCompetitor: !!(opp.is_competitor_event), competitorName: opp.competitor_name || '', notes: '' })
    setDnaModal({ opp })
  }

  const confirmMoveToDoNotAttend = async () => {
    if (!dnaModal?.opp.id) return
    const { opp } = dnaModal
    await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'do_not_attend',
        is_competitor_event: dnaDraft.isCompetitor ? 1 : 0,
        competitor_name: dnaDraft.isCompetitor ? (dnaDraft.competitorName || null) : null,
        dna_notes: dnaDraft.notes.trim() || null,
      }),
    }).catch(() => {})
    setOpportunities(prev => prev.map(o => o.id === opp.id ? {
      ...o,
      status: 'do_not_attend',
      is_competitor_event: dnaDraft.isCompetitor ? 1 : 0,
      competitor_name: dnaDraft.isCompetitor ? (dnaDraft.competitorName || null) : null,
      dna_notes: dnaDraft.notes.trim() || null,
    } : o))
    setDnaModal(null)
    setPageTab('do_not_attend')
    router.replace('/opportunities?tab=do_not_attend', { scroll: false })
    setToast(`"${opp.name}" moved to Do Not Attend`)
    setTimeout(() => setToast(null), 4000)
  }

  const saveDnaEdit = async (opp: Opportunity) => {
    if (!opp.id) return
    await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_competitor_event: dnaEditDraft.isCompetitor ? 1 : 0,
        competitor_name: dnaEditDraft.isCompetitor ? (dnaEditDraft.competitorName || null) : null,
        dna_notes: dnaEditDraft.notes.trim() || null,
      }),
    }).catch(() => {})
    setOpportunities(prev => prev.map(o => o.id === opp.id ? {
      ...o,
      is_competitor_event: dnaEditDraft.isCompetitor ? 1 : 0,
      competitor_name: dnaEditDraft.isCompetitor ? (dnaEditDraft.competitorName || null) : null,
      dna_notes: dnaEditDraft.notes.trim() || null,
    } : o))
    setDnaEditingId(null)
  }

  const restoreFromDoNotAttend = async (opp: Opportunity) => {
    if (!opp.id) return
    await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pipeline' }),
    }).catch(() => {})
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: 'pipeline' } : o))
    setToast(`"${opp.name}" restored to pipeline`)
    setTimeout(() => setToast(null), 3000)
  }

  const saveReviewNotes = async (opp: Opportunity, notes: string) => {
    if (!opp.id) return
    await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_notes: notes }),
    }).catch(() => {})
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, review_notes: notes } : o))
    setSavedNotes(s => ({ ...s, [opp.id!]: true }))
    setTimeout(() => setSavedNotes(s => ({ ...s, [opp.id!]: false })), 2000)
  }

  const addToEvents = async (opp: Opportunity) => {
    if (!opp.id) return
    setConfirming({ step: 'creating', opp })

    try {
      // Step 1: Create the event
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: opp.name,
          type: opp.type || 'conference',
          status: 'pending_approval',
          start_date: opp.start_date,
          end_date: opp.end_date,
          location: opp.location,
          venue: opp.venue || '',
          expected_attendees: opp.expected_attendees,
          budget_total: opp.budget_estimate_high || 0,
          description: opp.description,
          review_notes: opp.review_notes || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create event')
      const newEvent = await res.json()
      const newEventId = newEvent.id

      // Mark opportunity as added
      fetch(`/api/opportunities/${opp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ added_to_events: 1, status: 'approved', event_id: newEventId }),
      }).catch(() => {})

      // Step 2: Run AI setup with deep research
      setConfirming({ step: 'researching', opp, eventId: newEventId })

      const oppContext = [
        opp.audience_match ? `Audience: ${opp.audience_match}` : '',
        opp.past_sponsors ? `Past sponsors include: ${opp.past_sponsors}` : '',
        opp.networking_value ? `Networking: ${opp.networking_value}` : '',
        opp.why_now ? `Why now: ${opp.why_now}` : '',
        opp.speaking_opportunity ? `Speaking opportunity: ${opp.speaking_opportunity}` : '',
        opp.budget_estimate_low && opp.budget_estimate_high
          ? `Estimated budget range: $${opp.budget_estimate_low.toLocaleString()} – $${opp.budget_estimate_high.toLocaleString()}`
          : '',
      ].filter(Boolean).join('\n')

      const setupRes = await fetch(`/api/events/${newEventId}/ai-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: opp.website ? [opp.website] : [],
          is_new_event: true,
          opportunity_context: oppContext,
        }),
      })
      const setupData = await setupRes.json()

      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, added_to_events: 1, status: 'approved' } : o))
      setAddedEventIds(prev => ({ ...prev, [opp.id!]: newEventId }))

      setConfirming({
        step: 'done',
        opp,
        eventId: newEventId,
        budgetAdded: setupData.budget_added ?? 0,
        planningAdded: setupData.planning_added ?? 0,
        vendorsLinked: setupData.vendors_linked ?? 0,
        suggestedTotal: setupData.suggested_budget_total,
        summary: setupData.summary,
      })
    } catch (e) {
      setConfirming(prev => prev ? { ...prev, step: 'error', error: e instanceof Error ? e.message : 'Unknown error' } : null)
    }
  }

  // Partition into tabs
  const pipelineOpps = opportunities.filter(o => o.status !== 'pending_approval' && o.status !== 'do_not_attend' && !o.added_to_events)
  const underReviewOpps = opportunities.filter(o => o.status === 'pending_approval') // raw — used for count badge
  const doNotAttendOpps = opportunities.filter(o => o.status === 'do_not_attend').sort((a, b) => a.name.localeCompare(b.name))

  // Helper: derive quarter string from date
  const getQuarter = (d: string | null) => {
    if (!d) return null
    const m = parseInt(d.slice(5, 7))
    return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4'
  }

  // Derive the quarter+year combos that actually exist in the data, e.g. "Q2-2026"
  const QUARTER_MONTH_LABELS: Record<string, string> = { Q1: 'Jan–Mar', Q2: 'Apr–Jun', Q3: 'Jul–Sep', Q4: 'Oct–Dec' }
  const urAvailableQuarters = [...new Set(
    underReviewOpps.map(o => {
      const q = getQuarter(o.start_date); const y = o.start_date?.slice(0, 4)
      return q && y ? `${q}-${y}` : null
    }).filter(Boolean)
  )].sort() as string[]

  // Filtered + sorted Under Review list
  const FIT_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
  const filteredUnderReviewOpps = underReviewOpps
    .filter(o => {
      if (urSearch && !o.name.toLowerCase().includes(urSearch.toLowerCase())) return false
      if (urQuarter) {
        const [q, y] = urQuarter.split('-')
        if (getQuarter(o.start_date) !== q || !(o.start_date || '').startsWith(y)) return false
      }
      if (urYear && !(o.start_date || '').startsWith(urYear)) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      if (urSort === 'name') cmp = a.name.localeCompare(b.name)
      else if (urSort === 'date') cmp = (a.start_date || '9999').localeCompare(b.start_date || '9999')
      else if (urSort === 'budget') cmp = (a.budget_estimate_high || 0) - (b.budget_estimate_high || 0)
      else if (urSort === 'fit') cmp = (FIT_ORDER[a.strategic_fit] ?? 9) - (FIT_ORDER[b.strategic_fit] ?? 9)
      return urSortDir === 'asc' ? cmp : -cmp
    })

  // "New" = added within the last 48 hours
  const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000
  const isNew = (o: Opportunity) => !!o.generated_at && new Date(o.generated_at).getTime() > fortyEightHoursAgo
  const newCount = pipelineOpps.filter(isNew).length

  // Filter + sort (only applies to pipeline tab)
  const filtered = pipelineOpps
    .filter(o => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        o.name.toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q) ||
        (o.location || '').toLowerCase().includes(q) ||
        (o.organizer || '').toLowerCase().includes(q) ||
        (o.focus_area || '').toLowerCase().includes(q) ||
        (o.audience_match || '').toLowerCase().includes(q)
      )
    })
    .filter(o => !filterNew || isNew(o))
    .filter(o => filterFit === 'all' || o.strategic_fit === filterFit)
    .filter(o => filterRec === 'all' || o.recommendation === filterRec)
    .filter(o => {
      if (filterRegion === 'all') return true
      const r = (o.region || o.location || '').toLowerCase()
      if (filterRegion === 'north_america') return r.includes('usa') || r.includes('canada') || r.includes('north america') || r.includes(', ca') || r.includes(', ny') || r.includes(', tx') || r.includes(', fl') || r.includes(', nv') || r.includes(', ma')
      if (filterRegion === 'europe') return r.includes('europe') || r.includes('uk') || r.includes('london') || r.includes('berlin') || r.includes('paris') || r.includes('amsterdam') || r.includes('lisbon') || r.includes('helsinki') || r.includes('ireland')
      if (filterRegion === 'apac') return r.includes('apac') || r.includes('singapore') || r.includes('dubai') || r.includes('australia') || r.includes('japan') || r.includes('korea') || r.includes('india')
      return true
    })
    .filter(o => {
      if (filterFocus === 'all') return true
      const fa = (o.focus_area || '').toLowerCase()
      if (filterFocus === 'cx') return fa.includes('customer experience') || fa.includes('cx') || fa.includes('customer success')
      if (filterFocus === 'community') return fa.includes('community')
      if (filterFocus === 'contact_center') return fa.includes('contact center') || fa.includes('digital care') || fa.includes('ccaas')
      if (filterFocus === 'social_media') return fa.includes('social') || fa.includes('martech') || fa.includes('marketing')
      if (filterFocus === 'ai_tech') return fa.includes('ai') || fa.includes('artificial') || fa.includes('tech')
      if (filterFocus === 'executive') return fa.includes('executive') || fa.includes('leadership') || fa.includes('c-suite')
      return true
    })
    .filter(o => {
      if (filterCompany === 'all') return true
      if (filterCompany === 'both_only') return o.relevant_for === 'both'
      return o.relevant_for === filterCompany || o.relevant_for === 'both'
    })
    .filter(o => !filterSpeaking || !!o.speaking_opportunity)
    .filter(o => {
      if (filterDatePreset === 'all') return true
      const d = o.start_date
      if (!d) return false
      if (filterDatePreset === 'custom') {
        if (filterDateFrom && d < filterDateFrom) return false
        if (filterDateTo && d > filterDateTo) return false
        return true
      }
      const ranges: Record<string, [string, string]> = {
        q2_2026: ['2026-04-01', '2026-06-30'],
        q3_2026: ['2026-07-01', '2026-09-30'],
        q4_2026: ['2026-10-01', '2026-12-31'],
        q1_2027: ['2027-01-01', '2027-03-31'],
        q2_2027: ['2027-04-01', '2027-06-30'],
        q3_2027: ['2027-07-01', '2027-09-30'],
        q4_2027: ['2027-10-01', '2027-12-31'],
      }
      const [from, to] = ranges[filterDatePreset] || ['', '']
      return d >= from && d <= to
    })
    .sort((a, b) => {
      if (sortBy === 'date') return (a.start_date || '') < (b.start_date || '') ? -1 : 1
      if (sortBy === 'cost_asc') {
        const aAvg = ((a.budget_estimate_low || 0) + (a.budget_estimate_high || a.budget_estimate_low || 0)) / 2
        const bAvg = ((b.budget_estimate_low || 0) + (b.budget_estimate_high || b.budget_estimate_low || 0)) / 2
        return aAvg - bAvg
      }
      if (sortBy === 'cost_desc') {
        const aAvg = ((a.budget_estimate_low || 0) + (a.budget_estimate_high || a.budget_estimate_low || 0)) / 2
        const bAvg = ((b.budget_estimate_low || 0) + (b.budget_estimate_high || b.budget_estimate_low || 0)) / 2
        return bAvg - aAvg
      }
      if (sortBy === 'fit') {
        const fitOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
        return (fitOrder[a.strategic_fit] ?? 2) - (fitOrder[b.strategic_fit] ?? 2)
      }
      // priority (default)
      return (b.priority_score || 0) - (a.priority_score || 0)
    })

  const highCount = pipelineOpps.filter(o => o.strategic_fit === 'High').length
  const sponsorCount = pipelineOpps.filter(o => o.recommendation === 'Sponsor').length
  const speakingCount = pipelineOpps.filter(o => o.speaking_opportunity).length
  const addedCount = opportunities.filter(o => o.added_to_events).length
  const reviewCount = underReviewOpps.length
  const doNotAttendCount = doNotAttendOpps.length
  const competitorCount = pipelineOpps.filter(o => o.is_competitor_event).length

  const focusLabel = FOCUS_AREAS.find(f => f.val === focusArea)?.label || 'All Focus Areas'
  const regionLabel = REGIONS.find(r => r.val === region)?.label || 'Global'

  const FOCUS_LABELS: Record<string, string> = {
    all: 'All Areas', cx: 'CX & Customer Success', ai_tech: 'AI & Enterprise Tech',
    ignitetech: 'IgniteTech', community: 'Community', contact_center: 'Contact Center',
    social_media: 'Social Media', executive: 'Executive Leadership',
  }
  const FREQ_OPTIONS = [
    { hours: 24, label: 'Daily' },
    { hours: 48, label: 'Every 2 days' },
    { hours: 168, label: 'Weekly' },
  ]

  function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="p-8">

      {/* ── Generate Opportunities Confirmation Modal ── */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGenerateConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-violet-600 px-6 py-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347A3.99 3.99 0 0112 16a3.99 3.99 0 01-2.828-1.172l-.347-.347z"/>
              </svg>
              <div className="text-white font-semibold text-sm">Generate Opportunities</div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                Generate new opportunities using AI? The AI will search for events matching your preferences. Existing opportunities won&apos;t be deleted — the AI will add new ones and refresh details on any it finds again. Items in Under Review or Do Not Attend are not affected.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowGenerateConfirm(false); generate() }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Generate
                </button>
                <button
                  onClick={() => setShowGenerateConfirm(false)}
                  className="px-5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm as Event Pre-Confirmation Modal ── */}
      {confirmEventOpp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmEventOpp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-green-600 px-6 py-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              <div>
                <div className="text-white font-semibold text-sm">Confirm as Event</div>
                <div className="text-white/80 text-xs mt-0.5 truncate max-w-xs">{confirmEventOpp.name}</div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                This will create a new event from this opportunity and run an AI setup process to populate budget items, planning tasks, and vendor suggestions.
              </p>
              <p className="text-xs text-gray-400 italic">
                Once confirmed, this will create an event. If you change your mind, you can revert it to the Opportunities pipeline from the event detail page.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { const opp = confirmEventOpp; setConfirmEventOpp(null); addToEvents(opp) }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Confirm → Create Event
                </button>
                <button
                  onClick={() => setConfirmEventOpp(null)}
                  className="px-5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Do Not Attend Modal ── */}
      {dnaModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDnaModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              <div>
                <div className="text-white font-semibold text-sm">Move to Do Not Attend</div>
                <div className="text-white/80 text-xs mt-0.5 truncate max-w-xs">{dnaModal.opp.name}</div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dnaDraft.isCompetitor}
                  onChange={e => setDnaDraft(d => ({ ...d, isCompetitor: e.target.checked, notes: '' }))}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-800">This is a competitor-owned event</span>
              </label>

              {dnaDraft.isCompetitor ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Competitor name <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={dnaDraft.competitorName}
                    onChange={e => setDnaDraft(d => ({ ...d, competitorName: e.target.value }))}
                    placeholder="e.g. Salesforce, HubSpot…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason for exclusion <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={dnaDraft.notes}
                    onChange={e => setDnaDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="e.g. Poor audience fit, too expensive, scheduling conflict, not aligned with strategy…"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={confirmMoveToDoNotAttend}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Confirm — Do Not Attend
                </button>
                <button
                  onClick={() => setDnaModal(null)}
                  className="px-5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm-to-Event Progress Modal ── */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 ${confirming.step === 'done' ? 'bg-green-600' : confirming.step === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
              <div className="flex items-center gap-3">
                {confirming.step === 'done' ? (
                  <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ) : confirming.step === 'error' ? (
                  <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ) : (
                  <svg className="w-6 h-6 text-white flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                )}
                <div>
                  <div className="text-white font-semibold text-sm">
                    {confirming.step === 'done' ? 'Event Ready!' : confirming.step === 'error' ? 'Something went wrong' : 'Creating Event…'}
                  </div>
                  <div className="text-white/80 text-xs mt-0.5 truncate max-w-xs">{confirming.opp.name}</div>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-6 py-5 space-y-3">
              {[
                {
                  id: 'creating',
                  label: 'Event record created',
                  active: confirming.step === 'creating',
                  done: confirming.step !== 'creating',
                },
                {
                  id: 'researching',
                  label: confirming.step === 'researching'
                    ? 'Searching the web for sponsorship pricing, venue details & vendors…'
                    : 'Web research complete',
                  sublabel: confirming.step === 'researching' ? 'This takes about 30 seconds' : undefined,
                  active: confirming.step === 'researching',
                  done: confirming.step === 'done' || confirming.step === 'error',
                },
                {
                  id: 'done',
                  label: confirming.budgetAdded != null
                    ? `${confirming.budgetAdded} budget items${confirming.suggestedTotal ? ` · ${fmt(confirming.suggestedTotal)} estimated` : ''}`
                    : 'Budget & planning checklist',
                  active: false,
                  done: confirming.step === 'done',
                  pending: confirming.step !== 'done',
                },
                {
                  id: 'planning',
                  label: confirming.planningAdded != null
                    ? `${confirming.planningAdded} planning tasks created`
                    : 'Planning checklist',
                  active: false,
                  done: confirming.step === 'done',
                  pending: confirming.step !== 'done',
                },
                {
                  id: 'vendors',
                  label: confirming.vendorsLinked != null
                    ? `${confirming.vendorsLinked} vendor${confirming.vendorsLinked !== 1 ? 's' : ''} linked`
                    : 'Vendor matching',
                  active: false,
                  done: confirming.step === 'done',
                  pending: confirming.step !== 'done',
                },
              ].map(s => (
                <div key={s.id} className="flex items-start gap-3">
                  <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                    {s.done ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    ) : s.active ? (
                      <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                    )}
                  </div>
                  <div>
                    <div className={`text-sm ${s.done ? 'text-gray-900 font-medium' : s.active ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{s.label}</div>
                    {s.sublabel && <div className="text-xs text-gray-400 mt-0.5">{s.sublabel}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + actions */}
            {confirming.step === 'done' && (
              <>
                {confirming.summary && (
                  <div className="mx-6 mb-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed border border-gray-100">
                    {confirming.summary}
                  </div>
                )}
                <div className="px-6 pb-5 flex gap-3">
                  <button
                    onClick={() => { setConfirming(null); router.push(`/events/${confirming.eventId}`) }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    View Event
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                  </button>
                  <button onClick={() => setConfirming(null)} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Close
                  </button>
                </div>
              </>
            )}
            {confirming.step === 'error' && (
              <div className="px-6 pb-5">
                <p className="text-sm text-red-600 mb-3">{confirming.error}</p>
                <button onClick={() => setConfirming(null)} className="w-full border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-sm text-gray-500 mt-1">Live web search · AI-scored · continuously updated</p>
        </div>
        <div className="flex items-center gap-2">
          {opportunities.length > 0 && (
            <button
              onClick={() => {
                const currentTabOpps = pageTab === 'opportunities' ? filtered
                  : pageTab === 'under_review' ? filteredUnderReviewOpps
                  : doNotAttendOpps
                const headers = ['Name', 'Type', 'Start Date', 'Location', 'Expected Attendees', 'Budget Low', 'Budget High', 'Strategic Fit', 'Recommendation', 'Priority Score', 'Status']
                const rows = currentTabOpps.map(o => [
                  o.name,
                  o.type,
                  o.start_date || '',
                  o.location || '',
                  String(o.expected_attendees ?? ''),
                  String(o.budget_estimate_low ?? ''),
                  String(o.budget_estimate_high ?? ''),
                  o.strategic_fit,
                  o.recommendation,
                  String(o.priority_score ?? ''),
                  o.status || '',
                ])
                const filename = pageTab === 'opportunities' ? 'opportunities-pipeline.csv'
                  : pageTab === 'under_review' ? 'opportunities-under-review.csv'
                  : 'opportunities-do-not-attend.csv'
                downloadCSV(filename, rows, headers)
              }}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export CSV
            </button>
          )}
          <button onClick={() => setShowPrefsModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Search preferences
          </button>
          {showPrefsModal && (
            <SetupPreferencesModal onClose={() => setShowPrefsModal(false)} onSaved={() => setShowPrefsModal(false)} />
          )}
        </div>
      </div>

      {/* Auto-Discovery Status Bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-sm">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scanStatus?.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="font-medium text-gray-700">Auto-Discovery</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scanStatus?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {scanStatus?.enabled ? 'ON' : 'OFF'}
            </span>
            {scanStatus?.enabled && scanStatus.freq_hours && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500 text-xs">Searches for new opportunities matching your preferences every {scanStatus.freq_hours === 24 ? 'day' : scanStatus.freq_hours === 168 ? 'week' : `${scanStatus.freq_hours}h`}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowGenerateConfirm(true)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Run Now
                </>
              )}
            </button>
          <button
            onClick={() => setShowScanSettings(s => !s)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
            <svg className={`w-3 h-3 transition-transform ${showScanSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          </div>
        </div>

        {/* Settings panel */}
        {showScanSettings && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-6 flex-wrap text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={toggleEnabled}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${scanStatus?.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${scanStatus?.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-gray-600">Enable auto-scan</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Frequency:</span>
              <div className="flex gap-1">
                {FREQ_OPTIONS.map(opt => (
                  <button
                    key={opt.hours}
                    disabled={savingFreq}
                    onClick={() => saveFreq(opt.hours)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${scanStatus?.freq_hours === opt.hours ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button
                onClick={() => setShowGenerateConfirm(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Running…
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Run Now
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 text-gray-500 text-xs ml-auto max-w-sm text-right">
              When enabled, AI automatically searches the web for new events matching your preferences and adds the best ones to your pipeline.
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in ${toast.includes('Do Not Attend') ? 'bg-red-700' : toast.includes('restored') ? 'bg-gray-700' : 'bg-amber-600'}`}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {toast.includes('Do Not Attend')
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              : toast.includes('restored')
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>}
          </svg>
          <div>
            <div>{toast}</div>
            <div className={`text-xs mt-0.5 ${toast.includes('Do Not Attend') ? 'text-red-200' : toast.includes('restored') ? 'text-gray-300' : 'text-amber-200'}`}>
              {toast.includes('Do Not Attend') ? 'Moved to Do Not Attend tab ↑' : toast.includes('restored') ? 'Back in the pipeline' : 'Now viewing the Under Review tab ↑'}
            </div>
          </div>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => { setPageTab('opportunities'); router.replace('/opportunities', { scroll: false }) }}
          className={`flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-all ${pageTab === 'opportunities' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347A3.99 3.99 0 0112 16a3.99 3.99 0 01-2.828-1.172l-.347-.347z"/></svg>
          Opportunities
          <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${pageTab === 'opportunities' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>{pipelineOpps.length}</span>
        </button>
        <button
          onClick={() => { setPageTab('under_review'); router.replace('/opportunities?tab=under_review', { scroll: false }) }}
          className={`flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-all ${pageTab === 'under_review' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Under Review
          <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${pageTab === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>{underReviewOpps.length}</span>
          <Tooltip text="Shortlisted opportunities you're actively evaluating — not yet committed as events." icon position="bottom" />
        </button>
        <button
          onClick={() => { setPageTab('do_not_attend'); router.replace('/opportunities?tab=do_not_attend', { scroll: false }) }}
          className={`flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-all ${pageTab === 'do_not_attend' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
          Do Not Attend
          <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${pageTab === 'do_not_attend' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-500'}`}>{doNotAttendOpps.length}</span>
          <Tooltip text="Permanently excluded events. These will not resurface in AI scans." icon position="bottom" />
        </button>
      </div>


      {/* Stats bar */}
      {opportunities.length > 0 && pageTab === 'opportunities' && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: pipelineOpps.length, color: 'text-gray-900', sub: 'opportunities identified', hoverColor: 'hover:border-gray-400', active: false, onClick: () => { setFilterFit('all'); setFilterRec('all'); setFilterNew(false); setSearchQuery('') } },
            { label: 'New (48h)', value: newCount, color: 'text-blue-700', sub: 'click to filter', hoverColor: 'hover:border-blue-300', active: filterNew, onClick: () => { setFilterNew(f => !f); setFilterFit('all'); setFilterRec('all') } },
            { label: 'High Strategic Fit', value: highCount, color: 'text-green-700', sub: 'click to filter', hoverColor: 'hover:border-green-300', active: filterFit === 'High', onClick: () => { setFilterFit('High'); setFilterRec('all'); setFilterNew(false) } },
            { label: 'Under Review', value: reviewCount, color: 'text-amber-700', sub: 'pending approval →', hoverColor: 'hover:border-amber-300', active: false, onClick: () => { setPageTab('under_review'); router.replace('/opportunities?tab=under_review', { scroll: false }) } },
          ].map(s => (
            <button key={s.label} onClick={s.onClick}
              className={`rounded-xl border p-4 text-left ${s.hoverColor} hover:shadow-sm transition-all ${s.active ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs font-medium text-gray-600 mt-0.5">{s.label}</div>
              <div className={`text-xs mt-0.5 ${s.label === 'Under Review' ? 'text-amber-500' : 'text-gray-400'}`}>{s.sub}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── UNDER REVIEW TAB ───────────────────────────────────────────────── */}
      {pageTab === 'under_review' && (
        <div>
          {/* Section header */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Opportunities Under Review</p>
              <p className="text-xs text-amber-700 mt-0.5">These events have been shortlisted and are pending approval. Click <strong>Confirm → Events</strong> to add them to your event calendar, or <strong>Undo</strong> to return them to the pipeline.</p>
            </div>
          </div>
          {underReviewOpps.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-200 rounded-xl text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p className="font-medium text-sm">Nothing under review yet</p>
              <p className="text-xs mt-1">Click <strong>"Add to Review"</strong> on any opportunity to move it here for approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter + sort toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    value={urSearch} onChange={e => setUrSearch(e.target.value)}
                    placeholder="Search…"
                    className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 w-36"
                  />
                </div>
                {/* Quarter + Year filter — only shows combos that exist in the data */}
                {urAvailableQuarters.length > 0 && (
                  <select value={urQuarter} onChange={e => setUrQuarter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 text-gray-700">
                    <option value="">All Quarters</option>
                    {urAvailableQuarters.map(qy => {
                      const [q, y] = qy.split('-')
                      return <option key={qy} value={qy}>{q} {y} ({QUARTER_MONTH_LABELS[q]})</option>
                    })}
                  </select>
                )}
                {/* Sort */}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-gray-400">Sort:</span>
                  <select value={urSort} onChange={e => setUrSort(e.target.value as typeof urSort)}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 text-gray-700">
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                    <option value="budget">Budget</option>
                    <option value="fit">Strategic Fit</option>
                  </select>
                  <button
                    onClick={() => setUrSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                    title={urSortDir === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {urSortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </button>
                </div>
                {/* Clear filters */}
                {(urSearch || urQuarter) && (
                  <button onClick={() => { setUrSearch(''); setUrQuarter('') }}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    Clear
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {filteredUnderReviewOpps.length !== underReviewOpps.length
                  ? `${filteredUnderReviewOpps.length} of ${underReviewOpps.length} opportunit${underReviewOpps.length === 1 ? 'y' : 'ies'} shown`
                  : `${underReviewOpps.length} opportunit${underReviewOpps.length === 1 ? 'y' : 'ies'} pending approval`
                } — confirm to add to Events, or remove to return to pipeline.
              </p>
              {filteredUnderReviewOpps.length === 0 && (
                <div className="text-center py-12 border border-dashed border-amber-200 rounded-xl text-gray-400">
                  <p className="text-sm">No opportunities match your filters.</p>
                </div>
              )}
              {filteredUnderReviewOpps.map(opp => (
                <div key={opp.id} className="bg-white border-2 border-amber-200 rounded-xl p-5 flex gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 flex-wrap mb-2">
                      <h3 className="text-base font-bold text-gray-900">{opp.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${FIT_COLORS[opp.strategic_fit] || FIT_COLORS.Medium}`}>{opp.strategic_fit} fit</span>
                      {opp.relevant_for === 'ignitetech' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium">IgniteTech</span>}
                      {opp.relevant_for === 'khoros' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">Khoros</span>}
                      {opp.relevant_for === 'both' && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium">Both</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                      {opp.start_date && <span>📅 {new Date(opp.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      {opp.location && <span>📍 {opp.location}</span>}
                      {(opp.budget_estimate_low || opp.budget_estimate_high) && (
                        <span>💰 {opp.budget_estimate_low && opp.budget_estimate_high ? `${fmt(opp.budget_estimate_low)} – ${fmt(opp.budget_estimate_high)}` : fmt(opp.budget_estimate_high || opp.budget_estimate_low || 0)}</span>
                      )}
                      {opp.website && (
                        <a href={opp.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                          Website
                        </a>
                      )}
                    </div>
                    {opp.description && <p className="text-sm text-gray-600 mb-2">{opp.description}</p>}
                    {opp.speaking_opportunity && (
                      <div className="flex items-start gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mb-2">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                        <span><strong>Speaking:</strong> {opp.speaking_opportunity}</span>
                      </div>
                    )}
                    {/* Review Notes */}
                    <div className="mt-3 pt-3 border-t border-amber-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          Review Notes
                        </label>
                        {savedNotes[opp.id!] && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                            Saved
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Where are we in the review process? e.g. pricing requested, awaiting budget approval, speaking slot confirmed…"
                        value={reviewNotesDraft[opp.id!] ?? (opp.review_notes || '')}
                        onChange={e => setReviewNotesDraft(d => ({ ...d, [opp.id!]: e.target.value }))}
                        onBlur={e => saveReviewNotes(opp, e.target.value)}
                        className="w-full text-sm text-gray-700 bg-amber-50/60 border border-amber-200 rounded-lg px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 w-36">
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-center font-medium">
                      ⏳ Under Review
                    </div>
                    <button
                      onClick={() => setConfirmEventOpp(opp)}
                      disabled={adding[opp.id!]}
                      className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {adding[opp.id!] ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      )}
                      Confirm → Events
                    </button>
                    <button
                      onClick={() => removeFromReview(opp)}
                      className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                      Undo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DO NOT ATTEND TAB ─────────────────────────────────────────────── */}
      {pageTab === 'do_not_attend' && (
        <div>
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Do Not Attend</p>
              <p className="text-xs text-red-700 mt-0.5">These events have been excluded from consideration — either because they are run by a direct competitor, or because they were manually flagged. They will not appear in the pipeline. Click <strong>Restore</strong> to reconsider any item.</p>
            </div>
          </div>

          {doNotAttendOpps.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-200 rounded-xl text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              <p className="font-medium text-sm">No events flagged yet</p>
              <p className="text-xs mt-1">Use the <strong>"Do Not Attend"</strong> button on any opportunity card to move it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {doNotAttendOpps.map(opp => (
                <div key={opp.id} className="bg-white border border-red-200 rounded-xl p-5 opacity-85">
                  <div className="flex gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 flex-wrap mb-2">
                        <h3 className="text-base font-bold text-gray-700">{opp.name}</h3>
                        {opp.is_competitor_event ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Competitor-owned{opp.competitor_name ? ` (${opp.competitor_name})` : ''}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium">Manually excluded</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-2">
                        {opp.start_date && <span>📅 {new Date(opp.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                        {opp.location && <span>📍 {opp.location}</span>}
                        {opp.website && (
                          <a href={opp.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-600 hover:underline font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            Website
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0 w-40">
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 text-center font-medium">
                        🚫 Do Not Attend
                      </div>
                      <button
                        onClick={() => {
                          setDnaEditingId(opp.id!)
                          setDnaEditDraft({
                            isCompetitor: !!(opp.is_competitor_event),
                            competitorName: opp.competitor_name || '',
                            notes: opp.dna_notes || '',
                          })
                        }}
                        className="flex items-center justify-center gap-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Edit Notes
                      </button>
                      <button
                        onClick={() => restoreFromDoNotAttend(opp)}
                        className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        Restore
                      </button>
                    </div>
                  </div>

                  {/* Notes section */}
                  {dnaEditingId === opp.id ? (
                    <div className="mt-4 pt-4 border-t border-red-100">
                      <p className="text-xs font-semibold text-gray-600 mb-3">Edit exclusion details</p>
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dnaEditDraft.isCompetitor}
                          onChange={e => setDnaEditDraft(d => ({ ...d, isCompetitor: e.target.checked, notes: e.target.checked ? '' : d.notes }))}
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">Competitor-owned event</span>
                      </label>
                      {dnaEditDraft.isCompetitor ? (
                        <input
                          type="text"
                          value={dnaEditDraft.competitorName}
                          onChange={e => setDnaEditDraft(d => ({ ...d, competitorName: e.target.value }))}
                          placeholder="Competitor name (optional)"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-3"
                        />
                      ) : (
                        <textarea
                          value={dnaEditDraft.notes}
                          onChange={e => setDnaEditDraft(d => ({ ...d, notes: e.target.value }))}
                          placeholder="Why was this excluded? (e.g. poor audience fit, too expensive, scheduling conflict…)"
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-3"
                        />
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => saveDnaEdit(opp)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
                        <button onClick={() => setDnaEditingId(null)} className="px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 text-xs font-medium rounded-lg transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (opp.dna_notes || opp.competitor_name) ? (
                    <div className="mt-3 pt-3 border-t border-red-100">
                      {opp.is_competitor_event && opp.competitor_name ? (
                        <p className="text-xs text-red-600 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          Owned by {opp.competitor_name}
                        </p>
                      ) : opp.dna_notes ? (
                        <p className="text-xs text-gray-500 flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                          <span className="italic">{opp.dna_notes}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-red-100">
                      <button
                        onClick={() => {
                          setDnaEditingId(opp.id!)
                          setDnaEditDraft({ isCompetitor: !!(opp.is_competitor_event), competitorName: opp.competitor_name || '', notes: opp.dna_notes || '' })
                        }}
                        className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        Add a note about why this was excluded
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OPPORTUNITIES TAB ──────────────────────────────────────────────── */}
      {/* Search bar */}
      {pageTab === 'opportunities' && opportunities.length > 0 && (
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search opportunities by name, location, organiser, focus area…"
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      {pageTab === 'opportunities' && opportunities.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 mb-5 flex flex-col gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            {visibleFilters.includes('fit') && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium mr-1">Fit:</span>
                {['all','High','Medium','Low'].map(f => (
                  <button key={f} onClick={() => setFilterFit(f)}
                    className={`px-2.5 py-1 rounded-full border transition-colors ${filterFit===f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            )}
            {visibleFilters.includes('fit') && visibleFilters.includes('focus') && <div className="w-px h-5 bg-gray-200" />}
            {visibleFilters.includes('focus') && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium mr-1">Focus:</span>
                <select
                  value={filterFocus}
                  onChange={e => setFilterFocus(e.target.value)}
                  className="h-7 border border-gray-200 rounded-lg px-2 py-0 text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 cursor-pointer"
                >
                  <option value="all">All Focus Areas</option>
                  {(userFocusAreas.length > 0
                    ? FOCUS_AREAS.filter(f => f.val !== 'all' && userFocusAreas.includes(f.val))
                    : FOCUS_AREAS.filter(f => f.val !== 'all')
                  ).map(f => (
                    <option key={f.val} value={f.val}>{f.label.replace(/^[^\w\s]*\s*/, '')}</option>
                  ))}
                </select>
              </div>
            )}
            {visibleFilters.includes('focus') && visibleFilters.includes('region') && <div className="w-px h-5 bg-gray-200" />}
            {visibleFilters.includes('region') && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium mr-1">Region:</span>
                {[
                  { v: 'all', l: 'All' },
                  ...(userRegions.length > 0
                    ? [
                        { v: 'north_america', l: 'N. America' },
                        { v: 'europe', l: 'Europe' },
                        { v: 'apac', l: 'APAC' },
                      ].filter(r => userRegions.includes(r.v))
                    : [
                        { v: 'north_america', l: 'N. America' },
                        { v: 'europe', l: 'Europe' },
                        { v: 'apac', l: 'APAC' },
                      ]
                  )
                ].map(r => (
                  <button key={r.v} onClick={() => setFilterRegion(r.v)}
                    className={`px-2.5 py-1 rounded-full border transition-colors ${filterRegion===r.v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {r.l}
                  </button>
                ))}
              </div>
            )}
            {visibleFilters.includes('region') && visibleFilters.includes('date') && <div className="w-px h-5 bg-gray-200" />}
            {visibleFilters.includes('date') && (
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className="text-gray-500 font-medium mr-1">Date:</span>
                {[
                  { v: 'all', l: 'All' },
                  { v: 'q2_2026', l: 'Q2 2026' },
                  { v: 'q3_2026', l: 'Q3 2026' },
                  { v: 'q4_2026', l: 'Q4 2026' },
                  { v: 'q1_2027', l: 'Q1 2027' },
                  { v: 'q2_2027', l: 'Q2 2027' },
                  { v: 'q3_2027', l: 'Q3 2027' },
                  { v: 'q4_2027', l: 'Q4 2027' },
                  { v: 'custom', l: 'Custom…' },
                ].map(d => (
                  <button key={d.v} onClick={() => setFilterDatePreset(d.v)}
                    className={`px-2.5 py-1 rounded-full border transition-colors ${filterDatePreset === d.v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {d.l}
                  </button>
                ))}
                {filterDatePreset === 'custom' && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <span className="text-gray-400">→</span>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                )}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {/* Cards / List view toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => { setOppView('cards'); localStorage.setItem('opp_view', 'cards') }}
                  className={`px-2.5 py-1 flex items-center gap-1 transition-colors ${oppView === 'cards' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="Cards view"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                  </svg>
                  Cards
                </button>
                <button
                  onClick={() => { setOppView('list'); localStorage.setItem('opp_view', 'list') }}
                  className={`px-2.5 py-1 flex items-center gap-1 transition-colors border-l border-gray-200 ${oppView === 'list' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="List view"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                  List
                </button>
              </div>
              {visibleFilters.includes('sort') && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-500 font-medium mr-1">Sort:</span>
                  {([
                    {v:'priority',l:'Priority Score'},
                    {v:'fit',l:'Strategic Fit'},
                    {v:'date',l:'Date'},
                    {v:'cost_asc',l:'Cost ↑'},
                    {v:'cost_desc',l:'Cost ↓'},
                  ] as {v: 'priority'|'fit'|'date'|'cost_asc'|'cost_desc', l: string}[]).map(s => (
                    <button key={s.v} onClick={() => setSortBy(s.v)}
                      className={`px-2.5 py-1 rounded-full border transition-colors ${sortBy===s.v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              )}
              {/* Customize filters gear */}
              <div className="relative">
                <button onClick={() => setShowFilterCustomizer(s => !s)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${showFilterCustomizer ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
                  title="Customise filters">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
                {showFilterCustomizer && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-10 min-w-[160px]">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Show filters</p>
                    {[
                      { key: 'fit', label: 'Strategic Fit' },
                      { key: 'focus', label: 'Focus Area' },
                      { key: 'region', label: 'Region' },
                      { key: 'date', label: 'Date' },
                      { key: 'sort', label: 'Sort' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-2 py-1 cursor-pointer text-xs text-gray-700 hover:text-gray-900">
                        <input type="checkbox" checked={visibleFilters.includes(f.key)} onChange={() => toggleVisibleFilter(f.key)}
                          className="w-3.5 h-3.5 rounded accent-violet-600" />
                        {f.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {pageTab === 'opportunities' && error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Full-screen spinner only when no data yet */}
      {pageTab === 'opportunities' && (initialLoading || (loading && opportunities.length === 0)) && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-4">
          <svg className="w-10 h-10 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">
              {loading ? `Claude is scanning for opportunities…` : 'Loading saved opportunities...'}
            </p>
            {loading && <p className="text-xs text-gray-400 mt-1">Searching the web, scoring events by audience fit and strategic value</p>}
          </div>
        </div>
      )}

      {/* Subtle refresh banner when scanning with existing data visible */}
      {pageTab === 'opportunities' && loading && opportunities.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
          <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Claude is scanning for new opportunities in the background — results will update automatically
        </div>
      )}

      {pageTab === 'opportunities' && !loading && !initialLoading && filtered.length === 0 && opportunities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to find your first opportunities</h3>
          <p className="text-sm text-gray-500 mb-8 max-w-sm text-center">
            Click the button below and Claude will search the web for conferences, summits, and industry events — scoring each one for audience fit, strategic value, and speaking potential.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            Run AI Search
          </button>
          <p className="text-xs text-gray-400 mt-4">Usually takes 30–60 seconds · powered by live web search</p>
        </div>
      )}

      {pageTab === 'opportunities' && !loading && !initialLoading && filtered.length > 0 && oppView === 'list' && (
        <>
          {generatedAt && (
            <p className="text-xs text-gray-400 mb-4">
              Last updated {new Date(generatedAt).toLocaleString()} · showing {filtered.length} of {pipelineOpps.length} opportunities
            </p>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* List header */}
            <div className="grid grid-cols-[1fr_140px_110px_120px_110px_36px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div>Event</div>
              <div>Location</div>
              <div>Strategic Fit</div>
              <div>Priority</div>
              <div>Recommendation</div>
              <div />
            </div>
            {filtered.map((opp, i) => {
              const isRowExpanded = listExpandedId === (opp.id ?? i)
              return (
                <div key={opp.id ?? i} className={`border-b border-gray-100 last:border-b-0 ${opp.added_to_events ? 'bg-green-50/30' : opp.is_competitor_event ? 'bg-red-50/20' : ''}`}>
                  {/* Row */}
                  <div className="grid grid-cols-[1fr_140px_110px_120px_110px_36px] gap-3 items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                    {/* Event name + date */}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{opp.name}</div>
                      {opp.start_date && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(opp.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    {/* Location */}
                    <div className="text-xs text-gray-500 truncate">{opp.location || '—'}</div>
                    {/* Strategic Fit */}
                    <div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${FIT_COLORS[opp.strategic_fit] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {opp.strategic_fit}
                      </span>
                    </div>
                    {/* Priority Score */}
                    <div>
                      {opp.priority_score != null ? <PriorityBar score={opp.priority_score} /> : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    {/* Recommendation */}
                    <div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${REC_COLORS[opp.recommendation] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {opp.recommendation}
                      </span>
                    </div>
                    {/* Chevron */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => setListExpandedId(isRowExpanded ? null : (opp.id ?? i))}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${isRowExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Inline expanded detail */}
                  {isRowExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100 space-y-2">
                      {opp.description && (
                        <p className="text-sm text-gray-700 leading-relaxed">{opp.description}</p>
                      )}
                      {opp.audience_match && (
                        <div className="text-xs bg-blue-50 text-blue-800 border border-blue-100 rounded-lg px-3 py-2">
                          <strong>Audience match:</strong> {opp.audience_match}
                        </div>
                      )}
                      {opp.speaking_opportunity && (
                        <div className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-lg px-3 py-2">
                          <strong>Speaking opportunity:</strong> {opp.speaking_opportunity}
                        </div>
                      )}
                      {opp.why_now && (
                        <div className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-3 py-2">
                          <strong>Why now:</strong> {opp.why_now}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {pageTab === 'opportunities' && !loading && !initialLoading && filtered.length > 0 && oppView === 'cards' && (
        <>
          {generatedAt && (
            <p className="text-xs text-gray-400 mb-4">
              Last updated {new Date(generatedAt).toLocaleString()} · showing {filtered.length} of {pipelineOpps.length} opportunities
            </p>
          )}
          <div className="space-y-3">
            {filtered.map((opp, i) => {
              const isExpanded = expandedId === (opp.id || i)
              return (
                <div
                  key={opp.id || i}
                  className={`bg-white rounded-xl border shadow-sm transition-colors ${opp.added_to_events ? 'border-green-200 bg-green-50/20' : opp.is_competitor_event ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-blue-200'}`}
                >
                  {/* Main row */}
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Title + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="font-semibold text-gray-900 text-base leading-tight">{opp.name}</h3>
                          {isNew(opp) && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-500 text-white border border-blue-500">New</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${FIT_COLORS[opp.strategic_fit] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {opp.strategic_fit} Fit
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${REC_COLORS[opp.recommendation] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {opp.recommendation}
                          </span>
                          {opp.speaking_opportunity && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                              Speaking Opp
                            </span>
                          )}
                          {opp.focus_area && (
                            <span className="rounded-full px-2 py-0.5 text-xs text-gray-500 bg-gray-50 border border-gray-100">
                              {opp.focus_area}
                            </span>
                          )}
                          {opp.relevant_for === 'ignitetech' && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">IgniteTech</span>
                          )}
                          {opp.relevant_for === 'khoros' && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Khoros</span>
                          )}
                          {opp.relevant_for === 'both' && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">Both companies</span>
                          )}
                          {opp.is_competitor_event ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border border-red-200">⚠ Competitor-owned event</span>
                          ) : null}
                          {opp.added_to_events ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 border border-green-200">✓ In Events</span>
                          ) : null}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 flex-wrap">
                          {opp.start_date && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                              {new Date(opp.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {opp.end_date && opp.end_date !== opp.start_date && ` – ${new Date(opp.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            </span>
                          )}
                          {opp.location && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                              {opp.location}
                            </span>
                          )}
                          {opp.venue && <span className="text-gray-400">{opp.venue}</span>}
                          {opp.expected_attendees && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                              {opp.expected_attendees.toLocaleString()} attendees
                            </span>
                          )}
                          {(opp.budget_estimate_low || opp.budget_estimate_high) && (
                            <span className="flex items-center gap-1 font-medium text-gray-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              {fmt(opp.budget_estimate_low!)} – {fmt(opp.budget_estimate_high!)}
                            </span>
                          )}
                          {opp.organizer && <span className="text-gray-400">by {opp.organizer}</span>}
                          {opp.website && (
                            <a href={opp.website} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              Website
                            </a>
                          )}
                        </div>

                        {/* Description */}
                        {opp.description && (
                          <p className="text-sm text-gray-600 mb-3 leading-relaxed">{opp.description}</p>
                        )}

                        {/* Key callouts - always visible */}
                        <div className="grid grid-cols-1 gap-1.5">
                          {opp.audience_match && (
                            <div className={`text-xs rounded-lg px-3 py-2 border ${
                              opp.relevant_for === 'ignitetech' ? 'bg-orange-50 text-orange-800 border-orange-100' :
                              opp.relevant_for === 'both' ? 'bg-blue-50 text-blue-800 border-blue-100' :
                              'bg-blue-50 text-blue-800 border-blue-100'
                            }`}>
                              <strong>
                                {opp.relevant_for === 'ignitetech' ? 'Why IgniteTech:' :
                                 opp.relevant_for === 'both' ? 'Why both companies:' :
                                 'Why Khoros:'}
                              </strong>{' '}{opp.audience_match}
                            </div>
                          )}
                          {opp.speaking_opportunity && (
                            <div className="text-xs bg-purple-50 text-purple-700 rounded-lg px-3 py-2 border border-purple-100">
                              <strong>Eric Vaughan speaking:</strong> {opp.speaking_opportunity}
                            </div>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                            {opp.past_sponsors && (
                              <div className="text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-2 border border-orange-100">
                                <strong>Competitive presence (past sponsors):</strong> {opp.past_sponsors}
                              </div>
                            )}
                            {opp.networking_value && (
                              <div className="text-xs bg-teal-50 text-teal-700 rounded-lg px-3 py-2 border border-teal-100">
                                <strong>Who you&apos;ll meet:</strong> {opp.networking_value}
                              </div>
                            )}
                            {opp.why_now && (
                              <div className="text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2 border border-amber-100">
                                <strong>Why 2026:</strong> {opp.why_now}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expand/collapse toggle */}
                        {(opp.past_sponsors || opp.networking_value || opp.why_now) && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : (opp.id || i))}
                            className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>Show less <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg></>
                            ) : (
                              <>Show competitive intel & networking <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg></>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Action column */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[136px]">
                        {opp.priority_score != null && (
                          <div className="text-right">
                            <PriorityBar score={opp.priority_score} />
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-xs text-gray-400">Priority score</span>
                              <div className="relative group/tip">
                                <svg className="w-3 h-3 text-gray-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <div className="absolute right-0 bottom-5 hidden group-hover/tip:block w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl z-20 leading-relaxed">
                                  Scored 0–100 based on audience fit for your target customer, event scale, competitive importance, and cost efficiency.
                                  <div className="absolute right-1 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {opp.added_to_events ? (
                          <button
                            onClick={() => {
                              const eid = opp.id ? addedEventIds[opp.id] : null
                              router.push(eid ? `/events/${eid}` : '/events')
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                            {opp.id && addedEventIds[opp.id] ? 'Open Event →' : 'In Events'}
                          </button>
                        ) : opp.is_competitor_event ? (
                          <>
                            <div className="w-full text-center text-xs bg-red-100 text-red-700 border border-red-200 rounded-lg px-2.5 py-1.5 font-medium leading-snug">
                              ⚠ Competitor event<br/>
                              <span className="text-red-500 font-normal">({opp.competitor_name})</span>
                            </div>
                            <button onClick={() => moveToDoNotAttend(opp)}
                              className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                              Do Not Attend
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => moveToReview(opp)} disabled={adding[opp.id!]}
                              className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold">
                              {adding[opp.id!] ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                              )}
                              Add to Review
                            </button>
                            <button onClick={() => moveToDoNotAttend(opp)}
                              className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-500 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                              Do Not Attend
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {pageTab === 'opportunities' && !loading && !initialLoading && filtered.length === 0 && pipelineOpps.length > 0 && (
        <div className="py-16 text-center text-gray-400">
          <p className="font-medium">No opportunities match your current filters</p>
          <p className="text-sm mt-1">Try clearing some filters or running a new search above</p>
        </div>
      )}
    </div>
  )
}
