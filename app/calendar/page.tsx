'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Event {
  id: number
  name: string
  type: string
  status: string
  start_date: string
  end_date: string
  location: string
}

type ViewMode = 'week' | 'month' | 'year'

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-yellow-400',
  pending_approval: 'bg-orange-400',
  active: 'bg-green-500',
  complete: 'bg-gray-400',
  cancelled: 'bg-red-400',
}

const STATUS_TEXT: Record<string, string> = {
  planning: 'text-yellow-800 bg-yellow-100 border-yellow-200',
  pending_approval: 'text-orange-800 bg-orange-100 border-orange-200',
  active: 'text-green-800 bg-green-100 border-green-200',
  complete: 'text-gray-600 bg-gray-100 border-gray-200',
  cancelled: 'text-red-800 bg-red-100 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  planning: 'Planning',
  pending_approval: 'Pending Approval',
  active: 'Active',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function parseDate(s: string) { return s ? new Date(s + 'T00:00:00') : null }

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [view, setView] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(setEvents)
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // ── Navigation ──────────────────────────────────────────────────
  const prev = () => {
    const d = new Date(currentDate)
    if (view === 'week') d.setDate(d.getDate() - 7)
    else if (view === 'month') d.setMonth(d.getMonth() - 1)
    else d.setFullYear(d.getFullYear() - 1)
    setCurrentDate(d)
  }
  const next = () => {
    const d = new Date(currentDate)
    if (view === 'week') d.setDate(d.getDate() + 7)
    else if (view === 'month') d.setMonth(d.getMonth() + 1)
    else d.setFullYear(d.getFullYear() + 1)
    setCurrentDate(d)
  }
  const goToday = () => setCurrentDate(new Date())

  const title = view === 'year'
    ? String(year)
    : view === 'month'
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const start = getWeekStart(currentDate)
        const end = new Date(start); end.setDate(end.getDate() + 6)
        return `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
      })()

  // ── Helper: events on a given date ──────────────────────────────
  function eventsOnDate(d: Date) {
    return events.filter(e => {
      const s = parseDate(e.start_date), en = parseDate(e.end_date || e.start_date)
      if (!s) return false
      const dt = new Date(d); dt.setHours(0,0,0,0)
      s.setHours(0,0,0,0); en?.setHours(0,0,0,0)
      return dt >= s && dt <= (en || s)
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Events timeline overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['week','month','year'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${view===v ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
          {/* Nav */}
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={goToday} className="px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Today</button>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 min-w-[200px] text-center">{title}</h2>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {view === 'week' && <WeekView currentDate={currentDate} eventsOnDate={eventsOnDate} onNewEvent={d => router.push(`/events/new?date=${d}`)} />}
      {view === 'month' && <MonthView year={year} month={month} eventsOnDate={eventsOnDate} onNewEvent={d => router.push(`/events/new?date=${d}`)} />}
      {view === 'year' && <YearView year={year} events={events} onDrillDown={(y, m) => { setCurrentDate(new Date(y, m, 1)); setView('month') }} />}
    </div>
  )
}

function getWeekStart(d: Date) {
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  return start
}

function WeekView({ currentDate, eventsOnDate, onNewEvent }: { currentDate: Date; eventsOnDate: (d: Date) => Event[]; onNewEvent: (date: string) => void }) {
  const start = getWeekStart(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const today = new Date(); today.setHours(0,0,0,0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {days.map(d => {
          const isToday = d.toDateString() === today.toDateString()
          return (
            <div key={d.toISOString()} className={`p-3 text-center border-r border-gray-100 last:border-0 ${isToday ? 'bg-blue-50' : ''}`}>
              <div className="text-xs text-gray-400 uppercase font-medium">{DAYS[d.getDay()]}</div>
              <div className={`text-lg font-bold mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : 'text-gray-700'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map(d => {
          const dayEvents = eventsOnDate(d)
          const isToday = d.toDateString() === today.toDateString()
          const dateStr = d.toISOString().slice(0, 10)
          return (
            <div key={d.toISOString()} className={`group/day p-2 border-r border-gray-50 last:border-0 space-y-1 ${isToday ? 'bg-blue-50/40' : ''}`}>
              {dayEvents.map(e => {
                const isMultiDay = e.end_date && e.end_date !== e.start_date
                const isStartDay = e.start_date === dateStr
                const isContinuation = isMultiDay && !isStartDay
                return (
                  <Link key={e.id} href={`/events/${e.id}`}
                    className={`block text-xs px-2 py-1 rounded border font-medium truncate hover:opacity-80 transition-opacity ${STATUS_TEXT[e.status] || 'text-gray-700 bg-gray-100 border-gray-200'} ${isContinuation ? 'opacity-75' : ''}`}>
                    {isContinuation ? '↠ ' : ''}{e.name}{isMultiDay && isStartDay ? ' →' : ''}
                  </Link>
                )
              })}
              <button
                onClick={() => onNewEvent(dateStr)}
                className="opacity-0 group-hover/day:opacity-100 w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-blue-500 py-1 transition-all"
                title="New event"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({ year, month, eventsOnDate, onNewEvent }: { year: number; month: number; eventsOnDate: (d: Date) => Event[]; onNewEvent: (date: string) => void }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)
  const today = new Date(); today.setHours(0,0,0,0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS.map(d => (
          <div key={d} className="p-3 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="border-t border-r border-gray-50 min-h-[120px] bg-gray-50/50" />
          const d = new Date(year, month, day)
          const dayEvents = eventsOnDate(d)
          const isToday = d.toDateString() === today.toDateString()
          const dateStr = d.toISOString().slice(0, 10)
          return (
            <div key={day} className={`group/day border-t border-r border-gray-100 min-h-[120px] p-2 ${isToday ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  {day}
                </div>
                <button
                  onClick={() => onNewEvent(dateStr)}
                  className="opacity-0 group-hover/day:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                  title="New event"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(e => {
                  const isMultiDay = e.end_date && e.end_date !== e.start_date
                  const cellDateStr = new Date(year, month, day).toISOString().slice(0, 10)
                  const isStartDay = e.start_date === cellDateStr
                  const isContinuation = isMultiDay && !isStartDay
                  return (
                    <Link key={e.id} href={`/events/${e.id}`}
                      className={`block text-xs px-1.5 py-0.5 rounded font-medium truncate hover:opacity-80 ${STATUS_TEXT[e.status] || 'text-gray-700 bg-gray-100'} ${isContinuation ? 'opacity-75' : ''}`}>
                      {isContinuation ? '↠ ' : ''}{e.name}{isMultiDay && isStartDay ? ' →' : ''}
                    </Link>
                  )
                })}
                {dayEvents.length > 3 && <div className="text-xs text-gray-400 pl-1">+{dayEvents.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function YearView({ year, events, onDrillDown }: { year: number; events: Event[]; onDrillDown: (year: number, month: number) => void }) {
  function eventsInMonth(m: number) {
    return events.filter(e => {
      const s = parseDate(e.start_date), en = parseDate(e.end_date || e.start_date)
      if (!s) return false
      const mStart = new Date(year, m, 1), mEnd = new Date(year, m + 1, 0)
      return s <= mEnd && (en || s) >= mStart
    })
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {MONTHS.map((name, m) => {
        const monthEvents = eventsInMonth(m)
        const firstDay = new Date(year, m, 1).getDay()
        const daysInMonth = new Date(year, m + 1, 0).getDate()
        const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)
        while (cells.length % 7 !== 0) cells.push(null)
        const today = new Date()

        return (
          <div key={m} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-800 text-sm">{name}</span>
              {monthEvents.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{monthEvents.length} event{monthEvents.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="text-center text-xs text-gray-300 font-medium">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />
                  const d = new Date(year, m, day)
                  const hasEvent = events.some(e => {
                    const s = parseDate(e.start_date), en = parseDate(e.end_date || e.start_date)
                    if (!s) return false
                    const dt = new Date(d); dt.setHours(0,0,0,0)
                    s.setHours(0,0,0,0); en?.setHours(0,0,0,0)
                    return dt >= s && dt <= (en || s)
                  })
                  const eventOnDay = hasEvent ? events.find(e => {
                    const s = parseDate(e.start_date), en = parseDate(e.end_date || e.start_date)
                    if (!s) return false
                    const dt = new Date(d); dt.setHours(0,0,0,0)
                    s.setHours(0,0,0,0); en?.setHours(0,0,0,0)
                    return dt >= s && dt <= (en || s)
                  }) : null
                  const isToday = d.toDateString() === today.toDateString()
                  const dotColor = eventOnDay ? STATUS_COLORS[eventOnDay.status] || 'bg-blue-400' : ''
                  return (
                    <div key={day}
                      title={eventOnDay ? `${eventOnDay.name} (${STATUS_LABEL[eventOnDay.status] || eventOnDay.status})` : undefined}
                      onClick={() => onDrillDown(year, m)}
                      className="group/yday flex flex-col items-center gap-0.5 cursor-pointer">
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-colors
                        ${isToday ? 'bg-blue-500 text-white' : hasEvent ? 'text-gray-900 font-bold group-hover/yday:bg-blue-100' : 'text-gray-500 group-hover/yday:bg-blue-100 group-hover/yday:text-blue-600'}`}>
                        {day}
                      </div>
                      {hasEvent && <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
                      {!hasEvent && <div className="w-1.5 h-1.5" />}
                    </div>
                  )
                })}
              </div>
              {monthEvents.length > 0 && (
                <div className="mt-2 space-y-1">
                  {monthEvents.map(e => (
                    <Link key={e.id} href={`/events/${e.id}`}
                      className={`block text-xs px-2 py-0.5 rounded font-medium truncate hover:opacity-80 ${STATUS_TEXT[e.status] || 'text-gray-700 bg-gray-100'}`}>
                      {e.start_date && new Date(e.start_date + 'T00:00:00').getDate()} — {e.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
