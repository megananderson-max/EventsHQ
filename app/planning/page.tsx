'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SortTh, useSortState } from '@/app/components/SortTh'

interface TeamMember { id: number; name: string; is_me: number }

interface PlanningItem {
  id: number
  event_id: number
  title: string
  description: string | null
  done: number
  status: string
  assigned_to: string | null
  due_date: string | null
  sort_order: number
  created_at: string
  event_name: string
  event_status: string
  event_start_date: string | null
}

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'To Do',       bg: 'bg-gray-200',   text: 'text-gray-700',  hover: 'hover:bg-gray-300'   },
  { value: 'in_progress', label: 'In Progress', bg: 'bg-blue-500',   text: 'text-white',     hover: 'hover:bg-blue-600'   },
  { value: 'complete',    label: 'Complete',    bg: 'bg-green-500',  text: 'text-white',     hover: 'hover:bg-green-600'  },
  { value: 'blocked',     label: 'Blocked',     bg: 'bg-red-500',    text: 'text-white',     hover: 'hover:bg-red-600'    },
]

const getStatus = (v: string) => STATUS_OPTIONS.find(s => s.value === v) ?? STATUS_OPTIONS[0]

const GROUP_BORDERS  = ['border-l-blue-400','border-l-violet-400','border-l-emerald-400','border-l-orange-400','border-l-pink-400','border-l-teal-400','border-l-yellow-400','border-l-indigo-400']
const GROUP_TITLES   = ['text-blue-600',    'text-violet-600',   'text-emerald-600',   'text-orange-600',   'text-pink-600',   'text-teal-600',   'text-yellow-600',   'text-indigo-600'   ]

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const palette = ['bg-blue-400','bg-violet-400','bg-emerald-500','bg-orange-400','bg-pink-400','bg-teal-500','bg-indigo-400']
  const c = palette[name.charCodeAt(0) % palette.length]
  return (
    <div title={name} className={`w-6 h-6 rounded-full ${c} flex items-center justify-center text-white text-[10px] font-bold select-none flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}

export default function PlanningPage() {
  const [items, setItems]           = useState<PlanningItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [collapsed, setCollapsed]   = useState<Set<number>>(new Set())
  const [statusMenu, setStatusMenu] = useState<number | null>(null) // item id
  const [editingCell, setEditingCell] = useState<{ id: number; field: 'title' | 'description' | 'due_date' } | null>(null)
  const [draft, setDraft]           = useState('')
  const editRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [addingFor, setAddingFor]   = useState<number | null>(null)
  const [addTitle, setAddTitle]     = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const [undoItem, setUndoItem]     = useState<PlanningItem | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { sortKey: pKey, sortDir: pDir, toggle: pToggle } = useSortState<'title' | 'assigned_to' | 'due_date' | 'status'>('due_date')
  const [search, setSearch]         = useState('')
  const [filterEvent, setFilterEvent]     = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterStatus, setFilterStatus]   = useState('all')

  const fetchItems = useCallback(() =>
    fetch('/api/planning').then(r => r.json()).then(d => { setItems(d); setLoading(false) })
  , [])

  useEffect(() => {
    fetchItems()
    fetch('/api/team-members').then(r => r.json()).then(setTeamMembers).catch(() => {})
  }, [fetchItems])

  useEffect(() => {
    if (editingCell && editRef.current) {
      editRef.current.focus()
      if (editRef.current instanceof HTMLInputElement) editRef.current.select()
    }
  }, [editingCell])

  useEffect(() => {
    if (addingFor !== null) addInputRef.current?.focus()
  }, [addingFor])

  // Close status menu on outside click
  useEffect(() => {
    if (statusMenu === null) return
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-status-menu]')) setStatusMenu(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [statusMenu])

  const updateItem = useCallback(async (item: PlanningItem, changes: Partial<PlanningItem>) => {
    const updated = { ...item, ...changes }
    if (changes.status !== undefined) updated.done = changes.status === 'complete' ? 1 : 0
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    await fetch(`/api/events/${item.event_id}/planning/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: updated.title, description: updated.description, done: updated.done, status: updated.status, assigned_to: updated.assigned_to, due_date: updated.due_date }),
    }).catch(() => fetchItems())
  }, [fetchItems])

  const commitEdit = useCallback(async (item: PlanningItem) => {
    if (!editingCell || editingCell.id !== item.id) return
    const { field } = editingCell
    const value = draft.trim() || null
    setEditingCell(null)
    if (field === 'title' && !value) return
    await updateItem(item, { [field]: value })
  }, [editingCell, draft, updateItem])

  const addTask = async (eventId: number) => {
    const title = addTitle.trim()
    setAddTitle('')
    setAddingFor(null)
    if (!title) return
    await fetch(`/api/events/${eventId}/planning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status: 'todo' }),
    })
    fetchItems()
  }

  const deleteItem = (item: PlanningItem) => {
    // Optimistically remove from UI
    setItems(prev => prev.filter(i => i.id !== item.id))
    // Cancel any previous pending delete
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoItem(item)
    // After 4s, actually delete via API
    undoTimerRef.current = setTimeout(async () => {
      setUndoItem(null)
      await fetch(`/api/events/${item.event_id}/planning/${item.id}`, { method: 'DELETE' })
    }, 4000)
  }

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    if (undoItem) {
      setItems(prev => [...prev, undoItem])
      setUndoItem(null)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  // Filter
  const filtered = items.filter(i => {
    if (filterEvent !== 'all' && String(i.event_id) !== filterEvent) return false
    if (filterAssignee !== 'all' && i.assigned_to !== filterAssignee) return false
    if (filterStatus !== 'all' && (i.status || 'todo') !== filterStatus) return false
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by event
  const groupMap = new Map<number, { event_id: number; event_name: string; event_status: string; event_start_date: string | null; items: PlanningItem[] }>()
  for (const item of filtered) {
    if (!groupMap.has(item.event_id)) {
      groupMap.set(item.event_id, { event_id: item.event_id, event_name: item.event_name, event_status: item.event_status, event_start_date: item.event_start_date, items: [] })
    }
    groupMap.get(item.event_id)!.items.push(item)
  }
  const groups = Array.from(groupMap.values())

  const eventOptions = [...new Map(items.map(i => [i.event_id, i.event_name])).entries()]
  const assigneeOptions = [...new Set(items.filter(i => i.assigned_to).map(i => i.assigned_to!))]

  const stats = STATUS_OPTIONS.map(s => ({ ...s, count: items.filter(i => (i.status || 'todo') === s.value).length }))

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Tasks</h1>
          <p className="text-xs text-gray-400 mt-0.5">Tasks across all events · click any cell to edit inline</p>
        </div>
      </div>

      {/* Status stat pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {stats.map(s => (
          <button key={s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? 'all' : s.value)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${filterStatus === s.value ? 'border-gray-400 bg-white shadow-sm ring-1 ring-gray-300' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <span className={`w-2 h-2 rounded-full ${s.bg}`} />
            <span className="text-gray-600">{s.label}</span>
            <span className="text-gray-400 font-normal tabular-nums">{s.count}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-40" />
        </div>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[200px]">
          <option value="all">All Events</option>
          {eventOptions.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
        </select>
        {assigneeOptions.length > 0 && (
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">All Owners</option>
            {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {(search || filterEvent !== 'all' || filterAssignee !== 'all' || filterStatus !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterEvent('all'); setFilterAssignee('all'); setFilterStatus('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            Clear
          </button>
        )}
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          {(search || filterEvent !== 'all' || filterAssignee !== 'all' || filterStatus !== 'all')
            ? 'No tasks match your filters.'
            : 'No tasks yet. Tasks are added automatically when you confirm an opportunity as an event, or you can add them manually from within any event.'}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group, gi) => {
            const borderCls = GROUP_BORDERS[gi % GROUP_BORDERS.length]
            const titleCls  = GROUP_TITLES[gi % GROUP_TITLES.length]
            const isCollapsed = collapsed.has(group.event_id)
            const openCount = group.items.filter(i => (i.status || 'todo') !== 'complete').length
            const doneCount = group.items.filter(i => (i.status || 'todo') === 'complete').length

            return (
              <div key={group.event_id} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderCls} shadow-sm overflow-visible`}>
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <button
                    onClick={() => setCollapsed(p => { const n = new Set(p); n.has(group.event_id) ? n.delete(group.event_id) : n.add(group.event_id); return n })}
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    <svg className={`w-4 h-4 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  <Link href={`/events/${group.event_id}?tab=planning`} className={`font-bold text-sm ${titleCls} hover:underline`}>
                    {group.event_name}
                  </Link>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 font-medium">
                    {openCount} open{doneCount > 0 ? ` · ${doneCount} done` : ''}
                  </span>
                  {group.event_start_date && (
                    <span className="text-xs text-gray-400 ml-1">
                      {new Date(group.event_start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/40">
                        <th className="w-10 px-4 py-2" />
                        <SortTh label="Task" col="title" sortKey={pKey} sortDir={pDir} onSort={pToggle} className="px-3 py-2 text-xs font-medium uppercase tracking-wide" />
                        <SortTh label="Owner" col="assigned_to" sortKey={pKey} sortDir={pDir} onSort={pToggle} className="px-3 py-2 text-xs font-medium uppercase tracking-wide w-40" />
                        <SortTh label="Due Date" col="due_date" sortKey={pKey} sortDir={pDir} onSort={pToggle} className="px-3 py-2 text-xs font-medium uppercase tracking-wide w-28" />
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</th>
                        <SortTh label="Status" col="status" sortKey={pKey} sortDir={pDir} onSort={pToggle} className="px-3 py-2 text-xs font-medium uppercase tracking-wide w-32" />
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...group.items].sort((a, b) => {
                        const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, blocked: 2, complete: 3 }
                        let cmp = 0
                        if (pKey === 'title') cmp = a.title.localeCompare(b.title)
                        else if (pKey === 'assigned_to') cmp = (a.assigned_to || '').localeCompare(b.assigned_to || '')
                        else if (pKey === 'due_date') cmp = (a.due_date || '9999').localeCompare(b.due_date || '9999')
                        else if (pKey === 'status') cmp = (STATUS_ORDER[a.status || 'todo'] ?? 9) - (STATUS_ORDER[b.status || 'todo'] ?? 9)
                        return pDir === 'asc' ? cmp : -cmp
                      }).map(item => {
                        const st = getStatus(item.status || 'todo')
                        const isComplete = (item.status || 'todo') === 'complete'
                        const isOverdue = !isComplete && item.due_date && item.due_date < today
                        const editTitle = editingCell?.id === item.id && editingCell.field === 'title'
                        const editDesc  = editingCell?.id === item.id && editingCell.field === 'description'
                        const editDate  = editingCell?.id === item.id && editingCell.field === 'due_date'

                        return (
                          <tr key={item.id} className={`border-b border-gray-50 group/row transition-colors hover:bg-gray-50/60 ${isComplete ? 'opacity-55' : ''}`}>

                            {/* Checkbox */}
                            <td className="px-4 py-2.5 align-middle">
                              <button
                                onClick={() => updateItem(item, { status: isComplete ? 'todo' : 'complete' })}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isComplete ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                                {isComplete && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                              </button>
                            </td>

                            {/* Task name */}
                            <td className="px-3 py-2.5 align-middle min-w-[180px]">
                              {editTitle ? (
                                <input ref={editRef as React.RefObject<HTMLInputElement>} value={draft}
                                  onChange={e => setDraft(e.target.value)}
                                  onBlur={() => commitEdit(item)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') setEditingCell(null) }}
                                  className="w-full text-sm border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              ) : (
                                <span onClick={() => { setEditingCell({ id: item.id, field: 'title' }); setDraft(item.title) }}
                                  className={`text-sm cursor-text hover:bg-blue-50 rounded px-1 py-0.5 -mx-1 block ${isComplete ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                                  {item.title}
                                </span>
                              )}
                            </td>

                            {/* Owner */}
                            <td className="px-3 py-2.5 align-middle">
                              <div className="flex items-center gap-1.5">
                                {item.assigned_to && <Avatar name={item.assigned_to} />}
                                <select value={item.assigned_to || ''}
                                  onChange={e => updateItem(item, { assigned_to: e.target.value || null })}
                                  className="text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white focus:rounded px-1 py-0.5 text-gray-600 cursor-pointer hover:bg-gray-100 rounded max-w-[100px]">
                                  <option value="">Unassigned</option>
                                  {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}{m.is_me ? ' (me)' : ''}</option>)}
                                </select>
                              </div>
                            </td>

                            {/* Due date */}
                            <td className="px-3 py-2.5 align-middle">
                              {editDate ? (
                                <input ref={editRef as React.RefObject<HTMLInputElement>} type="date" value={draft}
                                  onChange={e => setDraft(e.target.value)}
                                  onBlur={() => commitEdit(item)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') setEditingCell(null) }}
                                  className="text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full" />
                              ) : (
                                <button onClick={() => { setEditingCell({ id: item.id, field: 'due_date' }); setDraft(item.due_date || '') }}
                                  className={`text-xs rounded px-2 py-1 hover:bg-gray-100 transition-colors whitespace-nowrap ${isOverdue ? 'text-red-600 font-semibold' : item.due_date ? 'text-gray-600' : 'text-gray-300 italic'}`}>
                                  {item.due_date
                                    ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : 'Set date'}
                                  {isOverdue && ' ⚠'}
                                </button>
                              )}
                            </td>

                            {/* Notes */}
                            <td className="px-3 py-2.5 align-middle max-w-[220px]">
                              {editDesc ? (
                                <textarea ref={editRef as React.RefObject<HTMLTextAreaElement>} value={draft} rows={2}
                                  onChange={e => setDraft(e.target.value)}
                                  onBlur={() => commitEdit(item)}
                                  onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null) }}
                                  className="w-full text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                              ) : (
                                <span onClick={() => { setEditingCell({ id: item.id, field: 'description' }); setDraft(item.description || '') }}
                                  className={`text-xs cursor-text hover:bg-blue-50 rounded px-1 py-0.5 -mx-1 block truncate ${item.description ? 'text-gray-500' : 'text-gray-300 italic'}`}>
                                  {item.description || 'Add note…'}
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-3 py-2.5 align-middle">
                              <div className="relative" data-status-menu>
                                <button
                                  onClick={() => setStatusMenu(statusMenu === item.id ? null : item.id)}
                                  className={`text-xs font-semibold px-3 py-1.5 rounded w-full text-center transition-opacity ${st.hover} ${st.bg} ${st.text}`}>
                                  {st.label}
                                </button>
                                {statusMenu === item.id && (
                                  <div className="absolute z-50 left-0 top-[calc(100%+4px)] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden min-w-[130px]">
                                    {STATUS_OPTIONS.map(s => (
                                      <button key={s.value}
                                        onClick={() => { updateItem(item, { status: s.value }); setStatusMenu(null) }}
                                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 ${s.bg} ${s.text} ${s.hover}`}>
                                        {s.label}
                                        {(item.status || 'todo') === s.value && <svg className="w-3 h-3 ml-auto opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Delete */}
                            <td className="px-2 py-2.5 align-middle">
                              <button onClick={() => deleteItem(item)}
                                className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-500 transition-all" title="Delete task">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        )
                      })}

                      {/* Add task row */}
                      {addingFor === group.event_id ? (
                        <tr className="border-b border-gray-50 bg-blue-50/30">
                          <td className="px-4 py-2.5" />
                          <td colSpan={5} className="px-3 py-2">
                            <input ref={addInputRef} value={addTitle}
                              onChange={e => setAddTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') addTask(group.event_id); if (e.key === 'Escape') { setAddingFor(null); setAddTitle('') } }}
                              onBlur={() => addTask(group.event_id)}
                              placeholder="Task name…"
                              className="w-full text-sm border border-blue-400 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          </td>
                          <td />
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-2.5">
                            <button onClick={() => { setAddingFor(group.event_id); setAddTitle('') }}
                              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors group/add">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                              <span>Add task</span>
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Undo toast */}
      {undoItem && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm shadow-2xl">
          <span className="truncate max-w-[220px]">Deleted &ldquo;{undoItem.title}&rdquo;</span>
          <button
            onClick={handleUndo}
            className="flex-shrink-0 font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
