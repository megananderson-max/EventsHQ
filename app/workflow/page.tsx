'use client'

import { useEffect, useState, useCallback } from 'react'

type Step = {
  number: number
  phase: string
  color: string
  icon: string
  title: string
  description: string
  aiActions: string[]
  humanActions: string[]
  output: string
  learning?: string | null
}

type DocsResponse = {
  docs: Step[] | null
  generated_at: string | null
  trigger?: string
}

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full leading-none">
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      AI
    </span>
  )
}

type Colors = { bg: string; border: string; text: string; light: string }
const COLOR_MAP: Record<string, Colors> = {
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', light: 'bg-violet-500' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   light: 'bg-blue-500'   },
  sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    light: 'bg-sky-500'    },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  light: 'bg-amber-500'  },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  light: 'bg-green-500'  },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', light: 'bg-orange-500' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   light: 'bg-teal-500'   },
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function WorkflowPage() {
  const [data, setData] = useState<DocsResponse>({ docs: null, generated_at: null })
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow-docs')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load documentation')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const regenerate = async () => {
    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/workflow-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  const steps = data.docs

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">How EventsHQ Works</h1>
              <p className="text-sm text-gray-500">End-to-end workflow — from finding an event to measuring its impact</p>
            </div>
          </div>

          {/* Regenerate button + last updated */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {regenerating ? 'Updating…' : 'Regenerate'}
            </button>
            {data.generated_at && (
              <span className="text-[10px] text-gray-400">
                Updated {formatRelativeTime(data.generated_at)}
                {data.trigger && data.trigger !== 'manual' && ` · auto (${data.trigger})`}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 mt-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <AIBadge />
            <span>= done automatically by AI</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <span>= requires your input</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
            <span>= learning moment — your decision improves future results</span>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-5">
              <div className="w-[56px] flex-shrink-0 flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                <div className="w-12 h-2.5 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="flex-1 bg-gray-100 rounded-xl p-5 animate-pulse h-32" />
            </div>
          ))}
        </div>
      )}

      {/* No docs yet — prompt to generate */}
      {!loading && !steps && (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Documentation not yet generated</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Click &ldquo;Regenerate&rdquo; above to have the AI write up-to-date documentation based on your current app configuration.
          </p>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {regenerating ? 'Generating…' : 'Generate Documentation'}
          </button>
        </div>
      )}

      {/* Steps */}
      {steps && steps.length > 0 && (
        <>
          <div className="relative">
            <div className="absolute left-[27px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-violet-200 via-blue-200 to-violet-200 z-0" />
            <div className="space-y-6">
              {steps.map((step) => {
                const c = COLOR_MAP[step.color] ?? COLOR_MAP.blue
                return (
                  <div key={step.number} className="relative flex gap-5 z-10">
                    <div className="w-[56px] flex-shrink-0 flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-full ${c.light} text-white flex items-center justify-center text-sm font-bold shadow-sm`}>
                        {step.number}
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.text}`}>{step.phase}</span>
                    </div>

                    <div className={`flex-1 ${c.bg} border ${c.border} rounded-xl p-5 shadow-sm`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h2 className="text-base font-bold text-gray-900">{step.title}</h2>
                        {step.icon && (
                          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${c.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                          </svg>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-4">{step.description}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {step.aiActions && step.aiActions.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <AIBadge />
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI handles this</span>
                            </div>
                            <ul className="space-y-1">
                              {step.aiActions.map((a, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {step.humanActions && step.humanActions.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </span>
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">You do this</span>
                            </div>
                            <ul className="space-y-1">
                              {step.humanActions.map((a, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {step.learning && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                          <span className="mt-0.5 text-amber-500">💡</span>
                          <span>{step.learning}</span>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className={`text-xs font-semibold ${c.text}`}>{step.output}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Learning flywheel */}
          <div className="mt-10 p-6 bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl">
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              The Learning Flywheel
            </h2>
            <div className="flex flex-wrap gap-3 text-xs text-gray-700">
              {[
                { label: 'Do Not Attend reasons', arrow: 'Better discovery filters' },
                { label: 'Past event ROI', arrow: 'More accurate benchmarks' },
                { label: 'Approved events', arrow: 'Smarter scoring model' },
                { label: 'Debrief data', arrow: 'Faster outcome logging' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 bg-white border border-violet-100 rounded-lg px-3 py-2 shadow-sm">
                  <span className="font-semibold text-violet-700">{item.label}</span>
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-gray-600">{item.arrow}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
