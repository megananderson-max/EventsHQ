'use client'

import React, { useState, useEffect } from 'react'
import { SortTh, useSortState } from '@/app/components/SortTh'

// --------------- CSV export ---------------
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface Vendor {
  id: number
  name: string
  category: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  notes: string | null
  created_at: string
}

interface VendorEvent {
  id: number
  name: string
  start_date: string | null
  status: string
}

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue',
  catering: 'Catering',
  av_tech: 'AV/Tech',
  staffing: 'Staffing',
  marketing: 'Marketing',
  transport: 'Transport',
  photo_video: 'Photo/Video',
  sponsorship: 'Sponsorship',
  print_branding: 'Print/Branding',
  logistics: 'Logistics',
  production: 'Production',
  technology: 'Technology',
  media: 'Media',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  venue: 'bg-blue-100 text-blue-700',
  catering: 'bg-green-100 text-green-700',
  av_tech: 'bg-purple-100 text-purple-700',
  staffing: 'bg-orange-100 text-orange-700',
  marketing: 'bg-pink-100 text-pink-700',
  transport: 'bg-cyan-100 text-cyan-700',
  photo_video: 'bg-yellow-100 text-yellow-700',
  sponsorship: 'bg-teal-100 text-teal-700',
  print_branding: 'bg-rose-100 text-rose-700',
  logistics: 'bg-amber-100 text-amber-700',
  production: 'bg-indigo-100 text-indigo-700',
  technology: 'bg-violet-100 text-violet-700',
  media: 'bg-sky-100 text-sky-700',
  other: 'bg-gray-100 text-gray-700',
}

const EMPTY_FORM = { name: '', category: 'other', contact_name: '', contact_email: '', contact_phone: '', website: '', notes: '' }

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'manual' | 'ai'>('manual')
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [formPrefilled, setFormPrefilled] = useState(false)
  const { sortKey, sortDir, toggle } = useSortState<'name' | 'category' | 'contact'>('name')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)
  const [expandedVendorId, setExpandedVendorId] = useState<number | null>(null)
  const [vendorEvents, setVendorEvents] = useState<Record<number, VendorEvent[] | 'loading'>>({})

  const toggleEvents = async (vendorId: number) => {
    if (expandedVendorId === vendorId) {
      setExpandedVendorId(null)
      return
    }
    setExpandedVendorId(vendorId)
    if (vendorEvents[vendorId]) return
    setVendorEvents(prev => ({ ...prev, [vendorId]: 'loading' }))
    try {
      const res = await fetch(`/api/vendors/${vendorId}/events`)
      const data = await res.json()
      setVendorEvents(prev => ({ ...prev, [vendorId]: data }))
    } catch {
      setVendorEvents(prev => ({ ...prev, [vendorId]: [] }))
    }
  }

  const fetchVendors = () => {
    const params = new URLSearchParams()
    if (categoryFilter) params.set('category', categoryFilter)
    if (search) params.set('search', search)
    fetch(`/api/vendors?${params}`)
      .then(r => r.json())
      .then(d => { setVendors(d); setLoading(false) })
  }

  useEffect(() => { fetchVendors() }, [search, categoryFilter])

  const openAdd = () => {
    setEditingVendor(null)
    setForm({ ...EMPTY_FORM })
    setMode('manual')
    setAiQuery('')
    setAiError(null)
    setAiExplanation(null)
    setFormPrefilled(false)
    setShowModal(true)
  }

  const runAiLookup = async () => {
    if (!aiQuery.trim()) { setAiError('Please enter a vendor name, website, or description.'); return }
    setAiLoading(true)
    setAiError(null)
    setAiExplanation(null)
    try {
      const res = await fetch('/api/vendors/ai-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI lookup failed')
      setForm({
        name: data.name || '',
        category: data.category || 'other',
        contact_name: data.contact_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        website: data.website || '',
        notes: data.notes || '',
      })
      setAiExplanation(data.explanation || null)
      setFormPrefilled(true)
      setMode('manual')
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setAiLoading(false)
    }
  }

  const openEdit = (v: Vendor) => {
    setEditingVendor(v)
    setForm({ name: v.name, category: v.category, contact_name: v.contact_name || '', contact_email: v.contact_email || '', contact_phone: v.contact_phone || '', website: v.website || '', notes: v.notes || '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.category) return
    setSaving(true)
    if (editingVendor) {
      await fetch(`/api/vendors/${editingVendor.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setSaving(false)
    setShowModal(false)
    fetchVendors()
  }

  const remove = async (id: number) => {
    await fetch(`/api/vendors/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchVendors()
  }

  const exportCSV = () => {
    const header = ['Name', 'Category', 'Contact Name', 'Contact Email', 'Contact Phone', 'Website', 'Notes']
    const rows = vendors.map(v => [
      v.name,
      CATEGORY_LABELS[v.category] || v.category,
      v.contact_name ?? '',
      v.contact_email ?? '',
      v.contact_phone ?? '',
      v.website ?? '',
      v.notes ?? '',
    ])
    downloadCSV([header, ...rows], 'vendors.csv')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const sorted = [...vendors].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'category') cmp = (a.category || '').localeCompare(b.category || '')
    else if (sortKey === 'contact') cmp = (a.contact_name || '').localeCompare(b.contact_name || '')
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Directory</h1>
          <p className="text-gray-500 mt-1">Your global vendor database — to use a vendor on a specific event, open that event and link them from the Vendors tab.</p>
        </div>
        <div className="flex items-center gap-2">
          {vendors.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export CSV
            </button>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(search || categoryFilter) && (
          <button onClick={() => { setSearch(''); setCategoryFilter('') }} className="text-sm text-gray-500 hover:text-gray-700 px-2">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <SortTh label="Vendor" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
              <SortTh label="Category" col="category" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
              <SortTh label="Contact" col="contact" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8">
                {search || categoryFilter ? (
                  <div className="text-center text-gray-400">No vendors match your search.</div>
                ) : (
                  <div className="flex flex-col items-center gap-5 py-6">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                      </svg>
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="text-gray-800 font-semibold text-base">Start building your vendor directory</p>
                      <p className="text-gray-500 text-sm mt-1.5">Add vendors manually or use AI to look them up by name or URL — Claude will fill in the details automatically.</p>
                    </div>
                    <button
                      onClick={openAdd}
                      className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Vendor
                    </button>
                  </div>
                )}
              </td></tr>
            ) : (
              sorted.map(v => {
                const isExpanded = expandedVendorId === v.id
                const eventsData = vendorEvents[v.id]
                return (
                  <React.Fragment key={v.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{v.name}</div>
                        {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{v.website}</a>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[v.category] || 'bg-gray-100 text-gray-700'}`}>
                          {CATEGORY_LABELS[v.category] || v.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{v.contact_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{v.contact_email ? <a href={`mailto:${v.contact_email}`} className="hover:text-blue-500">{v.contact_email}</a> : '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{v.contact_phone || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate">{v.notes || '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => toggleEvents(v.id)}
                            title="Show event history"
                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${isExpanded ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                          >
                            <svg
                              className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                            Events
                          </button>
                          <button onClick={() => openEdit(v)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                          <button onClick={() => setDeleteConfirm({ id: v.id, name: v.name })} className="text-red-400 hover:text-red-600 text-sm font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={7} className="px-8 py-3 border-t border-blue-100">
                          {eventsData === 'loading' ? (
                            <span className="text-xs text-gray-400">Loading events...</span>
                          ) : !eventsData || eventsData.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">This vendor has not been linked to any events yet.</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {(eventsData as VendorEvent[]).map(e => (
                                <a
                                  key={e.id}
                                  href={`/events/${e.id}`}
                                  className="flex items-center gap-1.5 bg-white border border-blue-100 hover:border-blue-300 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-blue-700 transition-colors shadow-sm"
                                >
                                  <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                  </svg>
                                  {e.name}
                                  {e.start_date && <span className="text-gray-400 font-normal">{new Date(e.start_date).getFullYear()}</span>}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Vendor</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently remove <span className="font-medium text-gray-700">{deleteConfirm.name}</span> from your vendor directory. If this vendor is linked to any events, those event-vendor connections will also be removed.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(deleteConfirm.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Delete Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!editingVendor && (
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    onClick={() => setMode('ai')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'ai' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    Import with AI
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Fill manually
                  </button>
                </div>
              )}

              {mode === 'ai' && !editingVendor && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-violet-900">Let AI find the vendor details</p>
                      <p className="text-xs text-violet-600 mt-0.5">Enter a vendor name, website URL, or description — Claude will look them up and fill in the form automatically.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor name, website, or description</label>
                    <textarea
                      value={aiQuery}
                      onChange={e => setAiQuery(e.target.value)}
                      rows={3}
                      placeholder={"e.g. \"Ghelani Studios\" or \"https://ghelanistudios.com\" or \"London-based photography studio for corporate events\""}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAiLookup() }}
                    />
                  </div>
                  {aiError && <p className="text-xs text-red-600">{aiError}</p>}
                  <button
                    onClick={runAiLookup}
                    disabled={aiLoading || !aiQuery.trim()}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Looking up vendor…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        Look up vendor
                      </>
                    )}
                  </button>
                </div>
              )}

              {formPrefilled && mode === 'manual' && aiExplanation && (
                <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5">
                  <svg className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-xs text-violet-700">{aiExplanation}</p>
                </div>
              )}
              {(mode === 'manual' || editingVendor) && <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={save} disabled={saving || !form.name.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
                </button>
                <button onClick={() => setShowModal(false)} className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium">Cancel</button>
              </div>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
