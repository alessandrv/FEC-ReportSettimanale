'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  Card,
  Chip,
  EmptyState,
  Label,
  ListBox,
  ListBoxItem,
  Select,
  Skeleton,
  toast,
} from '@heroui/react'
import { Users } from 'lucide-react'
import { Visit } from '@/lib/types'
import { WeekRef } from '@/lib/week'
import { jsonFetcher } from '@/lib/json-fetcher'
import { VisitDayGroups } from '@/components/visit-day-groups'

interface AdminPanelProps {
  week: WeekRef
}

interface CommercialeGroup {
  id: string
  name: string
  visits: Visit[]
}

const ALL_COMMERCIALI = 'all'

function groupByCommerciale(visits: Visit[]): CommercialeGroup[] {
  const groups = new Map<string, CommercialeGroup>()

  for (const visit of visits) {
    const group = groups.get(visit.userId) ?? {
      id: visit.userId,
      name: visit.userName ?? visit.userEmail ?? visit.userId,
      visits: [],
    }

    group.visits.push(visit)
    groups.set(visit.userId, group)
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'it')
  )
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <Card className="w-full">
      <Card.Content className="py-4 text-center">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </Card.Content>
    </Card>
  )
}

export function AdminPanel({ week }: AdminPanelProps) {
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [selectedCommerciale, setSelectedCommerciale] = useState<string>(ALL_COMMERCIALI)

  const load = useCallback(async () => {
    try {
      const data = await jsonFetcher<Visit[]>(
        `/api/visits?action=all&year=${week.year}&week=${week.week}`
      )
      setVisits(data)
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : 'Errore nel caricamento dei report'
      )
      setVisits([])
    }
  }, [week.year, week.week])

  useEffect(() => {
    setVisits(null)
    setSelectedCommerciale(ALL_COMMERCIALI)
    void load()
  }, [load])

  const groups = useMemo(() => (visits ? groupByCommerciale(visits) : []), [visits])

  const distinctClients = useMemo(
    () =>
      visits
        ? new Set(visits.map((visit) => visit.clientName.toLowerCase())).size
        : 0,
    [visits]
  )

  const visibleGroups =
    selectedCommerciale === ALL_COMMERCIALI
      ? groups
      : groups.filter((group) => group.id === selectedCommerciale)

  if (visits === null) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile value={visits.length} label="Visite" />
        <StatTile value={groups.length} label="Commerciali" />
        <StatTile value={distinctClients} label="Clienti" />
      </div>

      <Card className="w-full">
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Card.Title>Report per commerciale</Card.Title>
            <Card.Description>
              Visite raggruppate per giorno della settimana.
            </Card.Description>
          </div>
          {groups.length > 1 && (
            <Select
              aria-label="Filtra per commerciale"
              className="w-full sm:w-56"
              selectedKey={selectedCommerciale}
              onSelectionChange={(key) => {
                if (key != null) {
                  setSelectedCommerciale(String(key))
                }
              }}
            >
              <Label className="sr-only">Commerciale</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBoxItem id={ALL_COMMERCIALI} textValue="Tutti i commerciali">
                    Tutti i commerciali
                  </ListBoxItem>
                  {groups.map((group) => (
                    <ListBoxItem key={group.id} id={group.id} textValue={group.name}>
                      {group.name}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </Card.Header>
        <Card.Content>
          {visibleGroups.length === 0 && (
            <EmptyState className="py-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted" />
              <p className="text-sm text-muted">
                Nessun report inviato per questa settimana.
              </p>
            </EmptyState>
          )}

          {visibleGroups.length > 0 && (
            <Accordion
              allowsMultipleExpanded
              variant="surface"
              className="w-full"
              defaultExpandedKeys={
                visibleGroups.length === 1 ? [visibleGroups[0].id] : []
              }
            >
              {visibleGroups.map((group) => (
                <Accordion.Item key={group.id} id={group.id}>
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="truncate font-medium">{group.name}</span>
                        <Chip size="sm" variant="soft" color="accent">
                          {group.visits.length === 1
                            ? '1 visita'
                            : `${group.visits.length} visite`}
                        </Chip>
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                      <VisitDayGroups visits={group.visits} />
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
