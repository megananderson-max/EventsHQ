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
  const [mode, setMode]                               = useState<'ai' | 'manual' | 'saved' | 'vendor_review'>('ai')
  const [aiDescription, setAiDescription]             = useState('')
  const [aiLoading, setAiLoading]                     = useState(false)
  const [aiError, setAiError]                         = useState<string | null>(null)
  // Keep companyName for backward compat (AI mode still sets it; single-company users still work)
  const [companyName, setCompanyName]                 = useState('')
  const [companies, setCompanies]                     = useState<CompanyProfile[]>([])
  const [brands, setBrands]                           = useState('')
  const [speakerName, setSpeakerName]                 = useState('')
  const [customerProfile, setCustomerProfile]         = useState('')
  const [focusAreas, setFocusAreas]                   = useState<string[]>([])
  const [customFocusInput, setCustomFocusInput]       = useState('')
  const [regions, setRegions]                         = useState<string[]>(['north_america'])
  const [customRegionInput, setCustomRegionInput]     = useState('')
  const [yourName, setYourName]                       = useState('')
  const [saving, setSaving]                           = useState(false)
  const [loadingPrefs, setLoadingPrefs]               = useState(true)
  const [hasExistingPrefs, setHasExistingPrefs]       = useState(false)

  // Add-company inline form
  const [addingCompany, setAddingCompany]             = useState(false)
  const [newCompanyName, setNewCompanyName]           = useState('')
  const [newCompanyUrl, setNewCompanyUrl]             = useState('')
  const [newCompanyEnriching, setNewCompanyEnriching] = useState(false)
  const [newCompanyError, setNewCompanyError]         = useState('')

  // URL auto-populate step — only show url_input for first-time onboarding
  const [enrichStep, setEnrichStep]                   = useState<'url_input' | 'form'>(isFirstTime ? 'url_input' : 'form')
  const [websiteInput, setWebsiteInput]               = useState('')
  const [linkedinInput, setLinkedinInput]             = useState('')
  const [additionalUrls, setAdditionalUrls]           = useState<string[]>([])
  const [enrichLoading, setEnrichLoading]             = useState(false)
  const [enrichError, setEnrichError]                 = useState<string | null>(null)
  const [enrichedFrom, setEnrichedFrom]               = useState<string | null>(null)

  // Vendor seeding
  type VendorSuggestion = { name: string; category: string; website: string | null; notes: string }
  const [vendorSuggestions, setVendorSuggestions]     = useState<VendorSuggestion[]>([])
  const [selectedVendors, setSelectedVendors]         = useState<Set<number>>(new Set())
  const [vendorLoading, setVendorLoading]             = useState(false)
  const [vendorAdding, setVendorAdding]               = useState(false)
  const [vendorAddedCount, setVendorAddedCount]       = useState(0)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, unknown>) => {
        if (typeof s.user_name === 'string' && s.user_name)        setYourName(s.user_name)
        if (typeof s.opp_company_name === 'string' && s.opp_company_name) {
          setCompanyName(s.opp_company_name)
          setHasExistingPrefs(true)
        }
        if (typeof s.opp_brands === 'string' && s.opp_brands)           setBrands(s.opp_brands)
        if (typeof s.opp_speaker_name === 'string' && s.opp_speaker_name) setSpeakerName(s.opp_speaker_name)
        if (typeof s.opp_customer_profile === 'string' && s.opp_customer_profile) setCustomerProfile(s.opp_customer_profile)
        if (typeof s.opp_focus_areas === 'string' && s.opp_focus_areas) setFocusAreas(s.opp_focus_areas.split(',').filter(Boolean))
        if (typeof s.opp_regions === 'string' && s.opp_regions)         setRegions(s.opp_regions.split(',').filter(Boolean))
        if (typeof s.opp_company_name === 'string' && s.opp_company_name) setMode('manual')

        // Load company profiles — backward compat: seed from company_name if no profiles yet
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

  // During first-time onboarding, skip the URL step if prefs already exist
  useEffect(() => {
    if (isFirstTime && !loadingPrefs && hasExistingPrefs) {
      setEnrichStep('form')
    }
  }, [isFirstTime, loadingPrefs, hasExistingPrefs])

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
          linkedinUrl: linkedinInput.trim() || undefined,
          additionalUrls: additionalUrls.filter(u => u.trim()),
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
        }
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Auto-populate failed')
      const p = data.profile!

      // Build local variables from extracted data (don't rely on state being updated)
      const enrichedName = p.company_name || ''
      const extractedProfile = p.company_description || ''
      const extractedFocusAreas = Array.isArray(p.focus_areas) ? p.focus_areas.filter(v => VALID_FOCUS_AREAS.includes(v)) : []
      const extractedRegions = Array.isArray(p.regions) ? p.regions.filter(v => VALID_REGIONS.includes(v)) : []
      const extractedSpeakerName = p.speaker_name || ''
      const newCompany: CompanyProfile = {
        id: Date.now().toString(),
        name: enrichedName || websiteInput.trim(),
        website_url: websiteInput.trim(),
        description: p.company_description,
      }

      // Update state for display consistency
      if (enrichedName) setCompanyName(enrichedName)
      if (extractedProfile) setCustomerProfile(extractedProfile)
      if (extractedFocusAreas.length) setFocusAreas(extractedFocusAreas)
      if (extractedRegions.length) setRegions(extractedRegions)
      if (extractedSpeakerName) setSpeakerName(extractedSpeakerName)
      setCompanies([newCompany])

      // Extract domain for the banner
      try {
        setEnrichedFrom(new URL(websiteInput.trim()).hostname.replace(/^www\./, ''))
      } catch {
        setEnrichedFrom(websiteInput.trim())
      }

      // Save directly to API using local variables — skip the manual review form step
      setSaving(true)
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opp_prefs_configured: 'true',
          user_name: yourName.trim(),
          opp_company_name: newCompany.name,
          opp_brands: brands.trim(),
          opp_speaker_name: extractedSpeakerName,
          opp_customer_profile: extractedProfile,
          opp_focus_areas: extractedFocusAreas.join(','),
          opp_regions: extractedRegions.join(','),
          company_profiles: [newCompany],
        }),
      })
      setSaving(false)

      if (isFirstTime) {
        setMode('vendor_review')
        setVendorLoading(true)
        fetch('/api/vendors/seed-from-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focus_areas: extractedFocusAreas,
            regions: extractedRegions,
            company_name: newCompany.name,
            customer_profile: extractedProfile,
          }),
        })
          .then(r => r.json())
          .then((seedData: { success: boolean; vendors?: VendorSuggestion[] }) => {
            if (seedData.success && Array.isArray(seedData.vendors)) {
              setVendorSuggestions(seedData.vendors)
              setSelectedVendors(new Set(seedData.vendors.map((_, i) => i)))
            }
          })
          .catch(() => {})
          .finally(() => setVendorLoading(false))
      } else {
        onSaved()
      }
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Auto-populate failed')
    } finally {
      setEnrichLoading(false)
    }
  }

  const toggleFocus  = (v: string) => setFocusAreas(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const toggleRegion = (v: string) => setRegions(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  const runAiAssist = async () => {
    if (!aiDescription.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/settings/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI assist failed')
      if (data.company_name)     {
        setCompanyName(data.company_name)
        setCompanies([{ id: Date.now().toString(), name: data.company_name, website_url: '' }])
      }
      if (data.brands)           setBrands(data.brands)
      if (data.speaker_name)     { setSpeakerName(data.speaker_name); if (!yourName) setYourName(data.speaker_name) }
      if (data.user_name)        setYourName(data.user_name)
      if (data.customer_profile) setCustomerProfile(data.customer_profile)
      if (Array.isArray(data.focus_areas) && data.focus_areas.length) setFocusAreas(data.focus_areas)
      if (Array.isArray(data.regions) && data.regions.length)         setRegions(data.regions)
      setMode('manual')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI assist failed')
    } finally {
      setAiLoading(false)
    }
  }

  const removeCompany = (id: string) => {
    setCompanies(prev => prev.filter(c => c.id !== id))
  }

  const addCompanyManually = () => {
    if (!newCompanyName.trim()) return
    const company: CompanyProfile = {
      id: Date.now().toString(),
      name: newCompanyName.trim(),
      website_url: newCompanyUrl.trim(),
    }
    setCompanies(prev => [...prev, company])
    setNewCompanyName('')
    setNewCompanyUrl('')
    setAddingCompany(false)
    setNewCompanyError('')
  }

  const addCompanyViaEnrich = async () => {
    if (!newCompanyUrl.trim()) {
      setNewCompanyError('Please enter a website URL first')
      return
    }
    setNewCompanyEnriching(true)
    setNewCompanyError('')
    try {
      const res = await fetch('/api/enrich-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: newCompanyUrl.trim() }),
      })
      const data = await res.json() as {
        success: boolean
        error?: string
        profile?: {
          company_name?: string
          company_description?: string
        }
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Auto-populate failed')
      const p = data.profile!
      const resolvedName = newCompanyName.trim() || p.company_name || newCompanyUrl.trim()
      const company: CompanyProfile = {
        id: Date.now().toString(),
        name: resolvedName,
        website_url: newCompanyUrl.trim(),
        description: p.company_description,
      }
      setCompanies(prev => [...prev, company])
      setNewCompanyName('')
      setNewCompanyUrl('')
      setAddingCompany(false)
      setNewCompanyError('')
    } catch (e) {
      setNewCompanyError(e instanceof Error ? e.message : 'Auto-populate failed')
    } finally {
      setNewCompanyEnriching(false)
    }
  }

  const getDomain = (url: string) => {
    if (!url) return ''
    try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
  }

  const save = async () => {
    // Require at least one company or a legacy companyName
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
      }),
    })

    // Create a "Me" team member if one doesn't already exist
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
              body: JSON.stringify({
                first_name: nameParts[0],
                last_name: nameParts.slice(1).join(' ') || null,
                email: null,
                is_me: 1,
                role: 'user',
              }),
            })
          }
        }
      } catch {
        // Non-fatal — settings were saved, team member creation is best-effort
      }
    }

    setSaving(false)
    if (isFirstTime) {
      // Kick off vendor seeding in background, then show vendor review step
      setMode('vendor_review')
      setVendorLoading(true)
      fetch('/api/vendors/seed-from-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus_areas: focusAreas,
          regions,
          company_name: companies[0]?.name || companyName.trim(),
          customer_profile: customerProfile.trim(),
        }),
      })
        .then(r => r.json())
        .then((data: { success: boolean; vendors?: VendorSuggestion[] }) => {
          if (data.success && Array.isArray(data.vendors)) {
            setVendorSuggestions(data.vendors)
            // Pre-select all by default
            setSelectedVendors(new Set(data.vendors.map((_, i) => i)))
          }
        })
        .catch(() => {})
        .finally(() => setVendorLoading(false))
    } else {
      onSaved()
    }
  }

  const addSelectedVendors = async () => {
    if (selectedVendors.size === 0) { setMode('saved'); return }
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
    } catch {
      // Non-fatal — proceed to success screen
    }
    setVendorAdding(false)
    setMode('saved')
  }

  const CATEGORY_LABELS: Record<string, string> = {
    venue: 'Venue', catering: 'Catering', av_tech: 'AV / Tech', staffing: 'Staffing',
    marketing: 'Marketing', transport: 'Transport', photo_video: 'Photo / Video',
    print_branding: 'Print & Branding', logistics: 'Logistics', production: 'Production',
    technology: 'Technology', media: 'Media', other: 'Other',
  }

  const canSave = companies.length > 0 || companyName.trim().length > 0

  // ── URL INPUT STEP ───────────────────────────────────────────────────────
  const urlInputScreen = (
    <div className="p-6 space-y-5">
      <div className="space-y-1">
        <label className="block text-sm font-semibold text-gray-700">Company website</label>
        <input
          type="url"
          value={websiteInput}
          onChange={e => setWebsiteInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && websiteInput.trim() && !enrichLoading) runEnrich() }}
          placeholder="https://yourcompany.com"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={enrichLoading}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Additional pages to scan <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <p className="text-xs text-gray-400">Add LinkedIn, Twitter/X, Instagram, Crunchbase, or any other page — the more you add, the richer the profile.</p>
        <input
          type="url"
          value={linkedinInput}
          onChange={e => setLinkedinInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && websiteInput.trim() && !enrichLoading) runEnrich() }}
          placeholder="https://linkedin.com/company/…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={enrichLoading}
        />
        {additionalUrls.map((url, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setAdditionalUrls(prev => prev.map((u, j) => j === i ? e.target.value : u))}
              onKeyDown={e => { if (e.key === 'Enter' && websiteInput.trim() && !enrichLoading) runEnrich() }}
              placeholder={i === 0 ? 'https://twitter.com/yourcompany' : i === 1 ? 'https://crunchbase.com/organization/…' : 'https://…'}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={enrichLoading}
            />
            <button
              type="button"
              onClick={() => setAdditionalUrls(prev => prev.filter((_, j) => j !== i))}
              className="text-gray-300 hover:text-red-400 px-2 transition-colors"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAdditionalUrls(prev => [...prev, ''])}
          disabled={enrichLoading}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add another page
        </button>
      </div>

      {enrichError && (
        <p className="text-xs text-red-600">{enrichError}</p>
      )}

      {enrichLoading ? (
        <div className="flex items-center justify-center gap-3 py-4 text-sm text-gray-500">
          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span>Analysing your website… This takes about 15 seconds.</span>
        </div>
      ) : (
        <>
          <button
            onClick={runEnrich}
            disabled={!websiteInput.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Auto-populate my profile →
          </button>

          <div className="text-center">
            <button
              onClick={() => { setEnrichStep('form'); setMode('manual') }}
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors"
            >
              I&apos;ll fill in manually →
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── VENDOR REVIEW STATE ────────────────────────────────── */}
        {mode === 'vendor_review' ? (
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
                <button onClick={() => setMode('saved')} className="mt-3 text-violet-600 hover:underline text-sm">
                  Continue to dashboard →
                </button>
              </div>
            ) : (
              <>
                {/* Select / deselect all */}
                <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-2">
                  <span>{selectedVendors.size} of {vendorSuggestions.length} selected</span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedVendors(new Set(vendorSuggestions.map((_, i) => i)))}
                      className="text-violet-600 hover:underline"
                    >Select all</button>
                    <button
                      onClick={() => setSelectedVendors(new Set())}
                      className="text-gray-400 hover:text-gray-600 hover:underline"
                    >Deselect all</button>
                  </div>
                </div>

                {/* Grouped by category */}
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
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        {CATEGORY_LABELS[cat] ?? cat}
                      </div>
                      <div className="space-y-1">
                        {items.map(({ vendor: v, idx }) => (
                          <label
                            key={idx}
                            className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              selectedVendors.has(idx)
                                ? 'bg-teal-50 border-teal-200'
                                : 'bg-white border-gray-100 opacity-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedVendors.has(idx)}
                              onChange={() => {
                                setSelectedVendors(prev => {
                                  const next = new Set(prev)
                                  if (next.has(idx)) next.delete(idx)
                                  else next.add(idx)
                                  return next
                                })
                              }}
                              className="mt-0.5 accent-teal-600 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{v.name}</span>
                                {v.website && (
                                  <span className="text-[10px] text-gray-400 truncate">
                                    {v.website.replace(/^https?:\/\/(www\.)?/, '')}
                                  </span>
                                )}
                              </div>
                              {v.notes && (
                                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{v.notes}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={addSelectedVendors}
                    disabled={vendorAdding}
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {vendorAdding ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Adding vendors…
                      </>
                    ) : (
                      <>Add {selectedVendors.size} vendor{selectedVendors.size !== 1 ? 's' : ''} to my list</>
                    )}
                  </button>
                  <button
                    onClick={() => setMode('saved')}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>

        ) : (

        /* ── SUCCESS STATE ──────────────────────────────────────── */
        mode === 'saved' ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Preferences saved!</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Claude now knows what events to look for.
              {vendorAddedCount > 0 && (
                <> <span className="text-green-600 font-medium">{vendorAddedCount} vendors</span> have been added to your rolodex.</>
              )}
              {' '}Head to Opportunities to run your first AI-powered search.
            </p>
            <button
              onClick={() => { onSaved(); router.push('/opportunities') }}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors mb-3"
            >
              Find my first opportunities
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            <button onClick={onSaved} className="text-sm text-gray-400 hover:text-gray-600">
              Go back to dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div>
                  {enrichStep === 'url_input' ? (
                    <>
                      <h2 className="text-base font-bold text-gray-900">Let&apos;s get to know your company</h2>
                      <p className="text-xs text-gray-500">Paste your website or LinkedIn URL and we&apos;ll fill in your profile automatically.</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-base font-bold text-gray-900">{isFirstTime ? 'Opportunity search preferences' : 'Update search preferences'}</h2>
                      <p className="text-xs text-gray-500">{isFirstTime ? 'You can update this any time from the Opportunities page.' : 'Refine your preferences — your existing opportunities list won\'t be affected.'}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Context banner — only show on form step */}
              {enrichStep === 'form' && (
                <>
                  {isFirstTime && !hasExistingPrefs ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700 leading-relaxed">
                      <strong className="font-semibold">What are Opportunities?</strong> The AI continuously searches the web for conferences, summits, and industry events that match your company profile — scoring each one for strategic fit, audience quality, and speaking potential. Set your profile below so results are tailored to you.
                    </div>
                  ) : !isFirstTime ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-xs text-gray-600 leading-relaxed flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span><strong className="font-semibold text-gray-700">Your existing opportunities won&apos;t be changed.</strong> Updating preferences only affects future searches — events already in your list stay exactly as they are.</span>
                    </div>
                  ) : null}

                  {/* Mode toggle */}
                  {!loadingPrefs && (
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                      <button
                        onClick={() => setMode('ai')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors ${mode === 'ai' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        {hasExistingPrefs ? 'Re-fill with AI' : 'Fill with AI'}
                      </button>
                      <button
                        onClick={() => setMode('manual')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors border-l border-gray-200 ${mode === 'manual' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Fill manually
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {loadingPrefs ? (
              <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
            ) : enrichStep === 'url_input' ? urlInputScreen
            : mode === 'ai' ? (
              /* ── AI MODE ─────────────────────────────────────────── */
              <div className="p-6 space-y-4">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-violet-700 mb-1">Describe your company in plain English</p>
                  <p className="text-xs text-violet-600 mb-3">Tell us who you are, what you sell, who your customers are, and what kinds of events you want to find. Claude will extract the details automatically.</p>
                  <textarea
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    rows={5}
                    placeholder="e.g. We're Acme Corp, a SaaS company selling customer experience software to enterprise companies. Our main products are AcmeCX and AcmeCare. Our CEO Jane Smith is an experienced speaker. We mostly sell to VP-level CX and customer service leaders at large companies. We're focused on North America and Europe."
                    className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white resize-none"
                  />
                  {aiError && <p className="text-xs text-red-600 mt-2">{aiError}</p>}
                  <button
                    onClick={runAiAssist}
                    disabled={aiLoading || !aiDescription.trim()}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Analysing…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        Fill preferences with AI
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Or{' '}
                  <button onClick={() => setMode('manual')} className="text-violet-600 hover:underline">fill in the fields manually</button>
                </p>
                {!isFirstTime && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Your existing opportunities list won't be affected by updating preferences.
                  </p>
                )}
              </div>
            ) : (
              /* ── MANUAL MODE ─────────────────────────────────────── */
              <div className="p-6 space-y-5">
                {enrichedFrom ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    Profile auto-populated from {enrichedFrom} — review and confirm below.
                  </div>
                ) : hasExistingPrefs ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    Pre-filled from your existing preferences — edit any field and save to update.
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Your name</label>
                  <input value={yourName} onChange={e => setYourName(e.target.value)}
                    placeholder="e.g. Sarah Jones"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                {/* ── YOUR COMPANIES ───────────────────────────────── */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Companies <span className="text-red-500">*</span>
                  </label>

                  {companies.length === 0 ? (
                    <p className="text-xs text-gray-400 italic mb-2">No companies added yet.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-2">
                      {companies.map(company => (
                        <div key={company.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900 truncate block">{company.name}</span>
                            {company.website_url && (
                              <span className="text-xs text-gray-400 truncate block">{getDomain(company.website_url)}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCompany(company.id)}
                            className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                            aria-label={`Remove ${company.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add company inline form */}
                  {addingCompany ? (
                    <div className="border border-violet-200 rounded-lg p-3 space-y-2 bg-violet-50">
                      <input
                        value={newCompanyName}
                        onChange={e => setNewCompanyName(e.target.value)}
                        placeholder="Company name"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                      />
                      <input
                        type="url"
                        value={newCompanyUrl}
                        onChange={e => setNewCompanyUrl(e.target.value)}
                        placeholder="Website URL (e.g. https://acme.com)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                      />
                      {newCompanyError && (
                        <p className="text-xs text-red-600">{newCompanyError}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={addCompanyViaEnrich}
                          disabled={newCompanyEnriching || !newCompanyUrl.trim()}
                          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          {newCompanyEnriching ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                              Enriching…
                            </>
                          ) : (
                            <>✨ Auto-populate from URL</>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={addCompanyManually}
                          disabled={!newCompanyName.trim()}
                          className="flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Add manually
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingCompany(false); setNewCompanyName(''); setNewCompanyUrl(''); setNewCompanyError('') }}
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingCompany(true)}
                      className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      </svg>
                      Add company
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Product or brand names</label>
                  <input value={brands} onChange={e => setBrands(e.target.value)}
                    placeholder="e.g. Acme CX Suite, Acme AI — comma-separated"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Executive speaker name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input value={speakerName} onChange={e => setSpeakerName(e.target.value)}
                    placeholder="e.g. Jane Smith — used to score speaking opportunities"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Target customer profile <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea value={customerProfile} onChange={e => setCustomerProfile(e.target.value)}
                    rows={2} placeholder="e.g. VP/Director of Customer Experience at enterprise B2B companies (500+ employees)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Focus areas <span className="text-gray-400 font-normal">(select any that apply, or add your own)</span>
                  </label>
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
                        {v}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      value={customFocusInput}
                      onChange={e => setCustomFocusInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customFocusInput.trim()) {
                          const val = customFocusInput.trim()
                          if (!focusAreas.includes(val)) setFocusAreas(p => [...p, val])
                          setCustomFocusInput('')
                        }
                      }}
                      placeholder="Add other focus area…"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <button type="button"
                      onClick={() => {
                        const val = customFocusInput.trim()
                        if (val && !focusAreas.includes(val)) setFocusAreas(p => [...p, val])
                        setCustomFocusInput('')
                      }}
                      disabled={!customFocusInput.trim()}
                      className="px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors">
                      Add
                    </button>
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
                        {v}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      value={customRegionInput}
                      onChange={e => setCustomRegionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customRegionInput.trim()) {
                          const val = customRegionInput.trim()
                          if (!regions.includes(val)) setRegions(p => [...p, val])
                          setCustomRegionInput('')
                        }
                      }}
                      placeholder="Add another region…"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <button type="button"
                      onClick={() => {
                        const val = customRegionInput.trim()
                        if (val && !regions.includes(val)) setRegions(p => [...p, val])
                        setCustomRegionInput('')
                      }}
                      disabled={!customRegionInput.trim()}
                      className="px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {enrichStep === 'url_input' && !enrichLoading && (
              <div className="px-6 pb-6">
                <button onClick={onClose} className="w-full px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {closeLabel}
                </button>
              </div>
            )}
            {enrichStep === 'form' && mode === 'manual' && (
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={save} disabled={saving || loadingPrefs || !canSave}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  {saving ? 'Saving…' : isFirstTime ? 'Save preferences' : 'Update preferences'}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                  {closeLabel}
                </button>
              </div>
            )}
            {enrichStep === 'form' && mode === 'ai' && (
              <div className="px-6 pb-6">
                <button onClick={onClose} className="w-full px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {closeLabel}
                </button>
              </div>
            )}
          </>
        )
        )}
      </div>
    </div>
  )
}
