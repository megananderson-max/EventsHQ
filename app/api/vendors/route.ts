import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    let query = 'SELECT * FROM vendors WHERE 1=1'
    const params: (string | number)[] = []

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }
    if (search) {
      query += ' AND (name LIKE ? OR contact_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    query += ' ORDER BY name ASC'

    const vendors = db.prepare(query).all(...params)
    return NextResponse.json(vendors)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, category, contact_name, contact_email, contact_phone, website, notes } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO vendors (name, category, contact_name, contact_email, contact_phone, website, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, contact_name || null, contact_email || null, contact_phone || null, website || null, notes || null)

    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 })
  }
}
