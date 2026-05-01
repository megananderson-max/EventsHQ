import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string; tid: string } }) {
  try {
    const db = getDb()
    const body = await request.json()
    const { title, description, category, assigned_to, due_date, status, priority } = body

    db.prepare(`
      UPDATE tasks SET title=?, description=?, category=?, assigned_to=?, due_date=?, status=?, priority=?
      WHERE id=? AND event_id=?
    `).run(title, description || null, category || 'general', assigned_to || null, due_date || null, status || 'todo', priority || 'medium', params.tid, params.id)

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.tid)
    return NextResponse.json(task)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; tid: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM tasks WHERE id=? AND event_id=?').run(params.tid, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
