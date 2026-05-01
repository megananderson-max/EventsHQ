'use client'

import { useState, useEffect } from 'react'
import { SortTh, useSortState } from '@/app/components/SortTh'

interface EventVendor {
  id: number
  event_id: number
  vendor_id: number
  vendor_name: string
  category: string
  contact_name: string
  contact_email: string
  status: string
  contract_value: number | null
  notes: string | null
}

interface Vendor {
  id: number
  name: string
  category: string
  contact_name: string
  contact_email: string
  contact_phone: string
  website: string
  notes: string
}

const STATUS_LABELS: Record<string, string> = {
  rfp_sent: 'RFP Sent',
  shortlisted: 'Shortlisted',
  contracted: 'Contracted',
  rejected: 'Rejected',
  completed: 'Completed',
}

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue',
  catering: 'Catering',
  av_tech: 'AV/Tech',
  staffing: 'Staffing',
  marketing: 'Marketing',
  transport: 'Transport',
  hotel: 'Hotel',
  photo_video: 'Photo/Video',
  sponsorship: 'Sponsorship',
  other: 'Other',
}

const VENDOR_CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue', catering: 'Catering', av_tech: 'AV/Tech', staffing: 'Staffing',
  marketing: 'Marketing', transport: 'Transport', hotel: 'Hotel', photo_video: 'Photo/Video',
  sponsorship: 'Sponsorship', production: 'Production', technology: 'Technology', media: 'Media', other: 'Other',
}

const EMPTY_FORM = { vendor_id: '', status: 'rfp_sent', contract_value: '', notes: '' }
const EMPTY_VENDOR_FORM = { name: '', category: 'sponsorship', contact_name: '', contact_email: '', contact_phone: '', website: '', notes: '' }

export default function VendorsTab({ eventId }: { eventId: string }) {
  const [eventVendors, setEventVendors] = useState<EventVendor[]>([])
  const [allVendors, setAllVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [vendorProfile, setVendorProfile] = useState({ ...EMPTY_VENDOR_FORM })
  const [saving, setSaving] = useState(false)
  const [vendorSearch, setVendorSearch] = useState('')
  const [showNewVendorForm, setShowNewVendorForm] = useState(false)
  const [newVendorForm, setNewVendorForm] = useState({ name: '', category: 'sponsorship', contact_name: '', contact_email: '', contact_phone: '' })
  const { sortKey, sortDir, toggle } = useSortState<'name' | 'category'>('name')

  const fetchVendors = () => {
    fetch(`/api/events/${eventId}/vendors`)
      .then(r => r.json())
      .then(data => { setEventVendors(data); setLoading(false) })
  }

  useEffect(() => {
    fetchVendors()
    fetch('/api/vendors').then(r => r.json()).then(setAllVendors)
  }, [eventId])

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setVendorProfile({ ...EMPTY_VENDOR_FORM })
    setVendorSearch('')
    setShowNewVendorForm(false)
    setShowModal(true)
  }

  const openEdit = (ev: EventVendor) => {
    setEditingId(ev.id)
    setForm({ vendor_id: ev.vendor_id.toString(), status: ev.status, contract_value: ev.contract_value?.toString() || '', notes: ev.notes || '' })
    const v = allVendors.find(x => x.id === ev.vendor_id)
    setVendorProfile(v
      ? { name: v.name, category: v.category, contact_name: v.contact_name || '', contact_email: v.contact_email || '', contact_phone: v.contact_phone || '', website: v.website || '', notes: v.notes || '' }
      : { ...EMPTY_VENDOR_FORM }
    )
    setShowModal(true)
  }

  const save = async () => {
    if (!form.vendor_id && !editingId) return
    setSaving(true)
    if (editingId) {
      const ev = eventVendors.find(v => v.id === editingId)
      await fetch(`/api/events/${eventId}/vendors/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contract_value: form.contract_value ? parseFloat(form.contract_value) : null }),
      })
      if (ev && vendorProfile.name.trim()) {
        await fetch(`/api/vendors/${ev.vendor_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vendorProfile),
        })
        const updated = await fetch('/api/vendors').then(r => r.json())
        setAllVendors(updated)
      }
    } else {
      await fetch(`/api/events/${eventId}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, vendor_id: parseInt(form.vendor_id), contract_value: form.contract_value ? parseFloat(form.contract_value) : null }),
      })
    }
    setSaving(false)
    setShowModal(false)
    fetchVendors()
  }

  const remove = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}" from this event?`)) return
    await fetch(`/api/events/${eventId}/vendors/${id}`, { method: 'DELETE' })
    fetchVendors()
  }

  const createAndAddVendor = async () => {
    if (!newVendorForm.name || !newVendorForm.category) return
    setSaving(true)
    const res = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendorForm),
    })
    const vendor = await res.json()
    const updated = await fetch('/api/vendors').then(r => r.json())
    setAllVendors(updated)
    setForm(f => ({ ...f, vendor_id: vendor.id.toString() }))
    setShowNewVendorForm(false)
    setSaving(false)
  }

  const filteredVendors = allVendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.category.toLowerCase().includes(vendorSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Event Vendors</h2>
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Vendor
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <SortTh label="Vendor" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
              <SortTh label="Category" col="category" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : eventVendors.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No vendors added yet. Click &quot;Add Vendor&quot; to get started.</td></tr>
            ) : (
              [...eventVendors].sort((a, b) => {
                let cmp = 0
                if (sortKey === 'name') cmp = a.vendor_name.localeCompare(b.vendor_name)
                else if (sortKey === 'category') cmp = (a.category || '').localeCompare(b.category || '')
                return sortDir === 'asc' ? cmp : -cmp
              }).map(ev => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{ev.vendor_name}</div>
                    {ev.contact_name && <div className="text-xs text-gray-400">{ev.contact_name}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{CATEGORY_LABELS[ev.category] || ev.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{ev.notes || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(ev)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                      <button onClick={() => remove(ev.id, ev.vendor_name)} className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingId ? 'Edit Vendor' : 'Add Vendor to Event'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Vendor selector (add mode only) */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Vendor <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Search vendors..."
                    value={vendorSearch}
                    onChange={e => setVendorSearch(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {filteredVendors.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">No vendors found</div>
                    ) : (
                      filteredVendors.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setForm(f => ({ ...f, vendor_id: v.id.toString() }))}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${form.vendor_id === v.id.toString() ? 'bg-blue-50' : ''}`}
                        >
                          <div>
                            <span className="font-medium text-gray-900">{v.name}</span>
                            {v.contact_name && <span className="text-gray-400 text-xs ml-2">· {v.contact_name}</span>}
                          </div>
                          <span className="text-xs text-gray-400 capitalize">{CATEGORY_LABELS[v.category] || v.category}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setShowNewVendorForm(!showNewVendorForm)}
                    className="mt-2 text-sm text-blue-500 hover:text-blue-700 font-medium"
                  >
                    + Create new vendor
                  </button>
                  {showNewVendorForm && (
                    <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">New Vendor</p>
                      <input placeholder="Vendor name *" value={newVendorForm.name} onChange={e => setNewVendorForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <select value={newVendorForm.category} onChange={e => setNewVendorForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input placeholder="Contact name" value={newVendorForm.contact_name} onChange={e => setNewVendorForm(f => ({ ...f, contact_name: e.target.value }))} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input placeholder="Contact email" value={newVendorForm.contact_email} onChange={e => setNewVendorForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={createAndAddVendor} disabled={saving || !newVendorForm.name} className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-medium">
                        Create & Select
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Event-specific details */}
              <div className="space-y-4">
                {editingId && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Event Details</p>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contract Value ($)</label>
                  <input type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              {/* Vendor profile (edit mode only) */}
              {editingId && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <p className="text-xs text-amber-800">Changes to vendor details update the global vendor record and will be reflected across all events.</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendor Profile</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                    <input value={vendorProfile.name} onChange={e => setVendorProfile(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={vendorProfile.category} onChange={e => setVendorProfile(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {Object.entries(VENDOR_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input value={vendorProfile.contact_name} onChange={e => setVendorProfile(f => ({ ...f, contact_name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input value={vendorProfile.contact_phone} onChange={e => setVendorProfile(f => ({ ...f, contact_phone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={vendorProfile.contact_email} onChange={e => setVendorProfile(f => ({ ...f, contact_email: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input type="url" value={vendorProfile.website} onChange={e => setVendorProfile(f => ({ ...f, website: e.target.value }))} placeholder="https://" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={save} disabled={saving || (!editingId && !form.vendor_id)} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Vendor'}
                </button>
                <button onClick={() => setShowModal(false)} className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
