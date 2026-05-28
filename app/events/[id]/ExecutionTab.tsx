'use client'

import { useState, useEffect } from 'react'
import { SortTh, useSortState } from '@/app/components/SortTh'

// ---- Types ----
interface Task {
  id: number
  title: string
  description: string | null
  category: string
  assigned_to: string | null
  due_date: string | null
  status: string
  priority: string
}

interface ROS {
  id: number
  event_day: number
  start_time: string
  end_time: string | null
  activity: string
  owner: string | null
  location: string | null
  notes: string | null
  status: string
}

interface Staff {
  id: number
  name: string
  role: string
  email: string | null
  phone: string | null
  arrival_date: string | null
  departure_date: string | null
  hotel: string | null
  notes: string | null
}

// ---- Helpers ----
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
}

const TASK_STATUS_NEXT: Record<string, string> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
  blocked: 'todo',
}

const ROS_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-800',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ExecutionTab({ eventId, initialNotes }: { eventId: string; initialNotes?: string | null }) {
  const [tasksOpen, setTasksOpen] = useState(true)
  const [rosOpen, setROSOpen] = useState(true)
  const [staffOpen, setStaffOpen] = useState(true)

  return (
    <div className="space-y-4">
      <CollapsibleSection title="Tasks" open={tasksOpen} onToggle={() => setTasksOpen(o => !o)}>
        <TasksSection eventId={eventId} />
      </CollapsibleSection>
      <CollapsibleSection title="Run of Show" open={rosOpen} onToggle={() => setROSOpen(o => !o)}>
        <ROSSection eventId={eventId} />
      </CollapsibleSection>
      <CollapsibleSection title="Staffing" open={staffOpen} onToggle={() => setStaffOpen(o => !o)}>
        <StaffSection eventId={eventId} />
      </CollapsibleSection>
      <EventDayNotesSection eventId={eventId} initialNotes={initialNotes} />
    </div>
  )
}

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// ---- Tasks Section ----
const TASK_EMPTY = { title: '', description: '', category: 'general', assigned_to: '', due_date: '', status: 'todo', priority: 'medium' }

function TasksSection({ eventId }: { eventId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState({ ...TASK_EMPTY })
  const [saving, setSaving] = useState(false)
  const { sortKey: tKey, sortDir: tDir, toggle: tToggle } = useSortState<'title' | 'category' | 'assigned_to' | 'due_date' | 'priority' | 'status'>('due_date')

  const fetch_ = () => {
    fetch(`/api/events/${eventId}/tasks`)
      .then(r => r.json())
      .then(d => { setTasks(d); setLoading(false) })
  }
  useEffect(() => { fetch_() }, [eventId])

  const openAdd = () => { setEditingTask(null); setForm({ ...TASK_EMPTY }); setShowModal(true) }
  const openEdit = (t: Task) => { setEditingTask(t); setForm({ title: t.title, description: t.description || '', category: t.category, assigned_to: t.assigned_to || '', due_date: t.due_date || '', status: t.status, priority: t.priority }); setShowModal(true) }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    if (editingTask) {
      await fetch(`/api/events/${eventId}/tasks/${editingTask.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch(`/api/events/${eventId}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setSaving(false); setShowModal(false); fetch_()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/events/${eventId}/tasks/${id}`, { method: 'DELETE' })
    fetch_()
  }

  const toggleStatus = async (task: Task) => {
    const next = TASK_STATUS_NEXT[task.status] || 'todo'
    await fetch(`/api/events/${eventId}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: next }),
    })
    fetch_()
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const TASK_STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, blocked: 2, done: 3 }
  const sortedTasks = [...tasks].sort((a, b) => {
    let cmp = 0
    if (tKey === 'title') cmp = a.title.localeCompare(b.title)
    else if (tKey === 'category') cmp = a.category.localeCompare(b.category)
    else if (tKey === 'assigned_to') cmp = (a.assigned_to || '').localeCompare(b.assigned_to || '')
    else if (tKey === 'due_date') cmp = (a.due_date || '9999').localeCompare(b.due_date || '9999')
    else if (tKey === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    else if (tKey === 'status') cmp = (TASK_STATUS_ORDER[a.status] ?? 9) - (TASK_STATUS_ORDER[b.status] ?? 9)
    return tDir === 'asc' ? cmp : -cmp
  })
  const grouped: Record<string, Task[]> = { todo: [], in_progress: [], done: [], blocked: [] }
  for (const t of tasks) { if (grouped[t.status]) grouped[t.status].push(t) }

  return (
    <div>
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex gap-3 text-sm text-gray-500">
          {Object.entries({ todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' }).map(([k, l]) => (
            <span key={k}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_COLORS[k]}`}>{l}</span> {grouped[k].length}</span>
          ))}
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Task
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <SortTh label="Title" col="title" sortKey={tKey} sortDir={tDir} onSort={tToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Category" col="category" sortKey={tKey} sortDir={tDir} onSort={tToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Assigned To" col="assigned_to" sortKey={tKey} sortDir={tDir} onSort={tToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Due Date" col="due_date" sortKey={tKey} sortDir={tDir} onSort={tToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Priority" col="priority" sortKey={tKey} sortDir={tDir} onSort={tToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Status" col="status" sortKey={tKey} sortDir={tDir} onSort={tToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-400">Loading...</td></tr>
          ) : tasks.length === 0 ? (
            <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-400">No tasks yet.</td></tr>
          ) : (
            sortedTasks.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-800">{t.title}</td>
                <td className="px-6 py-3 text-sm text-gray-500 capitalize">{t.category}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{t.assigned_to || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{fmt(t.due_date)}</td>
                <td className="px-6 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-600'}`}>{t.priority}</span>
                </td>
                <td className="px-6 py-3">
                  <button onClick={() => toggleStatus(t)} className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize cursor-pointer hover:opacity-80 ${TASK_STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700'}`}>
                    {t.status.replace('_', ' ')}
                  </button>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openEdit(t)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                    <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">Del</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingTask ? 'Edit Task' : 'Add Task'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['logistics', 'vendor', 'staffing', 'marketing', 'admin', 'general'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['todo', 'in_progress', 'done', 'blocked'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={save} disabled={saving || !form.title.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Saving...' : editingTask ? 'Save Changes' : 'Add Task'}
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

// ---- Run of Show Section ----
const ROS_EMPTY = { event_day: '1', start_time: '', end_time: '', activity: '', owner: '', location: '', notes: '', status: 'planned' }

function ROSSection({ eventId }: { eventId: string }) {
  const [ros, setRos] = useState<ROS[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingROS, setEditingROS] = useState<ROS | null>(null)
  const [form, setForm] = useState({ ...ROS_EMPTY })
  const [saving, setSaving] = useState(false)

  const { sortKey: rKey, sortDir: rDir, toggle: rToggle } = useSortState<'start_time' | 'end_time' | 'activity' | 'owner' | 'location' | 'status'>('start_time')

  const fetch_ = () => {
    fetch(`/api/events/${eventId}/ros`)
      .then(r => r.json())
      .then(d => { setRos(d); setLoading(false) })
  }
  useEffect(() => { fetch_() }, [eventId])

  const openAdd = () => { setEditingROS(null); setForm({ ...ROS_EMPTY }); setShowModal(true) }
  const openEdit = (r: ROS) => { setEditingROS(r); setForm({ event_day: r.event_day.toString(), start_time: r.start_time, end_time: r.end_time || '', activity: r.activity, owner: r.owner || '', location: r.location || '', notes: r.notes || '', status: r.status }); setShowModal(true) }

  const save = async () => {
    if (!form.start_time || !form.activity) return
    setSaving(true)
    const payload = { ...form, event_day: parseInt(form.event_day) || 1 }
    if (editingROS) {
      await fetch(`/api/events/${eventId}/ros/${editingROS.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch(`/api/events/${eventId}/ros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false); setShowModal(false); fetch_()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/events/${eventId}/ros/${id}`, { method: 'DELETE' })
    fetch_()
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function sortRos(list: ROS[]) {
    return [...list].sort((a, b) => {
      let cmp = 0
      if (rKey === 'start_time') cmp = a.start_time.localeCompare(b.start_time)
      else if (rKey === 'end_time') cmp = (a.end_time || '').localeCompare(b.end_time || '')
      else if (rKey === 'activity') cmp = a.activity.localeCompare(b.activity)
      else if (rKey === 'owner') cmp = (a.owner || '').localeCompare(b.owner || '')
      else if (rKey === 'location') cmp = (a.location || '').localeCompare(b.location || '')
      else if (rKey === 'status') cmp = a.status.localeCompare(b.status)
      return rDir === 'asc' ? cmp : -cmp
    })
  }

  const days = Array.from(new Set(ros.map(r => r.event_day))).sort()

  return (
    <div>
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Entry
        </button>
      </div>
      {loading ? (
        <div className="p-6 text-center text-gray-400">Loading...</div>
      ) : ros.length === 0 ? (
        <div className="p-6 text-center text-gray-400">No run of show entries yet.</div>
      ) : (
        <div>
          {days.map(day => (
            <div key={day}>
              <div className="bg-gray-50 px-6 py-2 border-b border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Day {day}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <SortTh label="Time" col="start_time" sortKey={rKey} sortDir={rDir} onSort={rToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                    <SortTh label="End" col="end_time" sortKey={rKey} sortDir={rDir} onSort={rToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                    <SortTh label="Activity" col="activity" sortKey={rKey} sortDir={rDir} onSort={rToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                    <SortTh label="Owner" col="owner" sortKey={rKey} sortDir={rDir} onSort={rToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                    <SortTh label="Location" col="location" sortKey={rKey} sortDir={rDir} onSort={rToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                    <SortTh label="Status" col="status" sortKey={rKey} sortDir={rDir} onSort={rToggle} align="left" className="py-2 text-xs font-medium uppercase" />
                    <th className="text-right px-6 py-2 text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortRos(ros.filter(r => r.event_day === day)).map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-mono font-medium text-gray-800">{r.start_time}</td>
                      <td className="px-6 py-3 text-sm font-mono text-gray-500">{r.end_time || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-800 font-medium">{r.activity}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{r.owner || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{r.location || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROS_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                          <button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingROS ? 'Edit Entry' : 'Add Run of Show Entry'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                  <input type="number" min="1" value={form.event_day} onChange={e => set('event_day', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                  <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity *</label>
                <input value={form.activity} onChange={e => set('activity', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                  <input value={form.owner} onChange={e => set('owner', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="planned">Planned</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={save} disabled={saving || !form.start_time || !form.activity} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Saving...' : editingROS ? 'Save Changes' : 'Add Entry'}
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

// ---- Staff Section ----
const STAFF_EMPTY = { name: '', role: '', email: '', phone: '', arrival_date: '', departure_date: '', hotel: '', notes: '' }

function StaffSection({ eventId }: { eventId: string }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [form, setForm] = useState({ ...STAFF_EMPTY })
  const [saving, setSaving] = useState(false)

  const { sortKey: sKey, sortDir: sDir, toggle: sToggle } = useSortState<'name' | 'role' | 'email' | 'arrival_date' | 'departure_date'>('name')

  const fetch_ = () => {
    fetch(`/api/events/${eventId}/staff`)
      .then(r => r.json())
      .then(d => { setStaff(d); setLoading(false) })
  }
  useEffect(() => { fetch_() }, [eventId])

  const openAdd = () => { setEditingStaff(null); setForm({ ...STAFF_EMPTY }); setShowModal(true) }
  const openEdit = (s: Staff) => { setEditingStaff(s); setForm({ name: s.name, role: s.role, email: s.email || '', phone: s.phone || '', arrival_date: s.arrival_date || '', departure_date: s.departure_date || '', hotel: s.hotel || '', notes: s.notes || '' }); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim() || !form.role.trim()) return
    setSaving(true)
    if (editingStaff) {
      await fetch(`/api/events/${eventId}/staff/${editingStaff.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch(`/api/events/${eventId}/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setSaving(false); setShowModal(false); fetch_()
  }

  const remove = async (id: number, name: string) => {
    if (!confirm(`Remove ${name} from staffing?`)) return
    await fetch(`/api/events/${eventId}/staff/${id}`, { method: 'DELETE' })
    fetch_()
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Staff
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <SortTh label="Name" col="name" sortKey={sKey} sortDir={sDir} onSort={sToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Role" col="role" sortKey={sKey} sortDir={sDir} onSort={sToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Email" col="email" sortKey={sKey} sortDir={sDir} onSort={sToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-400 uppercase">Phone</th>
            <SortTh label="Arrival" col="arrival_date" sortKey={sKey} sortDir={sDir} onSort={sToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <SortTh label="Departure" col="departure_date" sortKey={sKey} sortDir={sDir} onSort={sToggle} align="left" className="py-2.5 text-xs font-medium uppercase" />
            <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-400 uppercase">Hotel</th>
            <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr><td colSpan={8} className="px-6 py-6 text-center text-gray-400">Loading...</td></tr>
          ) : staff.length === 0 ? (
            <tr><td colSpan={8} className="px-6 py-6 text-center text-gray-400">No staff assigned yet.</td></tr>
          ) : (
            [...staff].sort((a, b) => {
              let cmp = 0
              if (sKey === 'name') cmp = a.name.localeCompare(b.name)
              else if (sKey === 'role') cmp = a.role.localeCompare(b.role)
              else if (sKey === 'email') cmp = (a.email || '').localeCompare(b.email || '')
              else if (sKey === 'arrival_date') cmp = (a.arrival_date || '9999').localeCompare(b.arrival_date || '9999')
              else if (sKey === 'departure_date') cmp = (a.departure_date || '9999').localeCompare(b.departure_date || '9999')
              return sDir === 'asc' ? cmp : -cmp
            }).map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-800">{s.name}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{s.role}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{s.email || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{s.phone || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{fmt(s.arrival_date)}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{fmt(s.departure_date)}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{s.hotel || '—'}</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                    <button onClick={() => remove(s.id, s.name)} className="text-red-400 hover:text-red-600 text-sm font-medium">Del</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <input value={form.role} onChange={e => set('role', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date</label>
                  <input type="date" value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                  <input type="date" value={form.departure_date} onChange={e => set('departure_date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hotel</label>
                <input value={form.hotel} onChange={e => set('hotel', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={save} disabled={saving || !form.name.trim() || !form.role.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Saving...' : editingStaff ? 'Save Changes' : 'Add Staff'}
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

// ---- Event Day Notes Section ----
function EventDayNotesSection({ eventId, initialNotes }: { eventId: string; initialNotes?: string | null }) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_notes: notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Event Day Notes</h2>
        <p className="text-sm text-gray-500 mt-0.5">Capture what worked, what didn&apos;t, and key lessons for future events</p>
      </div>
      <div className="p-6">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={6}
          placeholder="e.g. AV setup ran 30 min late — arrive earlier next time. Catering was excellent. Registration queue peaked at 9:15am — add a second check-in station for events over 300 people."
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-800 placeholder-gray-400"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save Notes'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </div>
    </div>
  )
}
