import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

const client = new Anthropic()

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

  const prompt = `You are analyzing tweets to extract B2B event opportunities for a company.

Company context: ${companyName || 'a B2B software company'}
${customerProfile ? `Customer profile: ${customerProfile}` : ''}
Focus areas: ${focusAreas.join(', ') || 'general B2B tech'}
Regions: ${regions.join(', ') || 'global'}

Already-known events (do not duplicate):
${existingNames.slice(0, 50).join(', ')}

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
