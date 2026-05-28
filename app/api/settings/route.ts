import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type CompanyProfile = {
  id: string
  name: string
  website_url: string
  description?: string
}

function ensureTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
  return db
}

export async function GET() {
  const db = ensureTable()
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
  const out: Record<string, unknown> = {}
  rows.forEach(r => { out[r.key] = r.value })

  // Parse company_profiles from JSON string
  let companyProfiles: CompanyProfile[] = []
  if (typeof out.company_profiles === 'string') {
    try { companyProfiles = JSON.parse(out.company_profiles) } catch {}
  }
  out.company_profiles = companyProfiles

  return NextResponse.json(out)
}

export async function PUT(req: NextRequest) {
  const db = ensureTable()
  const body = await req.json() as Record<string, unknown>

  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `)

  // Handle company_profiles array separately
  const { company_profiles, ...rest } = body
  if (Array.isArray(company_profiles)) {
    stmt.run('company_profiles', JSON.stringify(company_profiles))
    // Backward compatibility: keep opp_company_name in sync with first company
    const firstCompany = company_profiles[0] as CompanyProfile | undefined
    if (firstCompany?.name && !rest.opp_company_name) {
      stmt.run('opp_company_name', firstCompany.name)
    }
  }

  for (const [key, value] of Object.entries(rest)) {
    // Skip nav_order / nav_hidden — those don't affect documentation content
    if (key === 'nav_order' || key === 'nav_hidden') {
      stmt.run(key, String(value ?? ''))
      continue
    }
    stmt.run(key, String(value ?? ''))
  }

  // Trigger background workflow-docs regeneration whenever meaningful settings change
  // (fire-and-forget — don't await, don't fail the settings save if this errors)
  const baseUrl = req.headers.get('origin') || `http://localhost:${process.env.PORT || 3000}`
  fetch(`${baseUrl}/api/workflow-docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'settings_saved' }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
