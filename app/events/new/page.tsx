'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const EVENT_TYPES = [
  { value: 'conference', label: 'Conference' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'client_summit', label: 'Client Summit' },
  { value: 'sales_kickoff', label: 'Sales Kickoff' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'internal_meeting', label: 'Internal Meeting' },
]

export default function NewEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'manual' | 'ai'>('ai')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // AI mode state
  const [urlsText, setUrlsText] = useState('')
  const [aiNotes, setAiNotes] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiConfidence, setAiConfidence] = useState<string | null>(null)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [formPrefilled, setFormPrefilled] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    type: '',
    status: 'planning',
    start_date: searchParams.get('date') || '',
    end_date: '',
    location: '',
    venue: '',
    expected_attendees: '',
    budget_total: '',
    description: '',
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Event name is required'
    if (!form.type) e.type = 'Event type is required'
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'End date must be on or after start date'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expected_attendees: form.expected_attendees ? parseInt(form.expected_attendees) : null,
          budget_total: form.budget_total ? parseFloat(form.budget_total) : 0,
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const event = await res.json()
      router.push(`/events/${event.id}`)
    } catch {
      setSaving(false)
      setErrors({ submit: 'Failed to create event. Please try again.' })
    }
  }

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  const runAiExtract = async () => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length && !aiNotes.trim()) {
      setAiError('Please paste at least one link or add some notes about the event.')
      return
    }
    setAiLoading(true)
    setAiError(null)
    setAiConfidence(null)
    setAiExplanation(null)
    try {
      const res = await fetch('/api/events/ai-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, notes: aiNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI extraction failed')

      // Pre-fill the form
      setForm({
        name: data.name || '',
        type: data.type || '',
        status: 'planning',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        location: data.location || '',
        venue: data.venue || '',
        expected_attendees: data.expected_attendees ? String(data.expected_attendees) : '',
        budget_total: data.budget_total ? String(data.budget_total) : '',
        description: data.description || '',
      })
      setAiConfidence(data.confidence || null)
      setAiExplanation(data.notes || null)
      setFormPrefilled(true)
      setMode('manual') // Switch to form so user can review
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Event</h1>
        <p className="text-gray-500 mt-1">Create an event manually or let AI fill in the details from your files and links.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setMode('ai')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'ai' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          Create with AI
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'manual' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Fill manually
        </button>
      </div>

      {/* AI mode */}
      {mode === 'ai' && (
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-violet-900">Let AI create the event for you</p>
                <p className="text-xs text-violet-600 mt-0.5">Paste links to Google Drive folders, event websites, or registration pages — Claude will extract the event details automatically.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Links & folder URLs
                <span className="text-gray-400 font-normal ml-1">(one per line)</span>
              </label>
              <textarea
                value={urlsText}
                onChange={e => setUrlsText(e.target.value)}
                rows={4}
                placeholder={"https://drive.google.com/drive/folders/...\nhttps://event-website.com/registration\nhttps://docs.google.com/spreadsheets/..."}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes or additional context
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={aiNotes}
                onChange={e => setAiNotes(e.target.value)}
                rows={2}
                placeholder="e.g. This is the Khoros customer summit in Austin, TX on September 15-16, 2026, expecting ~200 attendees"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
              />
            </div>

            {aiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{aiError}</div>
            )}

            <button
              onClick={runAiExtract}
              disabled={aiLoading}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {aiLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Extracting event details...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  Extract event details
                </>
              )}
            </button>
          </div>

          <div className="text-center">
            <button onClick={() => setMode('manual')} className="text-sm text-gray-400 hover:text-gray-600">
              Skip — fill in manually instead →
            </button>
          </div>
        </div>
      )}

      {/* Manual form (also shown after AI pre-fill) */}
      {mode === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{errors.submit}</div>
          )}

          {/* AI pre-fill banner */}
          {formPrefilled && (
            <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-violet-900">
                  AI filled in the form
                  {aiConfidence && (
                    <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      aiConfidence === 'high' ? 'bg-green-100 text-green-700' :
                      aiConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {aiConfidence} confidence
                    </span>
                  )}
                </p>
                {aiExplanation && <p className="text-xs text-violet-600 mt-0.5">{aiExplanation}</p>}
                <button
                  type="button"
                  onClick={() => { setFormPrefilled(false); setMode('ai') }}
                  className="text-xs text-violet-500 hover:text-violet-700 underline mt-1"
                >
                  ← Back to AI mode
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Basic Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="e.g. Khoros Customer Summit 2026"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Type <span className="text-red-500">*</span></label>
                <select
                  value={form.type}
                  onChange={e => set('type', e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.type ? 'border-red-300' : 'border-gray-200'}`}
                >
                  <option value="">Select type...</option>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.end_date ? 'border-red-300' : 'border-gray-200'}`}
                />
                {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date}</p>}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Location & Venue</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location (City, State/Country)</label>
              <input
                type="text"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Austin, TX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Venue Name</label>
              <input
                type="text"
                value={form.venue}
                onChange={e => set('venue', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. JW Marriott Austin"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Budget & Capacity</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected Attendees</label>
                <input
                  type="number"
                  value={form.expected_attendees}
                  onChange={e => set('expected_attendees', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Budget ($)</label>
                <input
                  type="number"
                  value={form.budget_total}
                  onChange={e => set('budget_total', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Brief description of the event..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Creating...' : 'Create Event'}
            </button>
            <Link href="/events" className="text-gray-600 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
