import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

const client = new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY })

function getSettings() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))`)
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
  const s: Record<string, string> = {}
  rows.forEach(r => { s[r.key] = r.value })
  return { db, s }
}

function setSetting(db: ReturnType<typeof getDb>, key: string, value: string) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(key, value)
}

export async function GET() {
  const { s } = getSettings()
  return NextResponse.json({
    configured: !!s.apify_api_key,
    last_scan_at: s.apify_last_scan_at || null,
    last_added: parseInt(s.apify_last_scan_added || '0'),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { apify_api_key?: string }
  const { db, s } = getSettings()

  // Allow saving key without running a scan
  if (body.apify_api_key !== undefined) {
    setSetting(db, 'apify_api_key', body.apify_api_key.trim())
    return NextResponse.json({ ok: true, saved: true })
  }

  const apiKey = s.apify_api_key
  if (!apiKey) return NextResponse.json({ error: 'Apify API key not configured' }, { status: 400 })

  const focusAreas = (s.opp_focus_areas || '').split(',').filter(Boolean)
  const regions = (s.opp_regions || '').split(',').filter(Boolean)
  const companyName = s.opp_company_name || ''
  const customerProfile = s.opp_customer_profile || ''

  // Build search queries from user preferences
  const FOCUS_LABELS: Record<string, string> = {
    cx: 'customer experience CX',
    community: 'community management',
    contact_center: 'contact center CCaaS',
    social_media: 'social media marketing',
    ai_tech: 'AI enterprise tech',
    executive: 'executive leadership',
  }
  const REGION_LABELS: Record<string, string> = {
    north_america: 'USA',
    europe: 'Europe',
    uk: 'UK',
    apac: 'Asia Pacific',
    latam: 'Latin America',
    middle_east: 'Middle East',
    global: '',
  }

  const focusTerms = focusAreas.length
    ? focusAreas.map(f => FOCUS_LABELS[f] || f).slice(0, 3)
    : ['customer experience', 'enterprise software', 'B2B tech']

  const regionTerm = regions.length && regions[0] !== 'global'
    ? ` ${REGION_LABELS[regions[0]] || ''}`.trim()
    : ''

  const year = new Date().getFullYear()
  const searchTerms = [
    ...focusTerms.map(f => `${f} conference ${year} sponsorship${regionTerm}`),
    ...focusTerms.map(f => `${f} summit ${year + 1}${regionTerm}`),
    `${companyName ? companyName + ' competitor ' : ''}events conference ${year}`,
  ].filter(Boolean).slice(0, 6)

  // Run Apify Twitter scraper (apidojo/tweet-scraper)
  let tweets: Array<{ text?: string; full_text?: string; url?: string; author?: { name?: string; userName?: string }; createdAt?: string }> = []
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apidojo~tweet-scraper/runs?token=${apiKey}&waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms,
          maxItems: 80,
          tweetLanguage: 'en',
          onlyVerifiedUsers: false,
          onlyTwitterBlue: false,
        }),
      }
    )
    if (!runRes.ok) {
      const err = await runRes.text()
      return NextResponse.json({ error: `Apify run failed: ${err}` }, { status: 502 })
    }
    const run = await runRes.json() as { data?: { defaultDatasetId?: string } }
    const datasetId = run?.data?.defaultDatasetId
    if (!datasetId) return NextResponse.json({ error: 'No dataset returned from Apify' }, { status: 502 })

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&clean=true&limit=80`
    )
    if (!itemsRes.ok) return NextResponse.json({ error: 'Failed to fetch Apify results' }, { status: 502 })
    tweets = await itemsRes.json() as typeof tweets
  } catch (e) {
    return NextResponse.json({ error: `Apify request failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }

  if (!tweets.length) {
    setSetting(db, 'apify_last_scan_at', new Date().toISOString())
    setSetting(db, 'apify_last_scan_added', '0')
    return NextResponse.json({ added: 0, found: 0, message: 'No tweets returned' })
  }

  // Format tweets for Claude
  const tweetText = tweets.slice(0, 60).map((t, i) => {
    const text = t.text || t.full_text || ''
    const url = t.url || ''
    const author = t.author?.name || t.author?.userName || ''
    return `[${i + 1}] ${author ? `@${author}: ` : ''}${text}${url ? ` (${url})` : ''}`
  }).join('\n')

  const existingNames = (db.prepare('SELECT name FROM opportunities').all() as { name: string }[]).map(r => r.name)

  // Fetch Do Not Attend signals to teach the AI what to avoid
  const dnaSignals = (db.prepare(`
    SELECT name, dna_notes, competitor_name, is_competitor_event, focus_area
    FROM opportunities
    WHERE status = 'do_not_attend' AND (dna_notes IS NOT NULL OR competitor_name IS NOT NULL)
    ORDER BY updated_at DESC LIMIT 30
  `).all() as Array<{ name: string; dna_notes: string | null; competitor_name: string | null; is_competitor_event: number; focus_area: string | null }>)

  const dnaBlock = dnaSignals.length > 0
    ? `\nEvents the user has explicitly rejected — do NOT suggest similar events:\n${dnaSignals.map(d =>
        `- "${d.name}"${d.is_competitor_event ? ' [competitor]' : ''}${d.competitor_name ? ` by ${d.competitor_name}` : ''}${d.dna_notes ? `: ${d.dna_notes}` : ''}`
      ).join('\n')}\n`
    : ''

  // Fetch approved/attended opportunities as positive signals
  const approvedSignals = (db.prepare(`
    SELECT name, type, location, focus_area, region, description, priority_score
    FROM opportunities
    WHERE (status = 'pending_approval' OR added_to_events = 1)
    ORDER BY priority_score DESC, updated_at DESC
    LIMIT 15
  `).all() as Array<{ name: string; type: string | null; location: string | null; focus_area: string | null; region: string | null; description: string | null; priority_score: number | null }>)

  const approvedBlock = approvedSignals.length > 0
    ? `\nAPPROVED EVENTS — find more like these:\n${approvedSignals.map(a =>
        `- ${a.name} (${a.type || 'conference'}${a.location ? `, ${a.location}` : ''}${a.focus_area ? `, focus: ${a.focus_area}` : ''})`
      ).join('\n')}\n`
    : ''

  // Fetch pipeline decline reasons
  const declinedFromReview = (db.prepare(`
    SELECT name, type, location, review_notes
    FROM opportunities
    WHERE status = 'pipeline' AND review_notes IS NOT NULL AND review_notes != ''
    ORDER BY updated_at DESC LIMIT 10
  `).all() as Array<{ name: string; type: string | null; location: string | null; review_notes: string }>)

  const declineBlock = declinedFromReview.length > 0
    ? `\nRETURNED TO PIPELINE — why they weren't approved (use to calibrate scoring):\n${declinedFromReview.map(d =>
        `- "${d.name}"${d.location ? ` (${d.location})` : ''}: ${d.review_notes}`
      ).join('\n')}\n`
    : ''

  const prompt = `You are analyzing tweets to extract B2B event opportunities for a company.

Company context: ${companyName || 'a B2B software company'}
${customerProfile ? `Customer profile: ${customerProfile}` : ''}
Focus areas: ${focusAreas.join(', ') || 'general B2B tech'}
Regions: ${regions.join(', ') || 'global'}

Already-known events (do not duplicate):
${existingNames.slice(0, 50).join(', ')}
${dnaBlock}${declineBlock}${approvedBlock}
Tweets:
${tweetText}

Extract any B2B conferences, summits, expos, or industry events mentioned in the tweets that could be relevant sponsorship or speaking opportunities for this company. Ignore personal tweets, product launches, or non-event content.

Return a JSON array ONLY (no other text):
[
  {
    "name": "Full Event Name 2026",
    "type": "conference",
    "start_date": "YYYY-MM-DD or null",
    "end_date": "YYYY-MM-DD or null",
    "location": "City, Country or null",
    "organizer": "Organizer name or null",
    "website": "URL from tweet or event website — never null if a URL was found in the tweet",
    "description": "1-2 sentences on what this event is and why it's relevant",
    "strategic_fit": "High, Medium, or Low",
    "focus_area": "primary topic area",
    "region": "North America / Europe / APAC / etc",
    "recommendation": "Sponsor | Evaluate | Speak",
    "audience_match": "Who attends and why it matters",
    "priority_score": 70,
    "source": "twitter"
  }
]

If no relevant events are found, return an empty array [].`

  let found: Record<string, unknown>[] = []
  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (msg.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.trim() || ''
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']') + 1
    if (start !== -1 && end > start) found = JSON.parse(text.slice(start, end))
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_name ON opportunities(name)') } catch {}

  const upsert = db.prepare(`
    INSERT INTO opportunities (
      name, type, start_date, end_date, location, organizer,
      website, description, strategic_fit, focus_area, region,
      recommendation, audience_match, priority_score, status, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pipeline', ?)
    ON CONFLICT(name) DO UPDATE SET
      website = COALESCE(excluded.website, opportunities.website),
      generated_at = excluded.generated_at
  `)

  const now = new Date().toISOString()
  let added = 0
  for (const opp of found) {
    try {
      upsert.run(
        opp.name, opp.type || 'conference',
        opp.start_date || null, opp.end_date || null,
        opp.location || null, opp.organizer || null,
        (typeof opp.website === 'string' && opp.website.startsWith('http') ? opp.website : null),
        opp.description || null,
        opp.strategic_fit || 'Medium', opp.focus_area || null, opp.region || null,
        opp.recommendation || 'Evaluate', opp.audience_match || null,
        opp.priority_score || null, now
      )
      added++
    } catch { /* skip duplicates */ }
  }

  setSetting(db, 'apify_last_scan_at', now)
  setSetting(db, 'apify_last_scan_added', String(added))

  return NextResponse.json({ added, found: found.length, tweets: tweets.length })
}
