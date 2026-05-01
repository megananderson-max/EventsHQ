'use client'

import { useState, useRef } from 'react'

interface TooltipProps {
  text: string
  children?: React.ReactNode
  /** If true, render a small ⓘ icon as the trigger */
  icon?: boolean
  /** Tooltip position. Default: 'top' */
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ text, children, icon = false, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (timer.current) clearTimeout(timer.current)
    setVisible(true)
  }
  const hide = () => {
    timer.current = setTimeout(() => setVisible(false), 100)
  }

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span className="relative inline-flex items-center" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {icon ? (
        <span className="w-3.5 h-3.5 rounded-full border border-gray-400 text-gray-400 inline-flex items-center justify-center text-[9px] font-bold cursor-help select-none leading-none">
          i
        </span>
      ) : children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 ${positionClasses[position]} w-max max-w-[220px] bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
