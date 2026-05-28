'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const VALID_FOCUS_AREAS = ['all', 'community', 'cx', 'social', 'executive', 'technology', 'marketing', 'sales']
const VALID_REGIONS = ['north_america', 'latin_america', 'europe', 'united_kingdom', 'middle_east', 'africa', 'apac', 'southeast_asia', 'global']

const FOCUS_OPTIONS = [
  { val: 'cx',             label: 'CX & Customer Success' },
  { val: 'community',      label: 'Community Management' },
  { val: 'contact_center', label: 'Contact Center' },
  { val: 'social_media',   label: 'Social Media & MarTech' },
  { val: 'ai_tech',        label: 'AI & Enterprise Tech' },
  { val: 'executive',      label: 'Executive Leadership' },
]
const REGION_OPTIONS = [
  { val: 'north_america',  label: 'North America' },
  { val: 'latam',          label: 'Latin America' },
  { val: 'europe',         label: 'Europe' },
  { val: 'uk',             label: 'United Kingdom' },
  { val: 'middle_east',    label: 'Middle East' },
  { val: 'africa',         label: 'Africa' },
  { val: 'apac',           label: 'APAC' },
  { val: 'southeast_asia', label: 'Southeast Asia' },
  { val: 'global',         label: 'Global / Virtual' },
]

type CompanyProfile = {
  id: string
  name: string
  website_url: string
  description?: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
  closeLabel?: string
  isFirstTime?: boolean
}

export default function SetupPreferencesModal({ onClose, onSaved, closeLabel = 'Close', isFirstTime = false }: Props) {
  const router = useRouter()

  // ── Top-level screen state ──────────────────────────────────────────────
  // 'company_setup'  : first-time — enter company name + website
  // 'social_prompt'  : rare — AI couldn't find social profiles, ask user to add them
  // 'form'           : manual edit screen (returning users, or after "fill manually" escape)
  // 'vendor_review'  : post-enrichment vendor seeding
  // 'saved'          : success
  type Screen = 'company_setup' | 'social_prompt' | 'form' | 'vendor_review' | 'saved'
  const [screen, setScreen] = useState<Screen>('company_setup')

  // ── Profile fields ──────────────────────────────────────────────────────
  const [companyName, setCompanyName]         = useState('')
  const [companies, setCompanies]             = useState<CompanyProfile[]>([])
  const [brands, setBrands]                   = useState('')
  const [speakerName, setSpeakerName]         = useState('')
  const [customerProfile, setCustomerProfile] = useState('')
  const [focusAreas, setFocusAreas]           = useState<string[]>([])
  const [customFocusInput, setCustomFocusInput] = useState('')
  const [regions, setRegions]                 = useState<string[]>(['north_america'])
  const [customRegionInput, setCustomRegionInput] = useState('')
  const [yourName, setYourName]               = useState('')
  const [saving, setSaving]                   = useState(false)
  const [loadingPrefs, setLoadingPrefs]       = useState(true)
  const [hasExistingPrefs, setHasExistingPrefs] = useState(false)

  // ── Company setup step ─────────────────────────────────────────────────
  const [companyNameInput, setCompanyNameInput] = useState('')
  const [websiteInput, setWebsiteInput]         = useState('')
  const [enrichLoading, setEnrichLoading]       = useState(false)
  const [enrichError, setEnrichError]           = useState<string | null>(null)
  const [enrichedFrom, setEnrichedFrom]         = useState<string | null>(null)

  // ── Social prompt step ─────────────────────────────────────────────────
  // Shown only when AI couldn't find social profiles on its own
  const [socialLinkedinInput, setSocialLinkedinInput] = useState('')
  const [socialTwitterInput, setSocialTwitterInput]   = useState('')
  // Saved enrichment payload waiting for social URLs before proceeding
  type EnrichedPayload = {
    finalCompany: CompanyProfile
    finalProfile: string
    finalFocusAreas: string[]
    finalRegions: string[]
    finalSpeakerName: string
  }
  const [pendingPayload, setPendingPayload] = useState<EnrichedPayload | null>(null)

  // ── Add-company inline form (in manual edit screen) ────────────────────
  const [addingCompany, setAddingCompany]             = useState(false)
  const [newCompanyName, setNewCompanyName]           = useState('')
  const [newCompanyUrl, setNewCompanyUrl]             = useState('')
  const [newCompanyEnriching, setNewCompanyEnriching] = useState(false)
  const [newCompanyError, setNewCompanyError]         = useState('')

  // ── Vendor seeding ──────────────────────────────────────────────────────
  type VendorSuggestion = { name: string; category: string; website: string | null; notes: string }
  const [vendorSuggestions, setVendorSuggestions]   = useState<VendorSuggestion[]>([])
  const [selectedVendors, setSelectedVendors]       = useState<Set<number>>(new Set())
  const [vendorLoading, setVendorLoading]           = useState(false)
  const [vendorAdding, setVendorAdding]             = useState(false)
  const [vendorAddedCount, setVendorAddedCount]     = useState(0)

  // ── Load existing prefs ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, unknown>) => {
        if (typeof s.user_name === 'string' && s.user_name)             setYourName(s.user_name)
        if (typeof s.opp_company_name === 'string' && s.opp_company_name) {
          setCompanyName(s.opp_company_name)
          setHasExistingPrefs(true)
        }
        if (typeof s.opp_brands === 'string' && s.opp_brands)           setBrands(s.opp_brands)
        if (typeof s.opp_speaker_name === 'string' && s.opp_speaker_name) setSpeakerName(s.opp_speaker_name)
        if (typeof s.opp_customer_profile === 'string' && s.opp_customer_profile) setCustomerProfile(s.opp_customer_profile)
        if (typeof s.opp_focus_areas === 'string' && s.opp_focus_areas) setFocusAreas(s.opp_focus_areas.split(',').filter(Boolean))
        if (typeof s.opp_regions === 'string' && s.opp_regions)         setRegions(s.opp_regions.split(',').filter(Boolean))
        if (Array.isArray(s.company_profiles) && s.company_profiles.length > 0) {
          setCompanies(s.company_profiles as CompanyProfile[])
        } else if (typeof s.opp_company_name === 'string' && s.opp_company_name) {
          setCompanies([{
            id: '1',
            name: s.opp_company_name,
            website_url: typeof s.website_url === 'string' ? s.website_url : '',
          }])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrefs(false))
  }, [])

  // Returning users (prefs already set) go straight to the manual edit form
  useEffect(() => {
    if (!loadingPrefs && hasExistingPrefs) {
      setScreen('form')
    }
  }, [loadingPrefs, hasExistingPrefs])

  // ── Helpers ─────────────────────────────────────────────────────────────
  const getDomain = (url: string) => {
    if (!url) return ''
    try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
  }

  // Kick off vendor seeding and move to vendor_review screen
  const startVendorReview = (payload: EnrichedPayload) => {
    setScreen('vendor_review')
    setVendorLoading(true)
    fetch('/api/vendors/seed-from-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        focus_areas: payload.finalFocusAreas,
        regions: payload.finalRegions,
        company_name: payload.finalCompany.name,
        customer_profile: payload.finalProfile,
      }),
    })
      .then(r => r.json())
      .then((data: { success: boolean; vendors?: VendorSuggestion[] }) => {
        if (data.success && Array.isArray(data.vendors)) {
          setVendorSuggestions(data.vendors)
          setSelectedVendors(new Set(data.vendors.map((_, i) => i)))
        }
      })
      .catch(() => {})
      .finally(() => setVendorLoading(false))
  }

  // ── AI enrichment ───────────────────────────────────────────────────────
  const runEnrich = async () => {
    if (!websiteInput.trim()) return
    setEnrichLoading(true)
    setEnrichError(null)
    try {
      const res = await fetch('/api/enrich-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: websiteInput.trim(),
          companyNameHint: companyNameInput.trim() || undefined,
        }),
      })
      const data = await res.json() as {
        success: boolean
        error?: string
        profile?: {
          company_name?: string
          company_description?: string
          focus_areas?: string[]
          regions?: string[]
          speaker_name?: string | null
          website_url?: string
          social_profiles_found?: boolean
        }
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not research company — please try again')
      const p = data.profile!

      const enrichedName      = p.company_name || companyNameInput.trim() || websiteInput.trim()
      const extractedProfile  = p.company_description || ''
      const extractedFocusAreas = Array.isArray(p.focus_areas) ? p.focus_areas.filter(v => VALID_FOCUS_AREAS.includes(v)) : []
      const extractedRegions    = Array.isArray(p.regions) ? p.regions.filter(v => VALID_REGIONS.includes(v)) : []
      const extractedSpeakerName = p.speaker_name || ''
      const socialFound = p.social_profiles_found !== false // default true if field absent

      const finalCompany: CompanyProfile = {
        id: Date.now().toString(),
        name: enrichedName,
        website_url: websiteInput.trim(),
        description: extractedProfile,
      }

      // Update display state
      setCompanyName(enrichedName)
      setCustomerProfile(extractedProfile)
      if (extractedFocusAreas.length) setFocusAreas(extractedFocusAreas)
      if (extractedRegions.length)    setRegions(extractedRegions)
      if (extractedSpeakerName)       setSpeakerName(extractedSpeakerName)
      setCompanies([finalCompany])
      try {
        setEnrichedFrom(new URL(websiteInput.trim()).hostname.replace(/^www\./, ''))
      } catch { setEnrichedFrom(websiteInput.trim()) }

      const payload: EnrichedPayload = {
        finalCompany,
        finalProfile: extractedProfile,
        finalFocusAreas: extractedFocusAreas,
        finalRegions: extractedRegions,
        finalSpeakerName: extractedSpeakerName,
      }

      // Save to DB immediately
      setSaving(true)
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opp_prefs_configured: 'true',
          user_name: yourName.trim(),
          opp_company_name: finalCompany.name,
          opp_speaker_name: extractedSpeakerName,
          opp_customer_profile: extractedProfile,
          opp_focus_areas: extractedFocusAreas.join(','),
          opp_regions: extractedRegions.join(','),
          company_profiles: [finalCompany],
        }),
      })
      setSaving(false)

      if (isFirstTime) {
        if (!socialFound) {
          // AI couldn't find social profiles — ask the user (rare)
          setPendingPayload(payload)
          setScreen('social_prompt')
        } else {
          startVendorReview(payload)
        }
      } else {
        onSaved()
      }
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Research failed — please try again')
    } finally {
      setEnrichLoading(false)
      setSaving(false)
    }
  }

  // Called from social_prompt screen — save any extra URLs and proceed
  const proceedFromSocialPrompt = async () => {
    if ((socialLinkedinInput.trim() || socialTwitterInput.trim()) && pendingPayload) {
      // Save extra social URLs for future use
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_linkedin_url: socialLinkedinInput.trim() || undefined,
          company_twitter_url: socialTwitterInput.trim() || undefined,
        }),
      }).catch(() => {})
    }
    if (pendingPayload) startVendorReview(pendingPayload)
    else onSaved()
  }

  // ── Manual save (form screen) ────────────────────────────────────────────
  const save = async () => {
    const effectiveCompanyName = companies[0]?.name || companyName.trim()
    if (!effectiveCompanyName) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opp_prefs_configured: 'true',
        user_name: yourName.trim(),
        opp_company_name: effectiveCompanyName,
        opp_brands: brands.trim(),
        opp_speaker_name: speakerName.trim(),
        opp_customer_profile: customerProfile.trim(),
        opp_focus_areas: focusAreas.join(','),
        opp_regions: regions.join(','),
        company_profiles: companies,
        opp_manual_profile: JSON.stringify({
          company_name: effectiveCompanyName,
          company_description: customerProfile.trim(),
          focus_areas: focusAreas,
          regions: regions,
          speaker_name: speakerName.trim(),
        }),
      }),
    })

    if (yourName.trim()) {
      try {
        const existingRes = await fetch('/api/team-members')
        if (existingRes.ok) {
          const existingData = await existingRes.json()
          const members = Array.isArray(existingData) ? existingData : (existingData.members ?? [])
          const alreadyHasMe = members.some((m: { is_me?: number }) => m.is_me === 1)
          if (!alreadyHasMe) {
            const nameParts = yourName.trim().split(' ')
            await fetch('/api/team-members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ first_name: nameParts[0], last_name: nameParts.slice(1).join(' ') || null, email: null, is_me: 1, role: 'user' }),
            })
          }
        }
      } catch { /* non-fatal */ }
    }

    setSaving(false)
    if (isFirstTime) {
      const payload: EnrichedPayload = {
        finalCompany: companies[0] || { id: '1', name: effectiveCompanyName, website_url: '' },
        finalProfile: customerProfile.trim(),
        finalFocusAreas: focusAreas,
        finalRegions: regions,
        finalSpeakerName: speakerName.trim(),
      }
      startVendorReview(payload)
    } else {
      onSaved()
    }
  }

  // ── Vendor actions ──────────────────────────────────────────────────────
  const addSelectedVendors = async () => {
    if (selectedVendors.size === 0) { setScreen('saved'); return }
    setVendorAdding(true)
    const toAdd = vendorSuggestions.filter((_, i) => selectedVendors.has(i))
    try {
      await Promise.all(toAdd.map(v =>
        fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: v.name, category: v.category, website: v.website || undefined, notes: v.notes }),
        })
      ))
      setVendorAddedCount(toAdd.length)
    } catch { /* non-fatal */ }
    setVendorAdding(false)
    setScreen('saved')
  }

  // ── Focus / region toggles ───────────────────────────────────────────────
  const toggleFocus  = (v: string) => setFocusAreas(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const toggleRegion = (v: string) => setRegions(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  const removeCompany = (id: string) => setCompanies(prev => prev.filter(c => c.id !== id))

  const addCompanyManually = () => {
    if (!newCompanyName.trim()) return
    setCompanies(prev => [...prev, { id: Date.now().toString(), name: newCompanyName.trim(), website_url: newCompanyUrl.trim() }])
    setNewCompanyName(''); setNewCompanyUrl(''); setAddingCompany(false); setNewCompanyError('')
  }

  const addCompanyViaEnrich = async () => {
    if (!newCompanyUrl.trim()) { setNewCompanyError('Please enter a website URL first'); return }
    setNewCompanyEnriching(true); setNewCompanyError('')
    try {
      const res = await fetch('/api/enrich-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: newCompanyUrl.trim() }),
      })
      const data = await res.json() as { success: boolean; error?: string; profile?: { company_name?: string; company_description?: string } }
      if (!res.ok || !data.success) throw new Error(data.error || 'Auto-populate failed')
      const resolvedName = newCompanyName.trim() || data.profile?.company_name || newCompanyUrl.trim()
      setCompanies(prev => [...prev, { id: Date.now().toString(), name: resolvedName, website_url: newCompanyUrl.trim(), description: data.profile?.company_description }])
      setNewCompanyName(''); setNewCompanyUrl(''); setAddingCompany(false); setNewCompanyError('')
    } catch (e) {
      setNewCompanyError(e instanceof Error ? e.message : 'Auto-populate failed')
    } finally { setNewCompanyEnriching(false) }
  }

  const canSave = companies.length > 0 || companyName.trim().length > 0

  const CATEGORY_LABELS: Record<string, string> = {
    venue: 'Venue', catering: 'Catering', av_tech: 'AV / Tech', staffing: 'Staffing',
    marketing: 'Marketing', transport: 'Transport', photo_video: 'Photo / Video',
    print_branding: 'Print & Branding', logistics: 'Logistics', production: 'Production',
    technology: 'Technology', media: 'Media', other: 'Other',
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── VENDOR REVIEW ─────────────────────────────────────── */}
        {screen === 'vendor_review' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Pre-populate your vendor list</h2>
                <p className="text-xs text-gray-500">Vendors commonly used for events in your space — deselect any you don&apos;t need.</p>
              </div>
            </div>

            {vendorLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-gray-500">
                <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span>Finding relevant vendors for your profile…</span>
              </div>
            ) : vendorSuggestions.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                <p>Couldn&apos;t generate suggestions right now.</p>
                <button onClick={() => setScreen('saved')} className="mt-3 text-violet-600 hover:underline text-sm">
                  Continue to dashboard →
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-2">
                  <span>{selectedVendors.size} of {vendorSuggestions.length} selected</span>
                  <div className="flex gap-3">
                    <button onClick={() => setSelectedVendors(new Set(vendorSuggestions.map((_, i) => i)))} className="text-violet-600 hover:underline">Select all</button>
                    <button onClick={() => setSelectedVendors(new Set())} className="text-gray-400 hover:text-gray-600 hover:underline">Deselect all</button>
                  </div>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {Object.entries(
                    vendorSuggestions.reduce<Record<string, { vendor: VendorSuggestion; idx: number }[]>>((acc, v, i) => {
                      const cat = v.category || 'other'
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push({ vendor: v, idx: i })
                      return acc
                    }, {})
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{CATEGORY_LABELS[cat] ?? cat}</div>
                      <div className="space-y-1">
                        {items.map(({ vendor: v, idx }) => (
                          <label key={idx} className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedVendors.has(idx) ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-100 opacity-50'}`}>
                            <input type="checkbox" checked={selectedVendors.has(idx)} onChange={() => {
                              setSelectedVendors(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
                            }} className="mt-0.5 accent-teal-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{v.name}</span>
                                {v.website && <span className="text-[10px] text-gray-400 truncate">{v.website.replace(/^https?:\/\/(www\.)?/, '')}</span>}
                              </div>
                              {v.notes && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{v.notes}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={addSelectedVendors} disabled={vendorAdding}
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                    {vendorAdding ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Adding vendors…</>) : <>Add {selectedVendors.size} vendor{selectedVendors.size !== 1 ? 's' : ''} to my list</>}
                  </button>
                  <button onClick={() => setScreen('saved')} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Skip</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SUCCESS ───────────────────────────────────────────── */}
        {screen === 'saved' && (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">You&apos;re all set!</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Claude now knows what events to look for.
              {vendorAddedCount > 0 && <> <span className="text-green-600 font-medium">{vendorAddedCount} vendors</span> have been added to your rolodex.</>}
              {' '}Head to Opportunities to run your first AI-powered search.
            </p>
            <button onClick={() => { onSaved(); router.push('/opportunities') }}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors mb-3">
              Find my first opportunities
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            <button onClick={onSaved} className="text-sm text-gray-400 hover:text-gray-600">Go back to dashboard</button>
          </div>
        )}

        {/* ── COMPANY SETUP (first-time, no prefs) ─────────────── */}
        {screen === 'company_setup' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Tell us about your company</h2>
                  <p className="text-xs text-gray-500">AI will research the rest automatically — LinkedIn, socials, leadership, and more.</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Company name</label>
                <input
                  type="text"
                  value={companyNameInput}
                  onChange={e => setCompanyNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (document.getElementById('website-input') as HTMLInputElement)?.focus() }}
                  placeholder="Acme Corp"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={enrichLoading}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Company website</label>
                <input
                  id="website-input"
                  type="url"
                  value={websiteInput}
                  onChange={e => setWebsiteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && websiteInput.trim() && !enrichLoading) runEnrich() }}
                  placeholder="https://acme.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={enrichLoading}
                />
              </div>

              {enrichError && <p className="text-xs text-red-600">{enrichError}</p>}

              {enrichLoading ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Researching your company…</p>
                    <p className="text-xs text-gray-400 mt-0.5">Finding LinkedIn, social profiles, and leadership. About 20 seconds.</p>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={runEnrich}
                    disabled={!websiteInput.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    Research my company with AI
                  </button>
                  <div className="text-center">
                    <button onClick={() => setScreen('form')} className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors">
                      I&apos;ll fill in manually instead →
                    </button>
                  </div>
                  <div className="text-center">
                    <button onClick={onClose} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">{closeLabel}</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── SOCIAL PROMPT (rare — AI couldn't find social profiles) ── */}
        {screen === 'social_prompt' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Add your social profiles</h2>
                  <p className="text-xs text-gray-500">We couldn&apos;t find them automatically. Adding them helps AI match better events for you.</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">LinkedIn company page <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={socialLinkedinInput}
                  onChange={e => setSocialLinkedinInput(e.target.value)}
                  placeholder="https://linkedin.com/company/acme"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Twitter / X <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={socialTwitterInput}
                  onChange={e => setSocialTwitterInput(e.target.value)}
                  placeholder="https://twitter.com/acme"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button onClick={proceedFromSocialPrompt}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors mt-2">
                Continue
              </button>
              <div className="text-center">
                <button onClick={() => pendingPayload && startVendorReview(pendingPayload)} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                  Skip — I&apos;ll add these later
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── MANUAL EDIT FORM (returning users / escape hatch) ─── */}
        {screen === 'form' && (
          <>
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{isFirstTime ? 'Opportunity search preferences' : 'Update search preferences'}</h2>
                  <p className="text-xs text-gray-500">{isFirstTime ? 'You can update this any time from the Opportunities page.' : 'Refine your preferences — your existing opportunities won\'t be affected.'}</p>
                </div>
              </div>

              {loadingPrefs ? null : (
                <>
                  {isFirstTime && !hasExistingPrefs && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-3 text-xs text-blue-700 leading-relaxed">
                      <strong className="font-semibold">What are Opportunities?</strong> The AI continuously searches the web for conferences, summits, and industry events that match your company profile — scoring each one for strategic fit, audience quality, and speaking potential.
                    </div>
                  )}
                  {!isFirstTime && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3 text-xs text-gray-600 leading-relaxed flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span><strong className="font-semibold text-gray-700">Your existing opportunities won&apos;t be changed.</strong> Updating preferences only affects future searches.</span>
                    </div>
                  )}
                  {hasExistingPrefs && (
                    <button onClick={() => setScreen('company_setup')}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                      Re-populate from URL
                    </button>
                  )}
                </>
              )}
            </div>

            {loadingPrefs ? (
              <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
            ) : (
              <div className="p-6 space-y-5">
                {enrichedFrom && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    Profile auto-populated from {enrichedFrom} — review and confirm below.
                  </div>
                )}
                {!enrichedFrom && hasExistingPrefs && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    Pre-filled from your existing preferences — edit any field and save to update.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Your name</label>
                  <input value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Sarah Jones"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Your Companies <span className="text-red-500">*</span></label>
                  {companies.length === 0 ? (
                    <p className="text-xs text-gray-400 italic mb-2">No companies added yet.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-2">
                      {companies.map(company => (
                        <div key={company.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900 truncate block">{company.name}</span>
                            {company.website_url && <span className="text-xs text-gray-400 truncate block">{getDomain(company.website_url)}</span>}
                          </div>
                          <button type="button" onClick={() => removeCompany(company.id)} className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors" aria-label={`Remove ${company.name}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {addingCompany ? (
                    <div className="border border-violet-200 rounded-lg p-3 space-y-2 bg-violet-50">
                      <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Company name"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                      <input type="url" value={newCompanyUrl} onChange={e => setNewCompanyUrl(e.target.value)} placeholder="Website URL (e.g. https://acme.com)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                      {newCompanyError && <p className="text-xs text-red-600">{newCompanyError}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={addCompanyViaEnrich} disabled={newCompanyEnriching || !newCompanyUrl.trim()}
                          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                          {newCompanyEnriching ? (<><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Enriching…</>) : <>✨ Auto-populate from URL</>}
                        </button>
                        <button type="button" onClick={addCompanyManually} disabled={!newCompanyName.trim()}
                          className="flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">Add manually</button>
                        <button type="button" onClick={() => { setAddingCompany(false); setNewCompanyName(''); setNewCompanyUrl(''); setNewCompanyError('') }}
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAddingCompany(true)}
                      className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Add company
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Product or brand names</label>
                  <input value={brands} onChange={e => setBrands(e.target.value)} placeholder="e.g. Acme CX Suite, Acme AI — comma-separated"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Executive speaker name <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input value={speakerName} onChange={e => setSpeakerName(e.target.value)} placeholder="e.g. Jane Smith — used to score speaking opportunities"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Target customer profile <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea value={customerProfile} onChange={e => setCustomerProfile(e.target.value)} rows={2}
                    placeholder="e.g. VP/Director of Customer Experience at enterprise B2B companies (500+ employees)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Focus areas <span className="text-gray-400 font-normal">(select any that apply)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map(f => (
                      <button key={f.val} type="button" onClick={() => toggleFocus(f.val)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${focusAreas.includes(f.val) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                        {f.label}
                      </button>
                    ))}
                    {focusAreas.filter(v => !FOCUS_OPTIONS.find(f => f.val === v)).map(v => (
                      <button key={v} type="button" onClick={() => toggleFocus(v)}
                        className="px-3 py-1.5 rounded-full border text-xs font-medium bg-violet-600 text-white border-violet-600 flex items-center gap-1">
                        {v}<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input value={customFocusInput} onChange={e => setCustomFocusInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && customFocusInput.trim()) { const v = customFocusInput.trim(); if (!focusAreas.includes(v)) setFocusAreas(p => [...p, v]); setCustomFocusInput('') } }}
                      placeholder="Add other focus area…" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    <button type="button" onClick={() => { const v = customFocusInput.trim(); if (v && !focusAreas.includes(v)) setFocusAreas(p => [...p, v]); setCustomFocusInput('') }}
                      disabled={!customFocusInput.trim()} className="px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors">Add</button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Target regions</label>
                  <div className="flex flex-wrap gap-2">
                    {REGION_OPTIONS.map(r => (
                      <button key={r.val} type="button" onClick={() => toggleRegion(r.val)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${regions.includes(r.val) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                        {r.label}
                      </button>
                    ))}
                    {regions.filter(v => !REGION_OPTIONS.find(r => r.val === v)).map(v => (
                      <button key={v} type="button" onClick={() => toggleRegion(v)}
                        className="px-3 py-1.5 rounded-full border text-xs font-medium bg-violet-600 text-white border-violet-600 flex items-center gap-1">
                        {v}<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input value={customRegionInput} onChange={e => setCustomRegionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && customRegionInput.trim()) { const v = customRegionInput.trim(); if (!regions.includes(v)) setRegions(p => [...p, v]); setCustomRegionInput('') } }}
                      placeholder="Add another region…" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    <button type="button" onClick={() => { const v = customRegionInput.trim(); if (v && !regions.includes(v)) setRegions(p => [...p, v]); setCustomRegionInput('') }}
                      disabled={!customRegionInput.trim()} className="px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors">Add</button>
                  </div>
                </div>
              </div>
            )}

            {!loadingPrefs && (
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={save} disabled={saving || !canSave}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  {saving ? 'Saving…' : isFirstTime ? 'Save preferences' : 'Update preferences'}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">{closeLabel}</button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
