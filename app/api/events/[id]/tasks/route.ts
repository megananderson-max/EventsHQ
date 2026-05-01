import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const tasks = db.prepare('SELECT * FROM tasks WHERE event_id = ? ORDER BY priority DESC, due_date ASC').all(params.id)
    return NextResponse.json(tasks)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { title, description, category, assigned_to, due_date, status, priority } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO tasks (event_id, title, description, category, assigned_to, due_date, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.id, title, description || null, category || 'general', assigned_to || null, due_date || null, status || 'todo', priority || 'medium')

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
