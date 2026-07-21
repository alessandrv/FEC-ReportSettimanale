'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertDialog, Button, toast } from '@heroui/react'
import { Visit } from '@/lib/types'
import { WeekRef, formatVisitDate } from '@/lib/week'
import { jsonFetcher } from '@/lib/json-fetcher'
import { NewVisitDraft } from '@/components/quick-add-visit'
import {
  DayGroup,
  DisplayVisit,
  WeekReportView,
} from '@/components/week-report-view'

interface WeekReportProps {
  week: WeekRef
}

interface DraftVisit extends NewVisitDraft {
  key: string
}

let draftKeyCounter = 0
function nextDraftKey(): string {
  draftKeyCounter += 1
  return `draft-${draftKeyCounter}`
}

function groupByDay(visits: DisplayVisit[]): DayGroup[] {
  const groups = new Map<string, DisplayVisit[]>()

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

  return Array.from(groups.entries()).map(([date, dayVisits]) => ({
    date,
    visits: dayVisits,
  }))
}

export function WeekReport({ week }: WeekReportProps) {
  const weekKey = `${week.year}-${week.week}`

  const [saved, setSaved] = useState<Visit[] | null>(null)
  const [draftsByWeek, setDraftsByWeek] = useState<Record<string, DraftVisit[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DisplayVisit | null>(null)
  const [deleting, setDeleting] = useState(false)

  const drafts = draftsByWeek[weekKey] ?? []

  const load = useCallback(async () => {
    try {
      const data = await jsonFetcher<Visit[]>(
        `/api/visits?year=${week.year}&week=${week.week}`
      )
      setSaved(data)
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : 'Errore nel caricamento delle visite'
      )
      setSaved([])
    }
  }, [week.year, week.week])

  useEffect(() => {
    setSaved(null)
    void load()
  }, [load])

  const addDraft = (draft: NewVisitDraft) => {
    setDraftsByWeek((prev) => ({
      ...prev,
      [weekKey]: [...(prev[weekKey] ?? []), { ...draft, key: nextDraftKey() }],
    }))
  }

  const removeDraft = (key: string) => {
    setDraftsByWeek((prev) => ({
      ...prev,
      [weekKey]: (prev[weekKey] ?? []).filter((draft) => draft.key !== key),
    }))
  }

  const groups = useMemo(() => {
    const savedItems: DisplayVisit[] = (saved ?? []).map((visit) => ({
      key: `saved-${visit.id}`,
      clientName: visit.clientName,
      notes: visit.notes,
      date: visit.date,
      isDraft: false,
      visitId: visit.id,
    }))

    const draftItems: DisplayVisit[] = drafts.map((draft) => ({
      key: draft.key,
      clientName: draft.clientName,
      notes: draft.notes,
      date: draft.date,
      isDraft: true,
    }))

    return groupByDay([...savedItems, ...draftItems])
  }, [saved, drafts])

  const submit = async () => {
    if (drafts.length === 0) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visits: drafts.map((draft) => ({
            date: draft.date,
            clientName: draft.clientName,
            clientId: draft.clientId,
            notes: draft.notes,
          })),
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? "Errore durante l'invio del report")
      }

      toast.success(
        drafts.length === 1 ? 'Visita inviata' : `${drafts.length} visite inviate`
      )
      setDraftsByWeek((prev) => ({ ...prev, [weekKey]: [] }))
      await load()
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "Errore durante l'invio")
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteSaved = async () => {
    if (!pendingDelete?.visitId) {
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`/api/visits/${pendingDelete.visitId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? 'Errore durante la cancellazione')
      }

      toast.success('Visita eliminata')
      setPendingDelete(null)
      await load()
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Errore durante la cancellazione')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <WeekReportView
        week={week}
        groups={groups}
        isLoading={saved === null}
        totalCount={(saved?.length ?? 0) + drafts.length}
        draftCount={drafts.length}
        submitting={submitting}
        onAdd={addDraft}
        onRemoveDraft={removeDraft}
        onDeleteSaved={setPendingDelete}
        onSubmit={submit}
      />

      <AlertDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog aria-label="Conferma eliminazione">
              <AlertDialog.Header>
                <AlertDialog.Heading>Eliminare la visita?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  {pendingDelete
                    ? `${pendingDelete.clientName} — ${formatVisitDate(pendingDelete.date)}`
                    : ''}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="ghost"
                  isDisabled={deleting}
                  onPress={() => setPendingDelete(null)}
                >
                  Annulla
                </Button>
                <Button variant="danger" isPending={deleting} onPress={confirmDeleteSaved}>
                  Elimina
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  )
}
