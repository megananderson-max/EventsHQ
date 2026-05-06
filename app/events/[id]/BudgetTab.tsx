'use client'

import { useState, useEffect, useRef } from 'react'
import { SortTh, useSortState } from '@/app/components/SortTh'
import Tooltip from '@/app/components/Tooltip'

// --------------- UndoToast ---------------
function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg whitespace-nowrap">
      <span>{message} &middot; </span>
      <button onClick={onUndo} className="font-semibold text-blue-300 hover:text-blue-200 underline underline-offset-2">Undo</button>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-200 ml-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  )
}

// --------------- CSV export ---------------
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface BudgetItem {
  id: number
  event_id: number
  category: string
  description: string
  vendor_id: number | null
  vendor_name: string | null
  planned_amount: number
  actual_amount: number
  po_number: string | null
  invoice_number: string | null
  payment_due_date: string | null
  status: string
  notes: string | null
  is_estimate: number  // 1 = estimate, 0 = contracted/confirmed price
}

interface Vendor {
  id: number
  name: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  invoiced: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
}

const CATEGORIES = ['sponsorship', 'branding', 'travel', 'accommodation', 'venue', 'catering', 'av_tech', 'staffing', 'marketing', 'transport', 'hotel', 'contingency', 'misc']

const CATEGORY_LABELS: Record<string, string> = {
  sponsorship: 'Sponsorship',
  branding: 'Branding',
  travel: 'Travel',
  accommodation: 'Accommodation',
  venue: 'Venue',
  catering: 'Catering',
  av_tech: 'AV / Tech',
  staffing: 'Staffing',
  marketing: 'Marketing',
  transport: 'Transport',
  hotel: 'Hotel',
  contingency: 'Contingency',
  misc: 'Miscellaneous',
}

const BUDGET_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  invoiced: 'Invoiced',
  paid: 'Paid',
}


function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
}

// Detect if a budget item contains a GBP amount in its description (e.g. "£37,500")
function extractGBP(notes: string | null): string | null {
  if (!notes) return null
  const m = notes.match(/£([\d,]+(?:\.\d+)?)/)
  return m ? `£${m[1]}` : null
}

const EMPTY_FORM = { category: 'misc', description: '', vendor_id: '', planned_amount: '', actual_amount: '0', po_number: '', invoice_number: '', payment_due_date: '', status: 'pending', notes: '', is_estimate: '1' }

const DEFAULT_CONTINGENCY = 5000

export default function BudgetTab({ eventId, budgetTotal }: { eventId: string; budgetTotal: number }) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [contingencyAdded, setContingencyAdded] = useState(false)

  // AI budget generation
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Change 1: delete confirmation state
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  // Undo toast state
  const [undoItem, setUndoItem] = useState<BudgetItem | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Change 3: bulk mark-as-paid
  const [markingPaid, setMarkingPaid] = useState(false)
  const [markPaidSuccess, setMarkPaidSuccess] = useState(false)

  // Change 4: editable contingency
  const contingencySettingKey = `event_contingency_${eventId}`
  const [contingencyAmount, setContingencyAmount] = useState<number>(DEFAULT_CONTINGENCY)
  const [editingContingency, setEditingContingency] = useState(false)
  const [contingencyInput, setContingencyInput] = useState('')
  const [contingencyMode, setContingencyMode] = useState<'dollar' | 'percent'>('dollar')
  const [savingContingency, setSavingContingency] = useState(false)

  const fetch_ = (autoContingency = false) => {
    fetch(`/api/events/${eventId}/budget`)
      .then(r => r.json())
      .then((data: BudgetItem[]) => {
        setItems(data)
        setLoading(false)
        // Auto-add contingency when items exist but none is set yet
        if (autoContingency && data.length > 0 && !data.some(i => i.category === 'contingency')) {
          const nonContingency = data.filter(i => i.category !== 'contingency')
          const planned = nonContingency.reduce((s, i) => s + (i.planned_amount || 0), 0)
          const amount = 5000
          if (planned > 0) {
            fetch(`/api/events/${eventId}/budget`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ category: 'contingency', description: 'Contingency / Slush Fund Reserve', planned_amount: amount, actual_amount: 0, status: 'pending', is_estimate: 1 }),
            }).then(() => { setContingencyAdded(true); fetch_(false) })
          }
        }
      })
  }

  // Load saved contingency from settings
  const loadContingency = () => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((settings: Record<string, string>) => {
        if (settings[contingencySettingKey] !== undefined) {
          setContingencyAmount(parseFloat(settings[contingencySettingKey]) || DEFAULT_CONTINGENCY)
        }
      })
      .catch(() => {/* use default */})
  }

  useEffect(() => {
    fetch_(true)
    fetch('/api/vendors').then(r => r.json()).then(setVendors)
    loadContingency()
  }, [eventId])

  const { sortKey: bKey, sortDir: bDir, toggle: bToggle } = useSortState<'description' | 'vendor' | 'planned' | 'actual' | 'status'>('planned')

  function sortBudget(list: BudgetItem[]) {
    return [...list].sort((a, b) => {
      let cmp = 0
      if (bKey === 'description') cmp = a.description.localeCompare(b.description)
      else if (bKey === 'vendor') cmp = (a.vendor_name || '').localeCompare(b.vendor_name || '')
      else if (bKey === 'planned') cmp = (a.planned_amount || 0) - (b.planned_amount || 0)
      else if (bKey === 'actual') cmp = (a.actual_amount || 0) - (b.actual_amount || 0)
      else if (bKey === 'status') cmp = a.status.localeCompare(b.status)
      return bDir === 'asc' ? cmp : -cmp
    })
  }

  const hasGBPItems = items.some(i => extractGBP(i.notes))
  const nonContingencyItems = items.filter(i => i.category !== 'contingency')
  const totalPlanned = nonContingencyItems.reduce((s, i) => s + (i.planned_amount || 0), 0)
  const totalActual = nonContingencyItems.reduce((s, i) => s + (i.actual_amount || 0), 0)
  const remaining = budgetTotal - totalActual
  const pctUsed = budgetTotal > 0 ? Math.min(Math.round((totalActual / budgetTotal) * 100), 100) : 0

  // Change 3: invoiced items
  const invoicedItems = items.filter(i => i.status === 'invoiced')

  const openAdd = () => {
    setEditingItem(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  const openEdit = (item: BudgetItem) => {
    setEditingItem(item)
    setForm({
      category: item.category,
      description: item.description,
      vendor_id: item.vendor_id?.toString() || '',
      planned_amount: item.planned_amount?.toString() || '0',
      actual_amount: item.actual_amount?.toString() || '0',
      po_number: item.po_number || '',
      invoice_number: item.invoice_number || '',
      payment_due_date: item.payment_due_date || '',
      status: item.status,
      notes: item.notes || '',
      is_estimate: item.is_estimate ? '1' : '0',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.category || !form.description) return
    setSaving(true)
    const payload = {
      ...form,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
      planned_amount: parseFloat(form.planned_amount) || 0,
      actual_amount: parseFloat(form.actual_amount) || 0,
      payment_due_date: form.payment_due_date || null,
      is_estimate: form.is_estimate === '1' ? 1 : 0,
    }
    if (editingItem) {
      await fetch(`/api/events/${eventId}/budget/${editingItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch(`/api/events/${eventId}/budget`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false)
    setShowModal(false)
    fetch_(false)
  }

  // Change 1: two-step delete
  const confirmDelete = (id: number) => {
    setPendingDeleteId(id)
  }

  const cancelDelete = () => {
    setPendingDeleteId(null)
  }

  const executeDelete = async (id: number) => {
    const item = items.find(i => i.id === id) ?? null
    await fetch(`/api/events/${eventId}/budget/${id}`, { method: 'DELETE' })
    setPendingDeleteId(null)
    fetch_(false)
    // Show undo toast
    setUndoItem(item)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setUndoItem(null), 4000)
  }

  const undoDelete = async () => {
    if (!undoItem) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoItem(null)
    const { id: _id, event_id: _eid, vendor_name: _vn, ...payload } = undoItem
    await fetch(`/api/events/${eventId}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    fetch_(false)
  }

  // Change 3: bulk mark-as-paid
  const markAllInvoicedAsPaid = async () => {
    if (invoicedItems.length === 0) return
    setMarkingPaid(true)
    setMarkPaidSuccess(false)
    for (const item of invoicedItems) {
      const payload = {
        category: item.category,
        description: item.description,
        vendor_id: item.vendor_id,
        planned_amount: item.planned_amount,
        actual_amount: item.actual_amount,
        po_number: item.po_number,
        invoice_number: item.invoice_number,
        payment_due_date: item.payment_due_date,
        status: 'paid',
        notes: item.notes,
        is_estimate: item.is_estimate,
      }
      await fetch(`/api/events/${eventId}/budget/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setMarkingPaid(false)
    setMarkPaidSuccess(true)
    fetch_(false)
    setTimeout(() => setMarkPaidSuccess(false), 4000)
  }

  // Change 4: save contingency
  const openContingencyEdit = () => {
    setContingencyInput(contingencyAmount.toString())
    setContingencyMode('dollar')
    setEditingContingency(true)
  }

  const cancelContingencyEdit = () => {
    setEditingContingency(false)
  }

  const saveContingency = async () => {
    let amount: number
    if (contingencyMode === 'dollar') {
      amount = parseFloat(contingencyInput) || 0
    } else {
      amount = (parseFloat(contingencyInput) || 0) / 100 * budgetTotal
    }
    setSavingContingency(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [contingencySettingKey]: String(amount) }),
    })
    setContingencyAmount(amount)
    setSavingContingency(false)
    setEditingContingency(false)
  }

  const exportCSV = () => {
    const header = ['Description', 'Category', 'Committed', 'Spent', 'Payment Status']
    const rows = items.map(i => [
      i.description,
      CATEGORY_LABELS[i.category] || i.category,
      String(i.planned_amount ?? 0),
      String(i.actual_amount ?? 0),
      BUDGET_STATUS_LABELS[i.status] || i.status,
    ])
    downloadCSV([header, ...rows], 'budget.csv')
  }

  const runAiBudget = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/ai-setup`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI budget generation failed')
      fetch_(false)
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setAiLoading(false)
    }
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Split into confirmed and estimated, then group each by category
  const confirmedItems = items.filter(i => !i.is_estimate)
  const estimatedItems = items.filter(i => !!i.is_estimate)

  const groupedConfirmed: Record<string, BudgetItem[]> = {}
  for (const item of confirmedItems) {
    if (!groupedConfirmed[item.category]) groupedConfirmed[item.category] = []
    groupedConfirmed[item.category].push(item)
  }

  const groupedEstimated: Record<string, BudgetItem[]> = {}
  for (const item of estimatedItems) {
    if (!groupedEstimated[item.category]) groupedEstimated[item.category] = []
    groupedEstimated[item.category].push(item)
  }

  return (
    <div className="space-y-6">
      {/* Contingency auto-added notice */}
      {contingencyAdded && (
        <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>A <strong>$5,000 Contingency</strong> line item was automatically added as a buffer. You can edit or remove it at any time.</span>
          </div>
          <button onClick={() => setContingencyAdded(false)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Currency notice */}
      {hasGBPItems && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span><strong>Currency note:</strong> Some line items were contracted in GBP (£). All amounts shown in USD, converted at <strong>1.26 USD/GBP</strong>. Original GBP amounts shown inline. Update actuals at time of payment to reflect real exchange rate.</span>
        </div>
      )}

      {/* Summary Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Budget Summary</h2>
          </div>
          <div className="flex items-center gap-6 text-sm">
            {/* Change 2: renamed labels */}
            <div className="text-right">
              <span className="text-gray-500">Total Budget</span>
              <div className="font-bold text-gray-900 text-lg">{fmt(budgetTotal)}</div>
            </div>
            <div className="text-right">
              <span className="text-gray-500 inline-flex items-center gap-1">Committed <Tooltip text="Sum of all planned/contracted amounts across budget line items." icon position="bottom" /></span>
              <div className="font-bold text-blue-600 text-lg">{fmt(totalPlanned)}</div>
            </div>
            <div className="text-right">
              <span className="text-gray-500 inline-flex items-center gap-1">Spent so far <Tooltip text="Sum of actual amounts paid or invoiced to date." icon position="bottom" /></span>
              <div className={`font-bold text-lg ${totalActual > totalPlanned ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalActual)}</div>
            </div>
            <div className="text-right">
              <span className="text-gray-500 inline-flex items-center gap-1">Remaining <Tooltip text="Total Budget minus Spent so far. Negative means over budget." icon position="bottom" /></span>
              <div className={`font-bold text-lg ${remaining < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmt(remaining)}</div>
            </div>
          </div>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="absolute h-full bg-blue-200 rounded-full" style={{ width: `${Math.min(totalPlanned / budgetTotal * 100, 100)}%` }} />
          <div className={`absolute h-full rounded-full ${totalActual > budgetTotal ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pctUsed}%` }} />
        </div>
        {/* Change 2: updated progress bar label */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{pctUsed}% spent</span>
          <span>{fmt(budgetTotal - totalActual - contingencyAmount)} remaining after contingency</span>
        </div>

        {/* Change 4: Editable contingency */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {!editingContingency ? (
              <>
                <span className="text-sm text-gray-600">Contingency reserve: <strong className="text-gray-800">{fmt(contingencyAmount)}</strong></span>
                <button
                  onClick={openContingencyEdit}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit contingency"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">Contingency:</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setContingencyMode('dollar')}
                    className={`px-2 py-1 text-xs font-medium ${contingencyMode === 'dollar' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >$</button>
                  <button
                    onClick={() => setContingencyMode('percent')}
                    className={`px-2 py-1 text-xs font-medium ${contingencyMode === 'percent' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >%</button>
                </div>
                <input
                  type="number"
                  value={contingencyInput}
                  onChange={e => setContingencyInput(e.target.value)}
                  className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={contingencyMode === 'dollar' ? 'Amount' : '% of budget'}
                  min="0"
                />
                {contingencyMode === 'percent' && budgetTotal > 0 && contingencyInput && (
                  <span className="text-xs text-gray-400">= {fmt((parseFloat(contingencyInput) || 0) / 100 * budgetTotal)}</span>
                )}
                <button
                  onClick={saveContingency}
                  disabled={savingContingency}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium"
                >
                  {savingContingency ? 'Saving...' : 'Save'}
                </button>
                <button onClick={cancelContingencyEdit} className="text-gray-500 hover:text-gray-700 text-xs font-medium px-2 py-1">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Change 3: Mark all invoiced as paid */}
        {invoicedItems.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={markAllInvoicedAsPaid}
              disabled={markingPaid}
              className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 disabled:opacity-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              {markingPaid ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark all invoiced as Paid ({invoicedItems.length})
                </>
              )}
            </button>
            {markPaidSuccess && (
              <span className="text-xs text-green-600 font-medium">All invoiced items marked as paid.</span>
            )}
          </div>
        )}
      </div>

      {/* Items by Category */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Line Items</h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export CSV
              </button>
            )}
            <button
              onClick={runAiBudget}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              title={items.length > 0 ? 'Add AI-generated budget estimates (new items will be added)' : 'Generate AI budget estimate for this event'}
            >
              {aiLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Claude is building your budget estimate… (20–40 seconds)
                </>
              ) : items.length === 0 ? (
                '✨ AI Suggest Budget'
              ) : (
                '✨ Regenerate Budget Estimate'
              )}
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Line Item
            </button>
          </div>
        </div>
        {aiError && (
          <div className="mx-6 mt-3 mb-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{aiError}</div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No budget items yet. Click &quot;Add Line Item&quot; to get started.</div>
        ) : (
          <div>
            {/* Confirmed / Contracted Costs */}
            {confirmedItems.length > 0 && (
              <div>
                <div className="bg-green-50 px-6 py-3 border-b border-t border-green-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-sm font-semibold text-green-800">Confirmed / Contracted Costs</span>
                    <span className="text-xs text-green-600 ml-1">({confirmedItems.length} item{confirmedItems.length !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="text-xs font-medium text-green-700">
                    Total planned: <strong>{fmt(confirmedItems.reduce((s, i) => s + (i.planned_amount || 0), 0))}</strong>
                  </span>
                </div>
                {Object.entries(groupedConfirmed).map(([category, catItems]) => {
                  const catPlanned = catItems.reduce((s, i) => s + (i.planned_amount || 0), 0)
                  const catActual = catItems.reduce((s, i) => s + (i.actual_amount || 0), 0)
                  return (
                    <div key={category}>
                      <div className="bg-gray-50 px-6 py-2 border-b border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{CATEGORY_LABELS[category] || category.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Planned: <strong className="text-gray-700">{fmt(catPlanned)}</strong></span>
                          <span className={catActual > catPlanned ? 'text-red-600 font-medium' : ''}>
                            Actual: <strong>{fmt(catActual)}</strong>
                          </span>
                        </div>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <SortTh label="Description" col="description" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Vendor" col="vendor" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Planned" col="planned" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="right" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Actual" col="actual" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="right" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Status" col="status" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                            <th className="text-right px-6 py-2 text-xs font-medium text-gray-400 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sortBudget(catItems).map(item => (
                            <>
                              <tr key={item.id} className={`hover:bg-gray-50 ${item.actual_amount > item.planned_amount ? 'bg-red-50' : ''}`}>
                                <td className="px-6 py-3 text-sm text-gray-800">
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    {item.description}
                                    {!!item.is_estimate && (
                                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium" title="This amount is an estimate, not a confirmed contract price">
                                        Est.
                                      </span>
                                    )}
                                    {extractGBP(item.notes) && (
                                      <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-mono" title="Original GBP amount, converted at 1.26 USD/GBP">
                                        {extractGBP(item.notes)} GBP
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.vendor_name || '—'}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-700 font-medium">{fmt(item.planned_amount)}</td>
                                <td className={`px-6 py-3 text-sm text-right font-medium ${item.actual_amount > item.planned_amount ? 'text-red-600' : 'text-gray-700'}`}>
                                  {fmt(item.actual_amount)}
                                </td>
                                <td className="px-6 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                                    {BUDGET_STATUS_LABELS[item.status] || item.status}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button onClick={() => openEdit(item)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                                    {/* Change 1: del with confirmation */}
                                    {pendingDeleteId === item.id ? (
                                      <span className="text-red-600 text-xs font-medium">
                                        Confirm?{' '}
                                        <button onClick={() => executeDelete(item.id)} className="underline hover:text-red-800">Yes</button>
                                        {' / '}
                                        <button onClick={cancelDelete} className="underline hover:text-red-800">No</button>
                                      </span>
                                    ) : (
                                      <button onClick={() => confirmDelete(item.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">Del</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {/* Change 1: confirmation sub-row */}
                              {pendingDeleteId === item.id && (
                                <tr key={`del-confirm-${item.id}`} className="bg-red-50">
                                  <td colSpan={6} className="px-6 py-2 text-xs text-red-700">
                                    Delete <strong>{item.description}</strong> ({fmt(item.planned_amount)})?{' '}
                                    <button onClick={() => executeDelete(item.id)} className="font-semibold underline hover:text-red-900 ml-1">Delete</button>
                                    {' '}
                                    <button onClick={cancelDelete} className="font-medium underline hover:text-red-900">Cancel</button>
                                  </td>
                                </tr>
                              )}
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Variable / Estimated Costs */}
            {estimatedItems.length > 0 && (
              <div>
                <div className="bg-amber-50 px-6 py-3 border-b border-t border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="text-sm font-semibold text-amber-800">Variable / Estimated Costs</span>
                    <span className="text-xs text-amber-600 ml-1">({estimatedItems.length} item{estimatedItems.length !== 1 ? 's' : ''})</span>
                    <span className="text-xs text-amber-500 italic ml-2">Amounts are estimates — update as costs are confirmed</span>
                  </div>
                  <span className="text-xs font-medium text-amber-700">
                    Total planned: <strong>{fmt(estimatedItems.reduce((s, i) => s + (i.planned_amount || 0), 0))}</strong>
                  </span>
                </div>
                {Object.entries(groupedEstimated).map(([category, catItems]) => {
                  const catPlanned = catItems.reduce((s, i) => s + (i.planned_amount || 0), 0)
                  const catActual = catItems.reduce((s, i) => s + (i.actual_amount || 0), 0)
                  return (
                    <div key={category}>
                      <div className="bg-gray-50 px-6 py-2 border-b border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{CATEGORY_LABELS[category] || category.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Planned: <strong className="text-gray-700">{fmt(catPlanned)}</strong></span>
                          <span className={catActual > catPlanned ? 'text-red-600 font-medium' : ''}>
                            Actual: <strong>{fmt(catActual)}</strong>
                          </span>
                        </div>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <SortTh label="Description" col="description" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Vendor" col="vendor" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Planned" col="planned" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="right" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Actual" col="actual" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="right" className="py-2 text-xs font-medium uppercase" />
                            <SortTh label="Status" col="status" sortKey={bKey} sortDir={bDir} onSort={bToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                            <th className="text-right px-6 py-2 text-xs font-medium text-gray-400 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sortBudget(catItems).map(item => (
                            <>
                              <tr key={item.id} className={`hover:bg-gray-50 ${item.actual_amount > item.planned_amount ? 'bg-red-50' : ''}`}>
                                <td className="px-6 py-3 text-sm text-gray-800">
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    {item.description}
                                    {!!item.is_estimate && (
                                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium" title="This amount is an estimate, not a confirmed contract price">
                                        Est.
                                      </span>
                                    )}
                                    {extractGBP(item.notes) && (
                                      <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-mono" title="Original GBP amount, converted at 1.26 USD/GBP">
                                        {extractGBP(item.notes)} GBP
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.vendor_name || '—'}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-700 font-medium">{fmt(item.planned_amount)}</td>
                                <td className={`px-6 py-3 text-sm text-right font-medium ${item.actual_amount > item.planned_amount ? 'text-red-600' : 'text-gray-700'}`}>
                                  {fmt(item.actual_amount)}
                                </td>
                                <td className="px-6 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                                    {BUDGET_STATUS_LABELS[item.status] || item.status}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button onClick={() => openEdit(item)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                                    {/* Change 1: del with confirmation */}
                                    {pendingDeleteId === item.id ? (
                                      <span className="text-red-600 text-xs font-medium">
                                        Confirm?{' '}
                                        <button onClick={() => executeDelete(item.id)} className="underline hover:text-red-800">Yes</button>
                                        {' / '}
                                        <button onClick={cancelDelete} className="underline hover:text-red-800">No</button>
                                      </span>
                                    ) : (
                                      <button onClick={() => confirmDelete(item.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">Del</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {/* Change 1: confirmation sub-row */}
                              {pendingDeleteId === item.id && (
                                <tr key={`del-confirm-${item.id}`} className="bg-red-50">
                                  <td colSpan={6} className="px-6 py-2 text-xs text-red-700">
                                    Delete <strong>{item.description}</strong> ({fmt(item.planned_amount)})?{' '}
                                    <button onClick={() => executeDelete(item.id)} className="font-semibold underline hover:text-red-900 ml-1">Delete</button>
                                    {' '}
                                    <button onClick={cancelDelete} className="font-medium underline hover:text-red-900">Cancel</button>
                                  </td>
                                </tr>
                              )}
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Undo Toast */}
      {undoItem && (
        <UndoToast
          message="Budget item deleted"
          onUndo={undoDelete}
          onDismiss={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoItem(null) }}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingItem ? 'Edit Line Item' : 'Add Line Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (optional)</label>
                <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— No vendor —</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Planned Amount ($)</label>
                  <input type="number" value={form.planned_amount} onChange={e => set('planned_amount', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Amount ($)</label>
                  <input type="number" value={form.actual_amount} onChange={e => set('actual_amount', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date</label>
                <input type="date" value={form.payment_due_date} onChange={e => set('payment_due_date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Best practice: set to the quarter before the event (e.g., event in Q3 → pay in Q2)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_estimate === '1'}
                    onChange={e => set('is_estimate', e.target.checked ? '1' : '0')}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm text-gray-700">
                    Mark as <span className="font-medium text-amber-700">Estimate</span>
                    <span className="text-gray-400 ml-1">(amount is not yet confirmed by contract or invoice)</span>
                  </span>
                </label>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={save} disabled={saving || !form.description} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
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
