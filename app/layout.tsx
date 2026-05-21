'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import SetupPreferencesModal from '@/app/components/SetupPreferencesModal'

const DEFAULT_ORDER = ['dashboard', 'events', 'opportunities', 'vendors', 'outcomes', 'my_tasks', 'team', 'calendar']

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Events Management</title>
        <meta name="description" content="360° Corporate Events Management Platform" />
      </head>
      <body className="flex h-screen bg-gray-50 overflow-hidden">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  )
}

type NavChild = {
  id: string
  label: string
  href: string
  active: boolean
  iconPath: string
  activeColor?: 'blue' | 'amber' | 'red'
}

type NavItemDef = {
  id: string
  label: string
  description?: string
  href: string
  active: boolean
  iconPath: string
  children?: NavChild[]
}

function GripDots() {
  return (
    <svg className="w-3 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 8 14">
      <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="5.5" r="1.2" /><circle cx="6" cy="5.5" r="1.2" />
      <circle cx="2" cy="9" r="1.2" /><circle cx="6" cy="9" r="1.2" />
      <circle cx="2" cy="12.5" r="1.2" /><circle cx="6" cy="12.5" r="1.2" />
    </svg>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [notifCount, setNotifCount] = useState(0)
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const [navOrder, setNavOrder] = useState<string[]>([...DEFAULT_ORDER])
  const [showSettings, setShowSettings] = useState(false)
  const [newOppsCount, setNewOppsCount] = useState(0)

  // Hydration-safe: read localStorage only after mount, then overlay DB nav_order
  useEffect(() => {
    setLastSeenCount(parseInt(localStorage.getItem('tasksLastSeenCount') || '0', 10))

    // Apply localStorage as fast initial order
    const applyOrder = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as string[]
        const merged = parsed.filter((id: string) => DEFAULT_ORDER.includes(id))
        DEFAULT_ORDER.forEach(id => { if (!merged.includes(id)) merged.push(id) })
        setNavOrder(merged)
        return true
      } catch {
        return false
      }
    }

    const lsOrder = localStorage.getItem('navOrder')
    if (lsOrder) applyOrder(lsOrder)

    // DB is source of truth — override localStorage if present
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        if (s.nav_order) {
          const applied = applyOrder(s.nav_order)
          if (applied) localStorage.setItem('navOrder', s.nav_order)
        }
      })
      .catch(() => {})
  }, [])

  const dragIdRef = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/notifications')
        .then(r => r.json())
        .then(d => {
          const total = (d.overdue?.length ?? 0) + (d.due_soon?.length ?? 0) + (d.upcoming?.length ?? 0) + (d.post_event_events?.length ?? 0)
          setNotifCount(total)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  // Background opportunity scan — runs on every page load, respects configured frequency
  useEffect(() => {
    fetch('/api/opportunities/auto-scan')
      .then(r => r.json())
      .then(status => {
        if (!status.is_due) return
        const focusArea = status.next_focus || 'all'
        fetch('/api/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focus_area: focusArea, region: 'all' }),
        })
          .then(r => r.json())
          .then(data => {
            const added = data.added ?? 0
            if (added > 0) setNewOppsCount(added)
            fetch('/api/opportunities/auto-scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ added, focus_area: focusArea }),
            }).catch(() => {})
          })
          .catch(() => {})
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/notifications')) {
      setLastSeenCount(notifCount)
      localStorage.setItem('tasksLastSeenCount', String(notifCount))
    }
    if (pathname.startsWith('/opportunities')) {
      setNewOppsCount(0)
    }
  }, [pathname, notifCount])

  const hasNewTasks = notifCount > lastSeenCount
  const isOpportunitiesActive = pathname.startsWith('/opportunities')
  const currentTab = isOpportunitiesActive ? searchParams.get('tab') : null

  const navDefs = useMemo((): Record<string, NavItemDef> => ({
    dashboard: {
      id: 'dashboard', label: 'Dashboard', href: '/', active: pathname === '/',
      iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    events: {
      id: 'events', label: 'Events', href: '/events', active: pathname.startsWith('/events'),
      iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      children: [{
        id: 'planning', label: 'All Tasks', href: '/planning', active: pathname.startsWith('/planning'),
        iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        activeColor: 'blue' as const,
      }],
    },
    opportunities: {
      id: 'opportunities', label: 'Opportunities', href: '/opportunities',
      active: isOpportunitiesActive && currentTab !== 'under_review' && currentTab !== 'do_not_attend',
      iconPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347A3.99 3.99 0 0112 16a3.99 3.99 0 01-2.828-1.172l-.347-.347z',
      children: [
        {
          id: 'under_review', label: 'Under Review', href: '/opportunities?tab=under_review',
          active: currentTab === 'under_review', activeColor: 'amber',
          iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        },
        {
          id: 'do_not_attend', label: 'Do Not Attend', href: '/opportunities?tab=do_not_attend',
          active: currentTab === 'do_not_attend', activeColor: 'red',
          iconPath: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
        },
      ],
    },
    vendors: {
      id: 'vendors', label: 'Vendors', href: '/vendors', active: pathname.startsWith('/vendors'),
      iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    },
    outcomes: {
      id: 'outcomes', label: 'ROI & Outcomes', description: 'pipeline · revenue · leads', href: '/outcomes', active: pathname.startsWith('/outcomes'),
      iconPath: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    },
    my_tasks: {
      id: 'my_tasks', label: 'My Tasks', description: 'assigned to you · by deadline', href: '/notifications', active: pathname.startsWith('/notifications'),
      iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    team: {
      id: 'team', label: 'Team', href: '/team', active: pathname.startsWith('/team'),
      iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    calendar: {
      id: 'calendar', label: 'Calendar', href: '/calendar', active: pathname.startsWith('/calendar'),
      iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
  }), [pathname, isOpportunitiesActive, currentTab])

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragIdRef.current) setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) { setDragOverId(null); return }
    setNavOrder(prev => {
      const next = [...prev]
      const fromIdx = next.indexOf(sourceId)
      const toIdx = next.indexOf(targetId)
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, sourceId)
      const serialized = JSON.stringify(next)
      // Fast local cache
      localStorage.setItem('navOrder', serialized)
      // Persist to DB as source of truth
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nav_order: serialized }),
      }).catch(() => {})
      return next
    })
    dragIdRef.current = null
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    dragIdRef.current = null
    setDragOverId(null)
  }

  const renderNavItem = (item: NavItemDef) => {
    const activeClass = item.active
      ? 'bg-blue-500/20 text-blue-400'
      : 'text-gray-400 hover:bg-white/5 hover:text-white'

    return (
      <div
        key={item.id}
        className={`rounded-lg transition-all ${dragOverId === item.id ? 'ring-1 ring-blue-400/60 ring-offset-0 bg-white/5' : ''}`}
        draggable
        onDragStart={e => handleDragStart(e, item.id)}
        onDragOver={e => handleDragOver(e, item.id)}
        onDrop={e => handleDrop(e, item.id)}
        onDragEnd={handleDragEnd}
      >
        <Link
          href={item.href}
          className={`group/item flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeClass}`}
        >
          <span className="opacity-0 group-hover/item:opacity-30 text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0">
            <GripDots />
          </span>

          {item.id === 'my_tasks' && hasNewTasks ? (
            <div className="relative flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
              </svg>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            </div>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
            </svg>
          )}

          <span className="flex-1 min-w-0">
            {item.label}
            {item.description && <span className="block text-[10px] font-normal opacity-50 leading-tight mt-0.5">{item.description}</span>}
          </span>

          {item.id === 'my_tasks' && hasNewTasks && (
            <span className="ml-auto text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full leading-none">
              {notifCount - lastSeenCount}
            </span>
          )}
          {item.id === 'opportunities' && newOppsCount > 0 && (
            <span className="ml-auto text-xs bg-green-500 text-white rounded-full px-1.5 py-0.5 font-bold">
              +{newOppsCount}
            </span>
          )}
        </Link>

        {item.children?.map(child => {
          const childActive = child.active
          const childClass = childActive
            ? child.activeColor === 'amber' ? 'bg-amber-500/20 text-amber-400'
              : child.activeColor === 'red' ? 'bg-red-500/20 text-red-400'
              : 'bg-blue-500/20 text-blue-400'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
          return (
            <Link key={child.id} href={child.href}
              className={`flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg text-sm font-medium transition-colors ${childClass}`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={child.iconPath} />
              </svg>
              {child.label}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <>
    <aside className="w-64 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#1e1e2e' }}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-sm">EventsHQ</div>
            <div className="text-gray-400 text-xs">360° Management</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navOrder.map(id => navDefs[id] && renderNavItem(navDefs[id]))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1.5">
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Search & Display Preferences"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Preferences
        </button>
        <div className="flex items-center gap-1.5 text-gray-600 text-xs px-3">
          <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 8 14">
            <circle cx="2" cy="2" r="1.1"/><circle cx="6" cy="2" r="1.1"/>
            <circle cx="2" cy="5.5" r="1.1"/><circle cx="6" cy="5.5" r="1.1"/>
            <circle cx="2" cy="9" r="1.1"/><circle cx="6" cy="9" r="1.1"/>
          </svg>
          <span>Drag items to reorder menu</span>
        </div>
        <div className="text-gray-600 text-xs px-3">v1.0.0</div>
      </div>
    </aside>

    {showSettings && <SetupPreferencesModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
