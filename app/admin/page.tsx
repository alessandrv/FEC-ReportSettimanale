'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button, Card, Spinner } from '@heroui/react'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { AdminPanel } from '@/components/admin-panel'
import { TeamsSso } from '@/components/teams-sso'
import { WeekNavigator } from '@/components/week-navigator'
import { currentWeek, shiftWeek } from '@/lib/week'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [weekOffset, setWeekOffset] = useState(0)

  const week = useMemo(() => shiftWeek(currentWeek(), weekOffset), [weekOffset])
  const isAdmin = Boolean(session?.user?.isAdmin)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <TeamsSso />
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!session?.user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <TeamsSso />
        <Card className="w-full max-w-md">
          <Card.Header className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary">
              <ShieldAlert className="h-8 w-8 text-muted" />
            </div>
            <Card.Title>Accesso riservato</Card.Title>
            <Card.Description>
              La consultazione dei report è riservata ai responsabili.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Link href="/" className="block">
              <Button variant="secondary" fullWidth>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna al report
              </Button>
            </Link>
          </Card.Content>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" isIconOnly aria-label="Torna al report">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">Consultazione report</h1>
              <p className="truncate text-sm text-muted">
                Visite di tutti i commerciali
              </p>
            </div>
          </div>
        </div>

        <WeekNavigator
          week={week}
          isCurrentWeek={weekOffset === 0}
          allowFuture={false}
          onShift={(offset) => setWeekOffset((value) => Math.min(value + offset, 0))}
        />

        <AdminPanel week={week} />
      </div>
    </div>
  )
}
