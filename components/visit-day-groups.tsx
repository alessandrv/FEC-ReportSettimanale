'use client'

import { Button, Chip } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { Visit } from '@/lib/types'
import { formatDayHeading } from '@/lib/week'

interface VisitDayGroupsProps {
  visits: Visit[]
  onDelete?: (visit: Visit) => void
}

/**
 * Visits of a week grouped by day (Monday → Sunday), rendered as a
 * day heading with the visited clients beneath. Shared between the
 * personal report and the admin consultation view.
 */
export function VisitDayGroups({ visits, onDelete }: VisitDayGroupsProps) {
  const groups = new Map<string, Visit[]>()

  const sorted = [...visits].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.clientName.localeCompare(right.clientName, 'it')
  )

  for (const visit of sorted) {
    const dayVisits = groups.get(visit.date) ?? []
    dayVisits.push(visit)
    groups.set(visit.date, dayVisits)
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([date, dayVisits]) => (
        <section key={date}>
          <div className="mb-1.5 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{formatDayHeading(date)}</h3>
            <Chip size="sm" variant="soft">
              {dayVisits.length === 1 ? '1 visita' : `${dayVisits.length} visite`}
            </Chip>
          </div>
          <div className="divide-y divide-separator overflow-hidden rounded-xl border border-border">
            {dayVisits.map((visit) => (
              <div
                key={visit.id}
                className="flex items-center justify-between gap-3 bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{visit.clientName}</p>
                  {visit.notes && (
                    <p className="truncate text-xs text-muted">{visit.notes}</p>
                  )}
                </div>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label={`Elimina visita ${visit.clientName}`}
                    onPress={() => onDelete(visit)}
                  >
                    <Trash2 className="h-4 w-4 text-muted" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
