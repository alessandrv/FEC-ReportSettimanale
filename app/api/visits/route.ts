import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getReportBackend } from '@/lib/backend/provider'
import { getSessionUser } from '@/lib/session-user'
import { weekOfIsoDate } from '@/lib/week'

const createVisitsSchema = z.object({
  visits: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
        clientName: z.string().trim().min(1).max(255),
        clientId: z.string().trim().max(255).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
    )
    .min(1)
    .max(50),
})

export async function GET(request: NextRequest) {
  const backend = getReportBackend()
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('userId')
  const year = searchParams.get('year')
  const week = searchParams.get('week')
  const action = searchParams.get('action')

  try {
    const currentUser = await getSessionUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!year || !week) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const filters = {
      year: Number.parseInt(year, 10),
      week: Number.parseInt(week, 10),
    }

    if (action === 'all') {
      if (!currentUser.isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      return NextResponse.json(await backend.listVisits(filters))
    }

    const scopedUserId = currentUser.isAdmin
      ? (userId ?? currentUser.id)
      : currentUser.id

    return NextResponse.json(
      await backend.listVisits({ ...filters, userId: scopedUserId })
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load visits'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const backend = getReportBackend()
    const currentUser = await getSessionUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = createVisitsSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const visits = await backend.createVisits(
      parsed.data.visits.map((visit) => ({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        date: visit.date,
        clientName: visit.clientName,
        clientId: visit.clientId,
        notes: visit.notes,
        ...weekOfIsoDate(visit.date),
      }))
    )

    return NextResponse.json(visits)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create visits'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
