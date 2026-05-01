'use client'

import { useEffect, useRef, useState } from 'react'
import { SortTh, useSortState } from '@/app/components/SortTh'

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

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'complete'

interface PlanningItem {
  id: number
  event_id: number
  title: string
  description: string | null
  done: number
  sort_order: number
  assigned_to: string | null
  due_date: string | null
  status: TaskStatus | null
  created_at: string
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function DueBadge({ due_date }: { due_date: string }) {
  const days = daysUntil(due_date)
  const formatted = new Date(due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (days < 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">{formatted} · {Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">Due today</span>
  if (days <= 3) return <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">{formatted} · {days}d left</span>
  if (days <= 7) return <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">{formatted} · {days}d left</span>
  return <span className="text-xs text-gray-500 whitespace-nowrap">{formatted}</span>
}

const STATUS_CYCLE: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'todo']
const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'blocked',
  blocked: 'todo',
  complete: 'complete',
}

function StatusBadge({ status, onClick }: { status: TaskStatus | null; onClick?: () => void }) {
  const s = status ?? 'todo'
  const cfg: Record<TaskStatus, { label: string; cls: string }> = {
    todo:        { label: 'To Do',       cls: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200' },
    in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
    blocked:     { label: 'Blocked',     cls: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
    complete:    { label: 'Complete',    cls: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
  }
  const { label, cls } = cfg[s]
  return (
    <button
      onClick={onClick}
      disabled={!onClick || s === 'complete'}
      className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${cls} ${onClick && s !== 'complete' ? 'cursor-pointer' : 'cursor-default'}`}
      title={onClick && s !== 'complete' ? `Click to advance status` : undefined}
    >
      {label}
    </button>
  )
}

interface TeamMember { id: number; name: string }

interface TaskRowProps {
  item: PlanningItem
  eventId: string
  teamMembers: TeamMember[]
  onRefresh: () => void
  onDeleted: (item: PlanningItem) => void
  selected: boolean
  onSelectChange: (id: number, checked: boolean) => void
}

type EditField = 'title' | 'description' | 'due_date' | null

function TaskRow({ item, eventId, teamMembers, onRefresh, onDeleted, selected, onSelectChange }: TaskRowProps) {
  const [editingField, setEditingField] = useState<EditField>(null)
  const [editTitle, setEditTitle] = useState(item.title)
  const [editDesc, setEditDesc] = useState(item.description || '')
  const [editDueDate, setEditDueDate] = useState(item.due_date || '')
  const [pendingDelete, setPendingDelete] = useState(false)

  const startEdit = (field: EditField) => {
    setEditTitle(item.title)
    setEditDesc(item.description || '')
    setEditDueDate(item.due_date || '')
    setEditingField(field)
  }

  const save = async (field: EditField, value: string) => {
    setEditingField(null)
    const payload = {
      title: field === 'title' ? (value.trim() || item.title) : item.title,
      description: field === 'description' ? (value.trim() || null) : item.description,
      done: item.done,
      assigned_to: item.assigned_to,
      due_date: field === 'due_date' ? (value || null) : item.due_date,
      status: item.status,
    }
    await fetch(`/api/events/${eventId}/planning/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    onRefresh()
  }

  const saveAssignee = async (name: string) => {
    await fetch(`/api/events/${eventId}/planning/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.title, description: item.description, done: item.done, assigned_to: name || null, due_date: item.due_date, status: item.status }),
    })
    onRefresh()
  }

  const toggleDone = async () => {
    const nowDone = !item.done
    await fetch(`/api/events/${eventId}/planning/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.title, description: item.description, done: nowDone, assigned_to: item.assigned_to, due_date: item.due_date, status: nowDone ? 'complete' : (item.status === 'complete' ? 'todo' : item.status) }),
    })
    onRefresh()
  }

  const cycleStatus = async () => {
    if (!item.status || item.status === 'complete') return
    const next = STATUS_NEXT[item.status] ?? 'in_progress'
    await fetch(`/api/events/${eventId}/planning/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.title, description: item.description, done: item.done, assigned_to: item.assigned_to, due_date: item.due_date, status: next }),
    })
    onRefresh()
  }

  const confirmDelete = async () => {
    await fetch(`/api/events/${eventId}/planning/${item.id}`, { method: 'DELETE' })
    onRefresh()
    onDeleted(item)
  }

  const isOverdue = item.due_date && !item.done && daysUntil(item.due_date) < 0
  const isDueSoon = item.due_date && !item.done && daysUntil(item.due_date) >= 0 && daysUntil(item.due_date) <= 3

  const rowBg = item.done
    ? 'bg-gray-50/60'
    : isOverdue
    ? 'bg-red-50/30'
    : isDueSoon
    ? 'bg-orange-50/20'
    : 'bg-white'

  const cellClass = 'px-3 py-2.5 align-middle cursor-text hover:bg-blue-50/40 transition-colors'
  const inputClass = 'w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white'

  return (
    <tr className={`group border-b border-gray-100 ${rowBg}`}>
      {/* Bulk-select checkbox */}
      <td className="w-8 px-2 py-2.5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onSelectChange(item.id, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          title="Select task"
        />
      </td>

      {/* Done toggle */}
      <td className="w-10 px-3 py-2.5 align-middle">
        <button
          onClick={toggleDone}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            item.done ? 'border-blue-400 bg-blue-500 hover:bg-blue-400' : 'border-gray-300 hover:border-blue-500'
          }`}
          title={item.done ? 'Mark incomplete' : 'Mark complete'}
        >
          {item.done && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </td>

      {/* Task title */}
      <td className={`${cellClass} min-w-[160px]`} onClick={() => editingField !== 'title' && startEdit('title')}>
        {editingField === 'title' ? (
          <input
            autoFocus
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => save('title', editTitle)}
            onKeyDown={e => { if (e.key === 'Enter') save('title', editTitle); if (e.key === 'Escape') setEditingField(null) }}
            className={inputClass}
          />
        ) : (
          <span className={`text-sm font-medium leading-snug ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item.title}
          </span>
        )}
      </td>

      {/* Description */}
      <td className={`${cellClass} min-w-[180px]`} onClick={() => editingField !== 'description' && startEdit('description')}>
        {editingField === 'description' ? (
          <input
            autoFocus
            type="text"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            onBlur={() => save('description', editDesc)}
            onKeyDown={e => { if (e.key === 'Enter') save('description', editDesc); if (e.key === 'Escape') setEditingField(null) }}
            className={inputClass}
            placeholder="Add description…"
          />
        ) : (
          <span className={`text-sm leading-snug ${item.done ? 'text-gray-300' : item.description ? 'text-gray-500' : 'text-gray-300 italic text-xs'}`}>
            {item.description || '—'}
          </span>
        )}
      </td>

      {/* Assignee */}
      <td className="px-3 py-2.5 align-middle w-36">
        <select
          value={item.assigned_to || ''}
          onChange={e => saveAssignee(e.target.value)}
          className={`text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white focus:rounded px-1 py-0.5 cursor-pointer hover:bg-gray-100 rounded max-w-full w-full ${item.done ? 'text-gray-300' : item.assigned_to ? 'text-indigo-700' : 'text-gray-400'}`}
        >
          <option value="">Unassigned</option>
          {teamMembers.map(m => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </td>

      {/* State badge */}
      <td className="px-3 py-2.5 align-middle w-32">
        <StatusBadge
          status={item.status}
          onClick={!item.done ? cycleStatus : undefined}
        />
      </td>

      {/* Due date */}
      <td className={`${cellClass} w-36`} onClick={() => editingField !== 'due_date' && startEdit('due_date')}>
        {editingField === 'due_date' ? (
          <input
            autoFocus
            type="date"
            value={editDueDate}
            onChange={e => setEditDueDate(e.target.value)}
            onBlur={() => save('due_date', editDueDate)}
            onKeyDown={e => { if (e.key === 'Escape') setEditingField(null) }}
            className={inputClass}
          />
        ) : item.due_date && !item.done ? (
          <DueBadge due_date={item.due_date} />
        ) : item.due_date ? (
          <span className="text-xs text-gray-300">{new Date(item.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        ) : (
          <span className="text-gray-300 text-xs italic">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 align-middle w-10">
        {pendingDelete ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 whitespace-nowrap">Delete?</span>
            <button
              onClick={confirmDelete}
              className="text-red-600 font-semibold hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setPendingDelete(false)}
              className="text-gray-500 font-semibold hover:text-gray-700 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setPendingDelete(true)}
              className="p-1 text-gray-400 hover:text-red-500 rounded"
              title="Delete task"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function PlanningTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<PlanningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [showAddDetails, setShowAddDetails] = useState(false)
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Undo toast state
  const [undoTask, setUndoTask] = useState<PlanningItem | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchItems = () => {
    fetch(`/api/events/${eventId}/planning`)
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false) })
  }

  useEffect(() => {
    fetchItems()
    fetch('/api/team-members').then(r => r.json()).then(setTeamMembers).catch(() => {})
  }, [eventId])

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    await fetch(`/api/events/${eventId}/planning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        done: false,
        assigned_to: newAssignee.trim() || null,
        due_date: newDueDate || null,
        status: 'todo',
      }),
    })
    setNewTitle('')
    setNewDesc('')
    setNewAssignee('')
    setNewDueDate('')
    setShowAddDetails(false)
    setAdding(false)
    fetchItems()
  }

  const { sortKey, sortDir, toggle } = useSortState<'title' | 'assigned_to' | 'due_date'>('due_date', 'asc')

  function sortList(list: PlanningItem[]) {
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortKey === 'assigned_to') cmp = (a.assigned_to || '').localeCompare(b.assigned_to || '')
      else if (sortKey === 'due_date') cmp = (a.due_date || '9999').localeCompare(b.due_date || '9999')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const todo = sortList(items.filter(i => !i.done))
  const done = sortList(items.filter(i => i.done))
  const pct = items.length > 0 ? Math.round((done.length / items.length) * 100) : 0
  const overdueCount = todo.filter(i => i.due_date && daysUntil(i.due_date) < 0).length
  const dueSoonCount = todo.filter(i => i.due_date && daysUntil(i.due_date) >= 0 && daysUntil(i.due_date) <= 7).length

  const todoIds = todo.map(i => i.id)
  const allTodoSelected = todoIds.length > 0 && todoIds.every(id => selectedIds.has(id))
  const someTodoSelected = todoIds.some(id => selectedIds.has(id))

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      todoIds.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const handleBulkMarkComplete = async () => {
    setBulkLoading(true)
    const toComplete = items.filter(i => selectedIds.has(i.id))
    await Promise.all(toComplete.map(item =>
      fetch(`/api/events/${eventId}/planning/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          done: 1,
          assigned_to: item.assigned_to,
          due_date: item.due_date,
          status: 'complete',
        }),
      })
    ))
    setSelectedIds(new Set())
    setBulkLoading(false)
    fetchItems()
  }

  const selectedCount = selectedIds.size

  const handleTaskDeleted = (task: PlanningItem) => {
    setUndoTask(task)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setUndoTask(null), 4000)
  }

  const undoDelete = async () => {
    if (!undoTask) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoTask(null)
    await fetch(`/api/events/${eventId}/planning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: undoTask.title,
        description: undoTask.description,
        done: undoTask.done,
        assigned_to: undoTask.assigned_to,
        due_date: undoTask.due_date,
        status: undoTask.status,
      }),
    })
    fetchItems()
  }

  const exportCSV = () => {
    const header = ['Title', 'Assigned To', 'Due Date', 'Status', 'Description']
    const rows = items.map(i => [
      i.title,
      i.assigned_to ?? '',
      i.due_date ?? '',
      i.status ?? '',
      i.description ?? '',
    ])
    downloadCSV([header, ...rows], 'planning-tasks.csv')
  }

  if (loading) return <div className="text-gray-400 py-8">Loading...</div>

  const TableHeader = ({ forDone = false }: { forDone?: boolean }) => (
    <thead>
      <tr className="border-b-2 border-gray-200">
        {/* Bulk-select header checkbox (only on todo table) */}
        <th className="w-8 px-2 py-2.5">
          {!forDone && (
            <input
              type="checkbox"
              checked={allTodoSelected}
              ref={el => { if (el) el.indeterminate = someTodoSelected && !allTodoSelected }}
              onChange={e => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              title="Select all"
            />
          )}
        </th>
        <th className="w-10 px-3 py-2.5" />
        <SortTh label="Task" col="title" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider" />
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
        <SortTh label="Assignee" col="assigned_to" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider w-36" />
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">State</th>
        <SortTh label="Due Date" col="due_date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider w-36" />
        <th className="w-16 px-3 py-2.5" />
      </tr>
    </thead>
  )

  return (
    <div className="w-full">
      {/* Progress bar */}
      {items.length > 0 && (
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-6">
          <div className="flex-1">
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span>{done.length} of {items.length} tasks complete</span>
              <span className="font-semibold text-blue-600">{pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {(overdueCount > 0 || dueSoonCount > 0) && (
            <div className="flex gap-2 flex-shrink-0">
              {overdueCount > 0 && (
                <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 font-medium">
                  ⚠ {overdueCount} overdue
                </span>
              )}
              {dueSoonCount > 0 && (
                <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5 font-medium">
                  🕐 {dueSoonCount} due this week
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add new task form */}
      <form onSubmit={addItem} className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-start gap-0">
          <div className="flex-1 grid grid-cols-2 gap-0 divide-x divide-gray-100">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Add a task..."
              className="px-4 py-2.5 text-sm focus:outline-none focus:bg-blue-50/40 border-0"
            />
            {showAddDetails ? (
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="px-4 py-2.5 text-sm focus:outline-none focus:bg-blue-50/40 border-0"
              />
            ) : (
              <div className="px-4 py-2.5 text-sm text-gray-300 italic">Description</div>
            )}
          </div>
          <div className="flex items-center border-l border-gray-100">
            <button
              type="button"
              onClick={() => setShowAddDetails(!showAddDetails)}
              className={`px-3 py-2.5 text-sm border-r border-gray-100 transition-colors ${showAddDetails ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
              title="Add assignee / due date"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={adding || !newTitle.trim()}
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {showAddDetails && (
          <div className="grid grid-cols-2 gap-3 px-4 pb-3 pt-2 border-t border-gray-100 bg-gray-50/60">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assign to</label>
              <select
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Due date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        )}
      </form>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No tasks yet. Add one above or use AI Setup.</p>
        </div>
      )}

      {/* Completed table (collapsible, shown at top) */}
      {done.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDone(!showDone)}
            className="w-full px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2 hover:bg-gray-100/60 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showDone ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</span>
            <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 font-medium">{done.length}</span>
          </button>
          {showDone && (
            <div className="overflow-x-auto">
              <table className="w-full opacity-70">
                <TableHeader forDone={true} />
                <tbody>
                  {done.map(item => (
                    <TaskRow
                      key={item.id}
                      item={item}
                      eventId={eventId}
                      teamMembers={teamMembers}
                      onRefresh={fetchItems}
                      onDeleted={handleTaskDeleted}
                      selected={selectedIds.has(item.id)}
                      onSelectChange={handleSelectOne}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Undo Toast */}
      {undoTask && (
        <UndoToast
          message="Task deleted"
          onUndo={undoDelete}
          onDismiss={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoTask(null) }}
        />
      )}

      {/* To Do table */}
      {todo.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">To Do</span>
            <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 font-medium">{todo.length}</span>
            <span className="mr-auto text-xs text-gray-300">Click any cell to edit · changes save automatically</span>
            {items.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export CSV
              </button>
            )}
          </div>
          <div className="overflow-x-auto relative">
            <table className="w-full">
              <TableHeader forDone={false} />
              <tbody>
                {todo.map(item => (
                  <TaskRow
                    key={item.id}
                    item={item}
                    eventId={eventId}
                    teamMembers={teamMembers}
                    onRefresh={fetchItems}
                    onDeleted={handleTaskDeleted}
                    selected={selectedIds.has(item.id)}
                    onSelectChange={handleSelectOne}
                  />
                ))}
              </tbody>
            </table>

            {/* Floating bulk action bar */}
            {selectedCount > 0 && (
              <div className="sticky bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-2.5 bg-white border-t border-blue-200 shadow-md">
                <span className="text-sm text-gray-700 font-medium">{selectedCount} selected</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleBulkMarkComplete}
                    disabled={bulkLoading}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {bulkLoading && (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    Mark Complete
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    disabled={bulkLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
