'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react'
import SetupPreferencesModal from '@/app/components/SetupPreferencesModal'
import WelcomeModal from '@/app/components/WelcomeModal'

const DEFAULT_ORDER = ['dashboard', 'events', 'opportunities', 'vendors', 'outcomes', 'my_tasks', 'calendar']

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Events Management</title>
        <meta name="description" content="360° Corporate Events Management Platform" />
      </head>
      <body className="flex h-screen bg-gray-50 overflow-hidden">
        <SessionProvider>
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SessionProvider>
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
  const { data: session, status } = useSession()

  const [notifCount, setNotifCount] = useState(0)
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const [navOrder, setNavOrder] = useState<string[]>([...DEFAULT_ORDER])
  const [hiddenItems, setHiddenItems] = useState<string[]>([])
  const [showRestorePanel, setShowRestorePanel] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrefsDropdown, setShowPrefsDropdown] = useState(false)
  const [pendingHideId, setPendingHideId] = useState<string | null>(null)
  const [newOppsCount, setNewOppsCount] = useState(0)

  // Per-user first-login welcome modal
  const [showWelcome, setShowWelcome] = useState(false)
  const [googleName, setGoogleName] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return
    fetch('/api/user/me')
      .then(r => r.json())
      .then((data: { nameConfirmed: boolean; name: string | null }) => {
        if (!data.nameConfirmed) {
          setGoogleName(data.name)
          setShowWelcome(true)
        }
      })
      .catch(() => {})
  }, [status, session?.user?.email])

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

    const applyHidden = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as string[]
        setHiddenItems(parsed.filter((id: string) => DEFAULT_ORDER.includes(id)))
        return true
      } catch { return false }
    }

    const lsOrder = localStorage.getItem('navOrder')
    if (lsOrder) applyOrder(lsOrder)

    const lsHidden = localStorage.getItem('navHidden')
    if (lsHidden) applyHidden(lsHidden)

    // DB is source of truth — override localStorage if present
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        if (s.nav_order) {
          const applied = applyOrder(s.nav_order)
          if (applied) localStorage.setItem('navOrder', s.nav_order)
        }
        if (s.nav_hidden) {
          const applied = applyHidden(s.nav_hidden)
          if (applied) localStorage.setItem('navHidden', s.nav_hidden)
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
    workflow: {
      id: 'workflow', label: 'How It Works', description: 'AI workflow · learning loop', href: '/workflow', active: pathname.startsWith('/workflow'),
      iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
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

  const toggleHideItem = (id: string) => {
    setHiddenItems(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      const serialized = JSON.stringify(next)
      localStorage.setItem('navHidden', serialized)
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nav_hidden: serialized }),
      }).catch(() => {})
      return next
    })
  }

  const renderNavItem = (item: NavItemDef) => {
    const activeClass = item.active
      ? 'bg-blue-500/20 text-blue-400'
      : 'text-gray-400 hover:bg-white/5 hover:text-white'

    // Show inline confirmation when this item's × was clicked
    if (pendingHideId === item.id) {
      return (
        <div key={item.id} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 space-y-2">
          <p className="text-xs text-gray-300 leading-snug">
            Hide <span className="font-semibold text-white">{item.label}</span> from the menu?
          </p>
          <p className="text-[10px] text-gray-500 leading-snug">
            To restore it, click <span className="text-amber-400/80 font-medium">hidden · Restore</span> at the bottom of the sidebar.
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => { toggleHideItem(item.id); setPendingHideId(null) }}
              className="flex-1 py-1 rounded-md bg-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/30 transition-colors"
            >
              Hide it
            </button>
            <button
              onClick={() => setPendingHideId(null)}
              className="flex-1 py-1 rounded-md bg-white/10 text-gray-300 text-[11px] font-medium hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

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
        <div className="group/item flex items-center gap-1">
        <Link
          href={item.href}
          className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeClass}`}
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

        <button
          onClick={() => setPendingHideId(item.id)}
          className="opacity-0 group-hover/item:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Remove from menu"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>

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
        {navOrder.filter(id => !hiddenItems.includes(id)).map(id => navDefs[id] && renderNavItem(navDefs[id]))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">

        {/* Preferences / Team / How It Works — single dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPrefsDropdown(p => !p)}
            className={`flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition-colors ${showPrefsDropdown || pathname.startsWith('/team') || pathname.startsWith('/workflow') ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span className="flex-1 text-left">More</span>
            <svg className={`w-3 h-3 transition-transform ${showPrefsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPrefsDropdown && (
            <div className="mx-1 mb-1 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
              {/* Search & display preferences */}
              <button
                onClick={() => { setShowSettings(true); setShowPrefsDropdown(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Search &amp; Display Settings
              </button>

              {/* Team */}
              <Link
                href="/team"
                onClick={() => setShowPrefsDropdown(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${pathname.startsWith('/team') ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Team
              </Link>

              {/* How It Works */}
              <Link
                href="/workflow"
                onClick={() => setShowPrefsDropdown(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${pathname.startsWith('/workflow') ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                How It Works
              </Link>
            </div>
          )}
        </div>

        {/* Restore hidden items */}
        {hiddenItems.length > 0 && (
          <div>
            <button
              onClick={() => setShowRestorePanel(p => !p)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              {hiddenItems.length} hidden · Restore
              <svg className={`w-3 h-3 ml-auto transition-transform ${showRestorePanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showRestorePanel && (
              <div className="mx-2 mt-1 p-2 rounded-lg bg-white/5 border border-white/10 space-y-0.5">
                {hiddenItems.map(id => {
                  const def = navDefs[id]
                  if (!def) return null
                  return (
                    <button
                      key={id}
                      onClick={() => toggleHideItem(id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={def.iconPath} />
                      </svg>
                      <span className="flex-1 text-left">{def.label}</span>
                      <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-gray-600 text-xs px-3 pt-0.5">
          <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 8 14">
            <circle cx="2" cy="2" r="1.1"/><circle cx="6" cy="2" r="1.1"/>
            <circle cx="2" cy="5.5" r="1.1"/><circle cx="6" cy="5.5" r="1.1"/>
            <circle cx="2" cy="9" r="1.1"/><circle cx="6" cy="9" r="1.1"/>
          </svg>
          <span>Drag to reorder · hover to hide</span>
        </div>
        <div className="text-gray-600 text-xs px-3">v1.0.0</div>

        {/* User / Gmail account section */}
        <UserSection />
      </div>
    </aside>

    {showSettings && <SetupPreferencesModal onClose={() => setShowSettings(false)} onSaved={() => setShowSettings(false)} />}
    {showWelcome && <WelcomeModal googleName={googleName} onSaved={() => setShowWelcome(false)} />}
    </>
  )
}

function UserSection() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="h-8 rounded-lg bg-white/5 animate-pulse mx-3" />
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
      >
        {/* Google icon */}
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in to send emails
      </button>
    )
  }

  const gmailConnected = (session.user as { gmailConnected?: boolean })?.gmailConnected
  const name = session.user?.name ?? session.user?.email ?? 'You'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="px-3 space-y-1.5">
      <div className="flex items-center gap-2 py-1">
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-300 truncate">{name}</div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${gmailConnected ? 'bg-green-400' : 'bg-amber-400'}`} />
            <span className="text-[10px] text-gray-500">
              {gmailConnected ? 'Gmail connected' : 'Gmail not connected'}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
