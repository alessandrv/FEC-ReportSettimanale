import { NextResponse } from 'next/server'
import { getClientDirectory } from '@/lib/clients/provider'
import { getSessionUser } from '@/lib/session-user'

export async function GET() {
  try {
    const currentUser = await getSessionUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clients = await getClientDirectory().listClients()

    // The full directory is loaded once and filtered client-side. Allow a short
    // browser cache so a reload within the window skips the round-trip.
    return NextResponse.json(clients, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (error) {
    // The client field also accepts free text, so a directory outage should
    // not block reporting — surface the error but let the UI fall back.
    const message = error instanceof Error ? error.message : 'Failed to load clients'
    console.error('[api/clients]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
