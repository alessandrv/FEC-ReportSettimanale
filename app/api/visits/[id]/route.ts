import { NextRequest, NextResponse } from 'next/server'
import { getReportBackend } from '@/lib/backend/provider'
import { getSessionUser } from '@/lib/session-user'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const backend = getReportBackend()
    const currentUser = await getSessionUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const visit = await backend.getVisit(id)

    if (!visit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!currentUser.isAdmin && visit.userId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await backend.deleteVisit(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
