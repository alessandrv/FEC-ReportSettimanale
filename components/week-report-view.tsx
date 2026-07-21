'use client'

import { Button, Card, Chip, EmptyState, Skeleton } from '@heroui/react'
import { CalendarPlus, Send, Trash2, X } from 'lucide-react'
import { QuickAddVisit, NewVisitDraft } from '@/components/quick-add-visit'
import { WeekRef, formatDayHeading } from '@/lib/week'

export interface DisplayVisit {
  key: string
  clientName: string
  notes?: string
  date: string
  isDraft: boolean
  visitId?: string
}

export interface DayGroup {
  date: string
  visits: DisplayVisit[]
}

interface WeekReportViewProps {
  week: WeekRef
  groups: DayGroup[]
  isLoading: boolean
  totalCount: number
  draftCount: number
  submitting: boolean
  onAdd: (draft: NewVisitDraft) => void
  onRemoveDraft: (key: string) => void
  onDeleteSaved: (visit: DisplayVisit) => void
  onSubmit: () => void
}

export function WeekReportView({
  week,
  groups,
  isLoading,
  totalCount,
  draftCount,
  submitting,
  onAdd,
  onRemoveDraft,
  onDeleteSaved,
  onSubmit,
}: WeekReportViewProps) {
  return (
    <div className="space-y-4 pb-24">
      <Card className="w-full">
        <Card.Header className="pb-3">
          <Card.Title>Aggiungi visita</Card.Title>
        </Card.Header>
        <Card.Content>
          <QuickAddVisit week={week} onAdd={onAdd} isDisabled={submitting} />
        </Card.Content>
      </Card>

      <Card className="w-full">
        <Card.Header className="flex flex-row items-center justify-between gap-3 pb-3">
          <Card.Title>La settimana</Card.Title>
          {isLoading ? null : totalCount === 0 ? (
            <span className="text-sm text-muted">Vuota</span>
          ) : (
            <span className="text-sm text-muted">
              {totalCount} {totalCount === 1 ? 'visita' : 'visite'}
            </span>
          )}
        </Card.Header>

        <Card.Content className="space-y-5">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <EmptyState className="py-10 text-center">
              <CalendarPlus className="mx-auto mb-3 h-9 w-9 text-muted" />
              <p className="text-sm text-muted">
                Nessuna visita in questa settimana.
                <br />
                Aggiungi la prima qui sopra.
              </p>
            </EmptyState>
          )}

          {!isLoading &&
            groups.map((group) => (
              <section key={group.date}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{formatDayHeading(group.date)}</h3>
                  <Chip size="sm" variant="soft">
                    {group.visits.length}
                  </Chip>
                </div>
                <div className="divide-y divide-separator overflow-hidden rounded-2xl border border-border">
                  {group.visits.map((visit) => (
                    <div
                      key={visit.key}
                      className="flex items-center justify-between gap-2 bg-surface px-3 py-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{visit.clientName}</p>
                          {visit.notes && (
                            <p className="truncate text-xs text-muted">{visit.notes}</p>
                          )}
                        </div>
                        {visit.isDraft && (
                          <Chip size="sm" color="warning" variant="soft">
                            da inviare
                          </Chip>
                        )}
                      </div>
                      {visit.isDraft ? (
                        <Button
                          variant="ghost"
                          isIconOnly
                          aria-label={`Rimuovi ${visit.clientName}`}
                          isDisabled={submitting}
                          onPress={() => onRemoveDraft(visit.key)}
                          className="h-11 w-11 shrink-0"
                        >
                          <X className="h-5 w-5 text-muted" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          isIconOnly
                          aria-label={`Elimina ${visit.clientName}`}
                          onPress={() => onDeleteSaved(visit)}
                          className="h-11 w-11 shrink-0"
                        >
                          <Trash2 className="h-5 w-5 text-muted" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </Card.Content>
      </Card>

      {draftCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 p-4 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              isPending={submitting}
              onPress={onSubmit}
              className="h-12"
            >
              <Send className="mr-2 h-4 w-4" />
              Invia report ({draftCount})
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
