'use client'

import { Button, Chip } from '@heroui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WeekRef, formatWeekRange } from '@/lib/week'

interface WeekNavigatorProps {
  week: WeekRef
  onShift: (offset: number) => void
  /** Disable navigating into future weeks (default true) */
  allowFuture?: boolean
  isCurrentWeek: boolean
}

export function WeekNavigator({ week, onShift, allowFuture = false, isCurrentWeek }: WeekNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
      <Button
        variant="ghost"
        isIconOnly
        aria-label="Settimana precedente"
        onPress={() => onShift(-1)}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          Settimana {week.week}
          {isCurrentWeek && (
            <Chip size="sm" color="accent" variant="soft">
              corrente
            </Chip>
          )}
        </p>
        <p className="text-xs text-muted">{formatWeekRange(week)}</p>
      </div>
      <Button
        variant="ghost"
        isIconOnly
        aria-label="Settimana successiva"
        isDisabled={!allowFuture && isCurrentWeek}
        onPress={() => onShift(1)}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
