'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface NotificationItem {
  id: number
  title: string
  due_date: string | null
  assigned_to: string | null
  event_id: number
  event_name: string
}

interface PostEventItem {
  id: number
  name: string
  end_date: string
}

interface NotificationsData {
  overdue: NotificationItem[]
  due_soon: NotificationItem[]
  upcoming: NotificationItem[]
  no_due_date: NotificationItem[]
  post_event_events: PostEventItem[]
  my_name: string | null
  total: number
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 text-white text-sm font-medium shadow-lg transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      {message}
    </div>
  )
}

function UndoToast({ item, onUndo, onDismiss }: { item: NotificationItem; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm shadow-2xl border border-gray-700">
      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-medium truncate max-w-[220px]">&ldquo;{item.title}&rdquo; marked complete</span>
      <button
        onClick={onUndo}
        className="ml-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-colors flex-shrink-0"
      >
        Undo
      </button>
      <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function DueBadge({ due_date }: { due_date: string }) {
  const days = daysUntil(due_date)
  if (days < 0) {
    return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>
  }
  if (days === 0) {
    return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Due today</span>
  }
  if (days <= 3) {
    return <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Due in {days}d</span>
  }
  if (days <= 7) {
    return <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">Due in {days}d</span>
  }
  return <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Due in {days}d</span>
}

function urgencyOf(item: NotificationItem): 'overdue' | 'soon' | 'upcoming' {
  if (!item.due_date) return 'upcoming'
  const days = daysUntil(item.due_date)
  if (days < 0) return 'overdue'
  if (days <= 7) return 'soon'
  return 'upcoming'
}

function TaskRow({ item, urgency, onComplete }: { item: NotificationItem; urgency: 'overdue' | 'soon' | 'upcoming'; onComplete: (item: NotificationItem) => void }) {
  const borderColor = urgency === 'overdue' ? 'border-red-200 bg-red-50/30' :
    urgency === 'soon' ? 'border-orange-200 bg-orange-50/20' : 'border-gray-200 bg-white'

  return (
    <li className={`flex items-center gap-4 p-4 rounded-lg border ${borderColor}`}>
      <button
        onClick={() => onComplete(item)}
        title="Mark complete"
        className="w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center flex-shrink-0 transition-colors"
      >
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">{item.title}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <Link
            href={`/events/${item.event_id}?tab=planning`}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {item.event_name}
          </Link>
          {item.assigned_to && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {item.assigned_to}
            </span>
          )}
          {item.due_date && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(item.due_date)}
            </span>
          )}
        </div>
      </div>
      {item.due_date && <DueBadge due_date={item.due_date} />}
    </li>
  )
}

function PostEventRow({ item, onDismiss }: { item: PostEventItem; onDismiss: (id: number) => void }) {
  const [dismissing, setDismissing] = useState(false)
  const daysAgo = Math.round((Date.now() - new Date(item.end_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))

  const markDone = async () => {
    setDismissing(true)
    await fetch(`/api/events/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_event_completed: 1 }),
    })
    onDismiss(item.id)
  }

  return (
    <li className="flex items-center gap-4 p-4 rounded-lg border border-violet-200 bg-violet-50/40">
      <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Concluded {daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`} · {formatDate(item.end_date)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/events/${item.id}?upload=1`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload info
        </Link>
        <button
          onClick={markDone}
          disabled={dismissing}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg bg-white transition-colors disabled:opacity-50"
        >
          {dismissing ? 'Saving…' : 'Mark done'}
        </button>
      </div>
    </li>
  )
}

const EVENT_BORDER_COLORS = [
  'border-l-blue-400', 'border-l-violet-400', 'border-l-emerald-400',
  'border-l-orange-400', 'border-l-pink-400', 'border-l-teal-400',
  'border-l-yellow-400', 'border-l-indigo-400',
]
const EVENT_TITLE_COLORS = [
  'text-blue-600', 'text-violet-600', 'text-emerald-600',
  'text-orange-600', 'text-pink-600', 'text-teal-600',
  'text-yellow-600', 'text-indigo-600',
]

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'urgency' | 'event'>('urgency')
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' })
  const [undoTask, setUndoTask] = useState<NotificationItem | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  const showToast = (message: string) => {
    setToast({ visible: true, message })
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500)
  }

  const commitComplete = (item: NotificationItem) => {
    fetch(`/api/events/${item.event_id}/planning/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.title, description: null, done: 1, status: 'complete', assigned_to: item.assigned_to, due_date: item.due_date }),
    }).catch(() => {})
  }

  const markComplete = (item: NotificationItem) => {
    // Optimistically remove from UI
    setData(prev => prev ? {
      ...prev,
      overdue: prev.overdue.filter(i => i.id !== item.id),
      due_soon: prev.due_soon.filter(i => i.id !== item.id),
      upcoming: prev.upcoming.filter(i => i.id !== item.id),
      no_due_date: prev.no_due_date.filter(i => i.id !== item.id),
      total: Math.max(0, prev.total - 1),
    } : prev)
    // Cancel any previous undo (commit that task now)
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      if (undoTask) commitComplete(undoTask)
    }
    setUndoTask(item)
    undoTimerRef.current = setTimeout(() => {
      commitComplete(item)
      setUndoTask(null)
    }, 4000)
  }

  const handleUndo = () => {
    if (!undoTask) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    // Restore item to the correct bucket based on due date
    setData(prev => {
      if (!prev) return prev
      const days = undoTask.due_date ? daysUntil(undoTask.due_date) : null
      if (days === null) return { ...prev, no_due_date: [undoTask, ...prev.no_due_date], total: prev.total + 1 }
      if (days < 0)      return { ...prev, overdue:     [undoTask, ...prev.overdue],     total: prev.total + 1 }
      if (days <= 7)     return { ...prev, due_soon:    [undoTask, ...prev.due_soon],    total: prev.total + 1 }
      return { ...prev, upcoming: [undoTask, ...prev.upcoming], total: prev.total + 1 }
    })
    setUndoTask(null)
  }

  const dismissUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    if (undoTask) commitComplete(undoTask)
    setUndoTask(null)
  }

  const dismissPostEvent = (id: number) => {
    setData(prev => prev ? {
      ...prev,
      post_event_events: prev.post_event_events.filter(e => e.id !== id),
      total: Math.max(0, prev.total - 1),
    } : prev)
  }

  if (loading) {
    return <div className="p-8 text-gray-400">Loading tasks...</div>
  }

  if (!data) return null

  const myName = data.my_name
  const meExists = myName !== null

  const allItems = [...data.overdue, ...data.due_soon, ...data.upcoming, ...data.no_due_date]
  const hasAnything = allItems.length > 0

  // Build event groups for the event view
  const eventGroupMap = new Map<number, { event_id: number; event_name: string; items: NotificationItem[] }>()
  for (const item of allItems) {
    if (!eventGroupMap.has(item.event_id)) {
      eventGroupMap.set(item.event_id, { event_id: item.event_id, event_name: item.event_name, items: [] })
    }
    eventGroupMap.get(item.event_id)!.items.push(item)
  }
  const eventGroups = Array.from(eventGroupMap.values()).sort((a, b) =>
    a.event_name.localeCompare(b.event_name)
  )

  return (
    <div className="p-8 max-w-3xl">
      <Toast visible={toast.visible} message={toast.message} />
      {undoTask && <UndoToast item={undoTask} onUndo={handleUndo} onDismiss={dismissUndo} />}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500">
            {myName ? <>Showing tasks assigned to <strong>{myName}</strong></> : 'Your assigned planning tasks'}
          </p>
        </div>
        {data.total > 0 && (
          <span className="ml-auto text-xs font-bold text-white bg-red-500 px-2.5 py-1 rounded-full">
            {data.total} need attention
          </span>
        )}
      </div>

      {/* Post-event wrap-up section */}
      {data.post_event_events?.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-700">Post-Event Wrap-up Needed</h2>
            <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full">{data.post_event_events.length}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            These events have concluded. Upload your post-event info — vendor contacts, actuals, notes — so everything stays up to date. You can import documents or paste content directly via AI.
          </p>
          <ul className="space-y-2">
            {data.post_event_events.map(e => (
              <PostEventRow key={e.id} item={e} onDismiss={dismissPostEvent} />
            ))}
          </ul>
          <div className="border-t border-gray-200 mt-5 mb-1" />
        </div>
      )}

      {hasAnything && (
        <div className="flex items-center gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setView('urgency')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'urgency' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            By Due Date
          </button>
          <button
            onClick={() => setView('event')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'event' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            By Event
          </button>
        </div>
      )}

      {!hasAnything && !meExists && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 mb-6">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-800">
            To see your tasks here, go to the{' '}
            <Link href="/team" className="font-semibold underline hover:text-amber-900">Team</Link>
            {' '}page and mark yourself as <strong>Me</strong>. If you haven&apos;t added yourself yet, add your name there first — it only takes a moment.
          </p>
        </div>
      )}

      {!hasAnything && meExists && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">You&apos;re all caught up.</p>
          <p className="text-xs mt-1">No tasks assigned to <strong>{myName}</strong> with upcoming due dates. Assign tasks in <Link href="/planning" className="text-blue-500 hover:underline font-medium">All Tasks</Link> or within any event&apos;s Planning tab.</p>
        </div>
      )}

      {/* By Due Date view */}
      {view === 'urgency' && (
        <>
          {data.overdue.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide">Overdue ({data.overdue.length})</h2>
              </div>
              <ul className="space-y-2">
                {data.overdue.map(item => <TaskRow key={item.id} item={item} urgency="overdue" onComplete={markComplete} />)}
              </ul>
            </section>
          )}

          {data.due_soon.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-sm font-bold text-orange-700 uppercase tracking-wide">Due within 7 days ({data.due_soon.length})</h2>
              </div>
              <ul className="space-y-2">
                {data.due_soon.map(item => <TaskRow key={item.id} item={item} urgency="soon" onComplete={markComplete} />)}
              </ul>
            </section>
          )}

          {data.upcoming.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Upcoming — next 90 days ({data.upcoming.length})</h2>
              </div>
              <ul className="space-y-2">
                {data.upcoming.map(item => <TaskRow key={item.id} item={item} urgency="upcoming" onComplete={markComplete} />)}
              </ul>
            </section>
          )}

          {data.no_due_date.length > 0 && (
            <section>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 border-t border-dashed border-gray-300" />
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  No due date
                </span>
                <div className="flex-1 border-t border-dashed border-gray-300" />
              </div>
              <ul className="space-y-2">
                {data.no_due_date.map(item => <TaskRow key={item.id} item={item} urgency="upcoming" onComplete={markComplete} />)}
              </ul>
            </section>
          )}
        </>
      )}

      {/* By Event view */}
      {view === 'event' && (
        <div className="space-y-6">
          {eventGroups.map((group, gi) => {
            const borderCls = EVENT_BORDER_COLORS[gi % EVENT_BORDER_COLORS.length]
            const titleCls = EVENT_TITLE_COLORS[gi % EVENT_TITLE_COLORS.length]
            const overdueCount = group.items.filter(i => i.due_date && daysUntil(i.due_date) < 0).length

            return (
              <div key={group.event_id} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderCls} shadow-sm overflow-hidden`}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <Link href={`/events/${group.event_id}?tab=planning`} className={`font-bold text-sm ${titleCls} hover:underline`}>
                    {group.event_name}
                  </Link>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 font-medium">
                    {group.items.length} task{group.items.length !== 1 ? 's' : ''}
                  </span>
                  {overdueCount > 0 && (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      {overdueCount} overdue
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-gray-50 px-3 py-2 space-y-1.5">
                  {group.items
                    .sort((a, b) => {
                      if (!a.due_date && !b.due_date) return 0
                      if (!a.due_date) return 1
                      if (!b.due_date) return -1
                      return a.due_date.localeCompare(b.due_date)
                    })
                    .map(item => (
                      <TaskRow key={item.id} item={item} urgency={urgencyOf(item)} onComplete={markComplete} />
                    ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
