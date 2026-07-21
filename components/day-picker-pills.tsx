'use client'

import { cn } from '@heroui/react'
import { WeekRef, weekDays } from '@/lib/week'

interface DayPickerPillsProps {
  week: WeekRef
  value: string
  onChange: (isoDate: string) => void
  isDisabled?: boolean
}

/** Segmented Mon→Sun selector for the visible week (fits any width via 7-col grid). */
export function DayPickerPills({ week, value, onChange, isDisabled }: DayPickerPillsProps) {
  const days = weekDays(week)

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const selected = day.iso === value

        return (
          <button
            key={day.iso}
            type="button"
            disabled={isDisabled}
            aria-pressed={selected}
            aria-label={`${day.label} ${day.dayNumber}`}
            onClick={() => onChange(day.iso)}
            className={cn(
              'flex min-w-0 flex-col items-center rounded-xl py-2 transition-colors',
              selected
                ? 'bg-accent text-accent-foreground'
                : 'bg-surface-secondary text-foreground hover:bg-surface-tertiary',
              !selected && day.isToday && 'ring-1 ring-inset ring-accent/50',
              isDisabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <span className="text-[10px] font-medium uppercase leading-none">
              {day.label}
            </span>
            <span className="mt-0.5 text-sm font-semibold leading-none">
              {day.dayNumber}
            </span>
          </button>
        )
      })}
    </div>
  )
}
