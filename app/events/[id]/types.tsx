'use client'

import Tooltip from '@/app/components/Tooltip'

export interface Event {
  id: number
  name: string
  type: string
  status: string
  start_date: string
  end_date: string
  location: string
  venue: string
  expected_attendees: number
  budget_total: number
  description: string
  created_at: string
  opportunity_id?: number | null
  review_notes?: string | null
  post_event_completed?: number | null
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  conference: 'Conference',
  trade_show: 'Trade Show',
  client_summit: 'Client Summit',
  sales_kickoff: 'Sales Kickoff',
}

export function EventStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-800',
    pending_approval: 'bg-orange-100 text-orange-800',
    active: 'bg-green-100 text-green-800',
    complete: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    pending_approval: 'Pending Approval',
  }
  const tooltips: Record<string, string> = {
    pending_approval: 'This event is awaiting sign-off before moving to active planning.',
    planning: 'Event is confirmed and actively being planned.',
    active: 'Event is currently underway.',
    complete: 'Event has concluded.',
    cancelled: 'Event has been cancelled.',
  }
  const badge = (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
  if (tooltips[status]) {
    return <Tooltip text={tooltips[status]} position="bottom">{badge}</Tooltip>
  }
  return badge
}
