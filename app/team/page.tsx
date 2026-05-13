'use client'

import { useEffect, useState } from 'react'
import { SortTh, useSortState } from '@/app/components/SortTh'

interface TeamMember {
  id: number
  name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  is_me: number
  role?: string | null
}

function RoleBadge({ role }: { role?: string | null }) {
  if (role === 'admin') {
    return <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">Admin</span>
  }
  if (role === 'manager') {
    return <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5 font-medium">Manager</span>
  }
  return <span className="text-xs text-gray-400">User</span>
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  // Add form state
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState('user')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Inline edit state: which member is being edited
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('user')
  const [saving, setSaving] = useState(false)

  // Remove confirm modal state
  const [removeConfirm, setRemoveConfirm] = useState<TeamMember | null>(null)
  const [reassignAction, setReassignAction] = useState<'unassign' | 'self' | 'other'>('unassign')
  const [reassignTo, setReassignTo] = useState<string>('')
  const [removing, setRemoving] = useState(false)

  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({}) // memberId -> open task count
  const [orphanToast, setOrphanToast] = useState<{ count: number } | null>(null)

  const { sortKey, sortDir, toggle } = useSortState<'name' | 'email' | 'role'>('name')

  const load = () =>
    fetch('/api/team-members')
      .then(r => r.json())
      .then((d: TeamMember[]) => {
        setMembers(d)
        setLoading(false)
        fetch('/api/planning')
          .then(r => r.json())
          .then((items: { assigned_to: string | null; status: string }[]) => {
            const counts: Record<number, number> = {}
            for (const member of d) {
              const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.name
              counts[member.id] = items.filter(
                item => item.assigned_to === fullName && item.status !== 'complete'
              ).length
            }
            setTaskCounts(counts)
          })
          .catch(() => {})
      })
      .catch(() => setLoading(false))

  useEffect(() => { load() }, [])

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id)
    setEditFirstName(m.first_name || m.name)
    setEditLastName(m.last_name || '')
    setEditEmail(m.email || '')
    setEditRole(m.role || 'user')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditFirstName('')
    setEditLastName('')
    setEditEmail('')
    setEditRole('user')
  }

  const saveEdit = async (m: TeamMember) => {
    if (!editFirstName.trim()) return
    setSaving(true)
    await fetch(`/api/team-members/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: editFirstName, last_name: editLastName || null, email: editEmail || null, is_me: m.is_me, role: editRole }),
    })
    await load()
    setEditingId(null)
    setSaving(false)
  }

  const setAsMe = async (m: TeamMember) => {
    await fetch(`/api/team-members/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: m.first_name || m.name, last_name: m.last_name, email: m.email, is_me: 1, role: m.role || 'user' }),
    })
    await load()
  }

  const openRemoveConfirm = (m: TeamMember) => {
    setRemoveConfirm(m)
    setReassignAction('unassign')
    setReassignTo('')
  }

  const confirmRemove = async () => {
    if (!removeConfirm) return
    setRemoving(true)
    const member = removeConfirm

    // Handle task reassignment
    if (reassignAction !== 'unassign') {
      let newAssignee: string | null = null
      if (reassignAction === 'self') {
        const me = members.find(m => m.is_me === 1 && m.id !== member.id)
        newAssignee = me?.name || null
      } else if (reassignAction === 'other' && reassignTo) {
        newAssignee = reassignTo
      }

      if (newAssignee) {
        // Fetch all planning items and update ones assigned to the removed member
        try {
          const allItems = await fetch('/api/planning').then(r => r.json()) as Array<{ id: number; event_id: number; assigned_to: string | null; title: string; description: string | null; done: number; status: string; due_date: string | null }>
          const toReassign = allItems.filter(item => item.assigned_to === member.name)
          await Promise.all(toReassign.map(item =>
            fetch(`/api/events/${item.event_id}/planning/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.title,
                description: item.description,
                done: item.done,
                status: item.status,
                assigned_to: newAssignee,
                due_date: item.due_date,
              }),
            })
          ))
        } catch {
          // Non-fatal: proceed with deletion even if reassignment fails
        }
      }
    }

    // Track whether tasks were left unassigned
    let orphanedCount = 0
    if (reassignAction === 'unassign') {
      try {
        const allItems = await fetch('/api/planning').then(r => r.json()) as Array<{ assigned_to: string | null; status: string }>
        const memberFullName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.name
        orphanedCount = allItems.filter(item => item.assigned_to === memberFullName && item.status !== 'complete').length
      } catch {
        // Non-fatal
      }
    }

    // Delete the member
    await fetch(`/api/team-members/${member.id}`, { method: 'DELETE' })
    setRemoveConfirm(null)
    setRemoving(false)
    await load()

    if (reassignAction === 'unassign' && orphanedCount > 0) {
      setOrphanToast({ count: orphanedCount })
      setTimeout(() => setOrphanToast(null), 8000)
    }
  }

  const addMember = async () => {
    if (!addFirstName.trim()) { setAddError('First name is required'); return }
    setAdding(true)
    setAddError(null)
    const res = await fetch('/api/team-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: addFirstName.trim(), last_name: addLastName.trim() || null, email: addEmail.trim() || null, is_me: 0, role: addRole }),
    })
    if (res.ok) {
      setAddFirstName('')
      setAddLastName('')
      setAddEmail('')
      setAddRole('user')
      await load()
    } else {
      const d = await res.json()
      setAddError(d.error || 'Failed to add')
    }
    setAdding(false)
  }

  const sorted = [...members].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'email') cmp = (a.email || '').localeCompare(b.email || '')
    else if (sortKey === 'role') cmp = (a.role || 'user').localeCompare(b.role || 'user')
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-500">People who can be assigned to tasks. Mark yourself as <strong>Me</strong> so your tasks appear in <strong>My Tasks</strong>.</p>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        {members.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No team members yet — add one below</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortTh label="Name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-5 py-3" />
                <SortTh label="Email" col="email" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-5 py-3" />
                <SortTh label="Role" col="role" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-5 py-3 w-28" />
                <th className="px-5 py-3 w-24 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-5 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(m => (
                <tr key={m.id} className="group hover:bg-gray-50 transition-colors">
                  {editingId === m.id ? (
                    <>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5">
                          <input
                            autoFocus
                            value={editFirstName}
                            onChange={e => setEditFirstName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') cancelEdit() }}
                            placeholder="First name"
                            className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <input
                            value={editLastName}
                            onChange={e => setEditLastName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') cancelEdit() }}
                            placeholder="Last name"
                            className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') cancelEdit() }}
                          placeholder="email@example.com"
                          className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value)}
                          className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        {m.is_me ? (
                          <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-medium">Me</span>
                        ) : (
                          <span className="text-xs text-gray-400">Team</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => saveEdit(m)}
                            disabled={saving}
                            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium"
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{m.name}</span>
                          {(taskCounts[m.id] ?? 0) > 0 && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                              {taskCounts[m.id]} tasks
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {m.email ? (
                          <span className="text-sm text-gray-600">{m.email}</span>
                        ) : (
                          <span className="text-sm text-gray-300 italic">No email</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <RoleBadge role={m.role} />
                      </td>
                      <td className="px-5 py-3">
                        {m.is_me ? (
                          <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-medium">Me</span>
                        ) : (
                          <button
                            onClick={() => setAsMe(m)}
                            className="text-xs text-gray-400 hover:text-indigo-600 hover:underline"
                            title="Set as current user"
                          >
                            Team
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(m)}
                            className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => openRemoveConfirm(m)}
                            className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add new member */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Team Member
        </h2>
        <div className="flex gap-3 items-start flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">First Name <span className="text-red-400">*</span></label>
            <input
              value={addFirstName}
              onChange={e => { setAddFirstName(e.target.value); setAddError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') addMember() }}
              placeholder="e.g. Sarah"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
            <input
              value={addLastName}
              onChange={e => setAddLastName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMember() }}
              placeholder="e.g. Jones"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMember() }}
              placeholder="sarah@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select
              value={addRole}
              onChange={e => setAddRole(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="pt-5">
            <button
              onClick={addMember}
              disabled={adding}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {adding ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              )}
              Add
            </button>
          </div>
        </div>
        {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
        <p className="text-xs text-gray-400 mt-3">Team members appear in the assignee dropdown when creating or editing tasks. Only one person can be marked <strong>Me</strong> at a time.</p>
      </div>

      {/* Orphan tasks toast */}
      {orphanToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          <span>{orphanToast.count} {orphanToast.count === 1 ? 'task is' : 'tasks are'} now unassigned —</span>
          <a href="/planning" className="underline font-semibold hover:text-amber-100 whitespace-nowrap">View tasks →</a>
          <button onClick={() => setOrphanToast(null)} className="ml-1 text-amber-200 hover:text-white">✕</button>
        </div>
      )}

      {/* Remove Confirm Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Remove Team Member</h2>
            <p className="text-sm text-gray-500 mb-5">
              You are removing <span className="font-semibold text-gray-800">{removeConfirm.name}</span> from the team.
            </p>

            <p className="text-sm font-medium text-gray-700 mb-3">
              How should tasks currently assigned to <span className="font-semibold">{removeConfirm.name}</span> be handled?
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reassign"
                  value="unassign"
                  checked={reassignAction === 'unassign'}
                  onChange={() => setReassignAction('unassign')}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Leave unassigned</span>
                  <p className="text-xs text-gray-400">Tasks will remain but with no assignee.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reassign"
                  value="self"
                  checked={reassignAction === 'self'}
                  onChange={() => setReassignAction('self')}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Assign to myself</span>
                  <p className="text-xs text-gray-400">
                    Tasks go to{' '}
                    {members.find(m => m.is_me === 1 && m.id !== removeConfirm.id)?.name || 'the member marked as Me'}
                    .
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reassign"
                  value="other"
                  checked={reassignAction === 'other'}
                  onChange={() => setReassignAction('other')}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">Assign to another team member</span>
                  {reassignAction === 'other' && (
                    <select
                      value={reassignTo}
                      onChange={e => setReassignTo(e.target.value)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      <option value="">Select a member…</option>
                      {members
                        .filter(m => m.id !== removeConfirm.id)
                        .map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setRemoveConfirm(null)}
                disabled={removing}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={removing || (reassignAction === 'other' && !reassignTo)}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                {removing && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                )}
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
