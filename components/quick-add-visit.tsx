'use client'

import { useState } from 'react'
import { Button, Input, toast } from '@heroui/react'
import { Plus } from 'lucide-react'
import { ClientCombobox } from '@/components/client-combobox'
import { DayPickerPills } from '@/components/day-picker-pills'
import { WeekRef, defaultDayForWeek } from '@/lib/week'

export interface NewVisitDraft {
  clientName: string
  clientId?: string
  date: string
  notes?: string
}

interface QuickAddVisitProps {
  week: WeekRef
  onAdd: (draft: NewVisitDraft) => void
  isDisabled?: boolean
}

/**
 * Top-of-screen quick entry: search a client, pick the day of the week,
 * optional note, add. Keeps the selected day after adding so several
 * visits on the same day go fast. The parent remounts this per week
 * (via key), so the day resets sensibly when the week changes.
 */
export function QuickAddVisit({ week, onAdd, isDisabled }: QuickAddVisitProps) {
  const [clientName, setClientName] = useState('')
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState(() => defaultDayForWeek(week))
  const [note, setNote] = useState('')

  const add = () => {
    if (!clientName.trim()) {
      toast.warning('Seleziona o scrivi un cliente')
      return
    }

    onAdd({
      clientName: clientName.trim(),
      clientId,
      date,
      notes: note.trim() || undefined,
    })

    // Reset the client + note, keep the day for fast same-day entry.
    setClientName('')
    setClientId(undefined)
    setNote('')
  }

  return (
    <div className="space-y-3">
      <ClientCombobox
        value={clientName}
        isDisabled={isDisabled}
        onValueChange={(name, id) => {
          setClientName(name)
          setClientId(id)
        }}
      />

      <DayPickerPills week={week} value={date} onChange={setDate} isDisabled={isDisabled} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Note visita"
          placeholder="Note (facoltative)"
          fullWidth
          value={note}
          disabled={isDisabled}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          variant="primary"
          isDisabled={isDisabled || !clientName.trim()}
          onPress={add}
          className="h-11 w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi
        </Button>
      </div>
    </div>
  )
}
