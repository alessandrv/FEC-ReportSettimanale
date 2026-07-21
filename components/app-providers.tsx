'use client'

import { ReactNode } from 'react'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider, ToastProvider } from '@heroui/react'

interface AppProvidersProps {
  children: ReactNode
  session: Session | null
}

export function AppProviders({ children, session }: AppProvidersProps) {
  return (
    <SessionProvider session={session}>
      <I18nProvider locale="it-IT">
        {children}
        <ToastProvider placement="bottom end" />
      </I18nProvider>
    </SessionProvider>
  )
}
