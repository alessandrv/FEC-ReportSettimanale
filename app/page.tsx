'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { Button, Card, Spinner } from '@heroui/react'
import { Building2, ClipboardList, LogOut } from 'lucide-react'
import { TeamsSso } from '@/components/teams-sso'
import { WeekNavigator } from '@/components/week-navigator'
import { WeekReport } from '@/components/week-report'
import { currentWeek, shiftWeek } from '@/lib/week'

export default function Home() {
  const { data: session, status } = useSession()
  const [weekOffset, setWeekOffset] = useState(0)

  const week = useMemo(() => shiftWeek(currentWeek(), weekOffset), [weekOffset])

  const userName = session?.user?.name ?? session?.user?.email ?? 'Utente'
  const firstName = userName.split(' ')[0] || userName
  const isAdmin = Boolean(session?.user?.isAdmin)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <TeamsSso />
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <TeamsSso />
        <Card className="w-full max-w-md">
          <Card.Header className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary">
              <Building2 className="h-8 w-8 text-foreground" />
            </div>
            <Card.Title className="text-2xl">Report Settimanale</Card.Title>
            <Card.Description>
              Accedi con il tuo account aziendale Fec Italia per continuare.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Button
              variant="primary"
              fullWidth
              onPress={() => signIn('microsoft-entra-id')}
            >
              Accedi con Microsoft 365
            </Button>
          </Card.Content>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">Report settimanale</h1>
            <p className="truncate text-sm text-muted">Visite di {firstName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin && (
              <Link href="/admin">
                <Button variant="secondary" aria-label="Consultazione report" className="h-11 px-3">
                  <ClipboardList className="h-5 w-5" />
                  <span className="ml-2 hidden sm:inline">Consultazione</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              aria-label="Esci"
              className="h-11 px-3"
              onPress={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="h-5 w-5" />
              <span className="ml-2 hidden sm:inline">Esci</span>
            </Button>
          </div>
        </header>

        <WeekNavigator
          week={week}
          isCurrentWeek={weekOffset === 0}
          allowFuture={false}
          onShift={(offset) => setWeekOffset((value) => Math.min(value + offset, 0))}
        />

        <WeekReport week={week} />
      </div>
    </div>
  )
}
