'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const FOCUS_OPTIONS = [
  { val: 'cx',             label: 'CX & Customer Success' },
  { val: 'community',      label: 'Community Management' },
  { val: 'contact_center', label: 'Contact Center' },
  { val: 'social_media',   label: 'Social Media & MarTech' },
  { val: 'ai_tech',        label: 'AI & Enterprise Tech' },
  { val: 'executive',      label: 'Executive Leadership' },
]
const REGION_OPTIONS = [
  { val: 'north_america', label: 'North America' },
  { val: 'europe',        label: 'Europe' },
  { val: 'apac',          label: 'APAC' },
]

interface Props {
  onClose: () => void
  onSaved: () => void
  closeLabel?: string
  isFirstTime?: boolean
}

export default function SetupPreferencesModal({ onClose, onSaved, closeLabel = 'Close', isFirstTime = false }: Props) {
  const router = useRouter()
  const [mode, setMode]                               = useState<'ai' | 'manual' | 'saved'>('ai')
  const [aiDescription, setAiDescription]             = useState('')
  const [aiLoading, setAiLoading]                     = useState(false)
  const [aiError, setAiError]                         = useState<string | null>(null)
  const [companyName, setCompanyName]                 = useState('')
  const [brands, setBrands]                           = useState('')
  const [speakerName, setSpeakerName]                 = useState('')
  const [customerProfile, setCustomerProfile]         = useState('')
  const [focusAreas, setFocusAreas]                   = useState<string[]>([])
  const [customFocusInput, setCustomFocusInput]       = useState('')
  const [regions, setRegions]                         = useState<string[]>(['north_america'])
  const [saving, setSaving]                           = useState(false)
  const [loadingPrefs, setLoadingPrefs]               = useState(true)
  const [hasExistingPrefs, setHasExistingPrefs]       = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        if (s.opp_company_name)      { setCompanyName(s.opp_company_name); setHasExistingPrefs(true) }
        if (s.opp_brands)            setBrands(s.opp_brands)
        if (s.opp_speaker_name)      setSpeakerName(s.opp_speaker_name)
        if (s.opp_customer_profile)  setCustomerProfile(s.opp_customer_profile)
        if (s.opp_focus_areas)       setFocusAreas(s.opp_focus_areas.split(',').filter(Boolean))
        if (s.opp_regions)           setRegions(s.opp_regions.split(',').filter(Boolean))
        if (s.opp_company_name)      setMode('manual')
      })
      .catch(() => {})
      .finally(() => setLoadingPrefs(false))
  }, [])

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
      if (data.company_name)     setCompanyName(data.company_name)
      if (data.brands)           setBrands(data.brands)
      if (data.speaker_name)     setSpeakerName(data.speaker_name)
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

  const save = async () => {
    if (!companyName.trim()) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opp_prefs_configured: 'true',
        opp_company_name: companyName.trim(),
        opp_brands: brands.trim(),
        opp_speaker_name: speakerName.trim(),
        opp_customer_profile: customerProfile.trim(),
        opp_focus_areas: focusAreas.join(','),
        opp_regions: regions.join(','),
      }),
    })
    setSaving(false)
    if (isFirstTime) {
      setMode('saved')
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── SUCCESS STATE ──────────────────────────────────────── */}
        {mode === 'saved' ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Preferences saved!</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Claude now knows what events to look for. Head to Opportunities to run your first AI-powered search.
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
                  <h2 className="text-base font-bold text-gray-900">{isFirstTime ? 'Opportunity search preferences' : 'Update search preferences'}</h2>
                  <p className="text-xs text-gray-500">{isFirstTime ? 'You can update this any time from the Opportunities page.' : 'Refine your preferences — your existing opportunities list won\'t be affected.'}</p>
                </div>
              </div>

              {/* Context banner */}
              {isFirstTime && !hasExistingPrefs ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700 leading-relaxed">
                  <strong className="font-semibold">What are Opportunities?</strong> The AI continuously searches the web for conferences, summits, and industry events that match your company profile — scoring each one for strategic fit, audience quality, and speaking potential. Set your profile below so results are tailored to you.
                </div>
              ) : !isFirstTime ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-xs text-gray-600 leading-relaxed flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span><strong className="font-semibold text-gray-700">Your existing opportunities won't be changed.</strong> Updating preferences only affects future searches — events already in your list stay exactly as they are.</span>
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
            </div>

            {loadingPrefs ? (
              <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
            ) : mode === 'ai' ? (
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
                {hasExistingPrefs && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    Pre-filled from your existing preferences — edit any field and save to update.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Company / organisation name <span className="text-red-500">*</span>
                  </label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
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
                  </div>
                </div>
              </div>
            )}

            {mode === 'manual' && (
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={save} disabled={saving || loadingPrefs || !companyName.trim()}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  {saving ? 'Saving…' : isFirstTime ? 'Save preferences' : 'Update preferences'}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                  {closeLabel}
                </button>
              </div>
            )}
            {mode === 'ai' && (
              <div className="px-6 pb-6">
                <button onClick={onClose} className="w-full px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {closeLabel}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
