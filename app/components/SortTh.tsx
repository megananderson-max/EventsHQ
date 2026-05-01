'use client'

import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortState<T extends string>(defaultKey: T, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<T>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)
  const toggle = (key: T) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  return { sortKey, sortDir, toggle }
}

export function SortTh<T extends string>({ label, col, sortKey, sortDir, onSort, align = 'left', className = '' }: {
  label: string
  col: T
  sortKey: T
  sortDir: SortDir
  onSort: (k: T) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const active = sortKey === col
  return (
    <th className={`px-6 py-3 ${className}`}>
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide whitespace-nowrap ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
      >
        {label}
        <span className="text-[10px] opacity-70">{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}
