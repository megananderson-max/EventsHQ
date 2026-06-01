'use client'

import { useState } from 'react'

interface Props {
  googleName: string | null  // pre-fill from Google account as a suggestion
  onSaved: (name: string) => void
}

export default function WelcomeModal({ googleName, onSaved }: Props) {
  // Pre-split Google name into first/last as a convenience
  const parts = googleName?.trim().split(' ') ?? []
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName, setLastName]   = useState(parts.slice(1).join(' ') ?? '')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const save = async () => {
    if (!firstName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Could not save — please try again')
      const data = await res.json() as { name: string }
      onSaved(data.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 space-y-6">

        {/* Icon + heading */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Welcome to EventsHQ!</h2>
            <p className="text-sm text-gray-500 mt-1">
              What should your teammates call you? This is used for task assignments and activity tracking.
            </p>
          </div>
        </div>

        {/* Name fields */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-medium text-gray-600">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && firstName.trim()) save() }}
                placeholder="Jane"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                disabled={saving}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-medium text-gray-600">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && firstName.trim()) save() }}
                placeholder="Smith"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                disabled={saving}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Save button */}
        <button
          onClick={save}
          disabled={!firstName.trim() || saving}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Saving…
            </>
          ) : "Let's go →"}
        </button>

      </div>
    </div>
  )
}
