'use client'

import { useEffect, useMemo, useState } from 'react'
import { ComboBox, Input, ListBox, ListBoxItem, Spinner } from '@heroui/react'
import { Client } from '@/lib/types'
import { jsonFetcher } from '@/lib/json-fetcher'

interface ClientComboboxProps {
  value: string
  onValueChange: (clientName: string, clientId?: string) => void
  isDisabled?: boolean
}

const MAX_RESULTS = 50

// The whole client directory is fetched once and shared across every mount of
// this component (there is normally one, but this guards remounts too).
let allClientsPromise: Promise<Client[]> | null = null
function loadAllClients(): Promise<Client[]> {
  if (!allClientsPromise) {
    allClientsPromise = jsonFetcher<Client[]>('/api/clients').catch((error) => {
      allClientsPromise = null
      throw error
    })
  }
  return allClientsPromise
}

/**
 * Searchable "cliente visitato" field. The full directory (from Skyline) is
 * loaded once on mount and filtered locally, so typing is instant. Free text
 * is allowed for clients not in the directory.
 */
export function ClientCombobox({ value, onValueChange, isDisabled }: ClientComboboxProps) {
  const [clients, setClients] = useState<Client[] | null>(null)

  useEffect(() => {
    let cancelled = false

    loadAllClients()
      .then((list) => {
        if (!cancelled) setClients(list)
      })
      .catch(() => {
        // Directory unavailable — fall back to free-text entry.
        if (!cancelled) setClients([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const loading = clients === null

  const results = useMemo(() => {
    if (!clients) return []

    const query = value.trim().toLowerCase()
    const matches = query
      ? clients.filter((client) => client.name.toLowerCase().includes(query))
      : clients

    return matches.slice(0, MAX_RESULTS)
  }, [clients, value])

  return (
    <ComboBox
      aria-label="Cliente visitato"
      fullWidth
      allowsCustomValue
      allowsEmptyCollection
      menuTrigger="focus"
      isDisabled={isDisabled}
      items={results}
      inputValue={value}
      onInputChange={onValueChange}
      onSelectionChange={(key) => {
        if (key == null) return
        const selected = clients?.find((client) => client.id === String(key))
        if (selected) {
          onValueChange(selected.name, selected.id)
        }
      }}
    >
      <ComboBox.InputGroup>
        <Input placeholder={loading ? 'Caricamento clienti…' : 'Cerca cliente…'} />
        {loading ? <Spinner size="sm" /> : <ComboBox.Trigger />}
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox<Client>
          renderEmptyState={() => (
            <div className="px-3 py-2 text-sm text-muted">
              {loading
                ? 'Caricamento clienti…'
                : 'Nessun cliente trovato: puoi inserirlo manualmente'}
            </div>
          )}
        >
          {(client) => (
            <ListBoxItem id={client.id} textValue={client.name}>
              <div className="flex flex-col">
                <span>{client.name}</span>
                {client.city && (
                  <span className="text-xs text-muted">{client.city}</span>
                )}
              </div>
            </ListBoxItem>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  )
}
