'use client'

const AI_BADGE = (
  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full leading-none">
    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
    AI
  </span>
)

const STEPS = [
  {
    number: 1,
    phase: 'Setup',
    color: 'violet',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    title: 'Tell the AI about your company',
    description: 'Paste your website URL. The AI reads your site and extracts your company name, products, target customers, and focus areas automatically.',
    aiActions: ['Reads your website', 'Extracts company profile', 'Sets search preferences'],
    humanActions: ['Review & confirm the extracted info', 'Add any missing details'],
    output: 'Your AI search profile is saved',
  },
  {
    number: 2,
    phase: 'Discovery',
    color: 'blue',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    title: 'AI finds events for you',
    description: 'Every day, the AI automatically searches the web and Twitter/X for conferences, summits, and expos that match your profile — scored and ranked.',
    aiActions: ['Searches the web daily', 'Scans Twitter/X via Apify', 'Scores each event for strategic fit', 'Ranks by priority (0–100)'],
    humanActions: ['Nothing — happens automatically in the background'],
    output: '60+ scored opportunities added to your pipeline',
  },
  {
    number: 3,
    phase: 'Review',
    color: 'sky',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    title: 'Review and triage opportunities',
    description: 'Browse the ranked list. Filter by fit, region, or use the ⏰ Act Soon button to surface events with approaching deadlines.',
    aiActions: ['Flags high-fit events closing soon', 'Shows audience match explanation', 'Provides competitive intel'],
    humanActions: ['Browse and filter the list', 'Move strong candidates to Under Review', 'Mark poor fits as Do Not Attend + give a reason'],
    output: 'Shortlist of events ready for approval',
    learning: 'Every "Do Not Attend" reason you give is fed back into the AI — future scans automatically avoid similar events.',
  },
  {
    number: 4,
    phase: 'Approval',
    color: 'amber',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    title: 'Go / No-Go decision',
    description: '"Under Review" events are visible on the dashboard for team sign-off. One click converts an approved event into a full event record.',
    aiActions: ['Generates benchmark budget estimate', 'Creates a starter task checklist', 'Suggests relevant vendors'],
    humanActions: ['Review the opportunity', 'Approve or decline', 'Confirm to create the event'],
    output: 'Approved event created with budget, tasks & vendors pre-filled',
  },
  {
    number: 5,
    phase: 'Planning',
    color: 'green',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    title: 'Plan and manage the event',
    description: 'All tasks, budget line items, and vendor contacts live in one place. The team can update the AI-generated content or import new details at any time.',
    aiActions: ['Import & Update with AI — paste any URL or document to refresh event details', 'Suggests vendors by event type'],
    humanActions: ['Assign tasks to team members', 'Track budget actuals vs. estimates', 'Manage vendors and contacts'],
    output: 'Event fully planned with assigned owners and tracked spend',
  },
  {
    number: 6,
    phase: 'Execution',
    color: 'orange',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    title: 'Run the event',
    description: 'On event day, the Execution tab holds your run of show, staff assignments, and on-site checklist. Everything in one screen.',
    aiActions: [],
    humanActions: ['Follow the run of show', 'Track check-ins', 'Note anything unexpected'],
    output: 'Event delivered',
  },
  {
    number: 7,
    phase: 'Results',
    color: 'teal',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title: 'Log actuals with AI',
    description: 'After the event, paste your debrief notes — an email, a Slack message, anything in plain text. The AI reads it and fills in leads, pipeline, revenue, and satisfaction automatically.',
    aiActions: ['Reads your post-event debrief text', 'Extracts leads, pipeline, revenue, satisfaction', 'Lets you review before saving'],
    humanActions: ['Paste debrief notes', 'Review extracted numbers', 'Confirm or adjust'],
    output: 'Actuals logged — ROI calculated instantly',
  },
  {
    number: 8,
    phase: 'Learning',
    color: 'violet',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    title: 'The system gets smarter over time',
    description: 'Every decision you make teaches the AI. Rejected events improve future scans. ROI data from concluded events helps benchmark new ones more accurately.',
    aiActions: ['Do Not Attend reasons → filter future scans', 'ROI history → better benchmarks', 'Approval patterns → smarter scoring'],
    humanActions: ['Just keep using the tool normally'],
    output: 'Progressively more accurate recommendations with every cycle',
    learning: 'This is the flywheel — the more you use it, the better it gets.',
  },
]

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; badgeBg: string; dot: string; light: string }> = {
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'text-violet-700', badgeBg: 'bg-violet-100', dot: 'bg-violet-500', light: 'bg-violet-500' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'text-blue-700',   badgeBg: 'bg-blue-100',   dot: 'bg-blue-500',   light: 'bg-blue-500'   },
  sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    badge: 'text-sky-700',    badgeBg: 'bg-sky-100',    dot: 'bg-sky-500',    light: 'bg-sky-500'    },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'text-amber-700',  badgeBg: 'bg-amber-100',  dot: 'bg-amber-500',  light: 'bg-amber-500'  },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  badge: 'text-green-700',  badgeBg: 'bg-green-100',  dot: 'bg-green-500',  light: 'bg-green-500'  },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'text-orange-700', badgeBg: 'bg-orange-100', dot: 'bg-orange-500', light: 'bg-orange-500' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   badge: 'text-teal-700',   badgeBg: 'bg-teal-100',   dot: 'bg-teal-500',   light: 'bg-teal-500'   },
}

export default function WorkflowPage() {
  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">How EventsHQ Works</h1>
            <p className="text-sm text-gray-500">End-to-end workflow — from finding an event to measuring its impact</p>
          </div>
        </div>

        {/* AI legend */}
        <div className="flex flex-wrap items-center gap-6 mt-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              AI
            </span>
            = done automatically by AI
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </span>
            = requires your input
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
            = learning moment — your decision improves future results
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[27px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-violet-200 via-blue-200 to-violet-200 z-0" />

        <div className="space-y-6">
          {STEPS.map((step, idx) => {
            const c = COLOR_MAP[step.color] || COLOR_MAP.blue
            const isLast = idx === STEPS.length - 1
            return (
              <div key={step.number} className="relative flex gap-5 z-10">
                {/* Step number circle */}
                <div className={`w-[56px] flex-shrink-0 flex flex-col items-center gap-1`}>
                  <div className={`w-10 h-10 rounded-full ${c.light} text-white flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0`}>
                    {step.number}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.text}`}>{step.phase}</span>
                </div>

                {/* Card */}
                <div className={`flex-1 ${c.bg} border ${c.border} rounded-xl p-5 shadow-sm`}>
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-base font-bold text-gray-900">{step.title}</h2>
                    <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${c.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                    </svg>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{step.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* AI does */}
                    {step.aiActions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          {AI_BADGE}
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

                    {/* Human does */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
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
                  </div>

                  {/* Learning callout */}
                  {step.learning && (
                    <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 font-medium">{step.learning}</p>
                    </div>
                  )}

                  {/* Output pill */}
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

      {/* Flywheel summary */}
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
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-violet-100 rounded-lg px-3 py-2 shadow-sm">
              <span className="font-semibold text-violet-700">{item.label}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-gray-600">{item.arrow}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
