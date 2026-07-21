'use client'

import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { Spinner } from '@heroui/react'
import { getTeamsInitPromise } from '@/lib/teams'

/**
 * While running inside Microsoft Teams, silently signs the user in via
 * Teams SSO (OBO flow) so no login screen is ever shown.
 *
 * While the attempt is in flight it renders a full-screen spinner so the
 * login card cannot be seen. If SSO fails (not in Teams, Azure not configured,
 * consent required) the spinner disappears and the normal login card shows.
 */
export function TeamsSso() {
  const { status } = useSession()
  // true while we are actively attempting SSO
  const [trying, setTrying] = useState(true)

  useEffect(() => {
    // Always kick off Teams initialization so the result is cached for other
    // features (camera etc.) even when the user is already authenticated.
    getTeamsInitPromise()

    // Only attempt once, when we know the session is absent
    if (status === 'loading') return

    if (status !== 'unauthenticated') {
      setTrying(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        console.log('[TeamsSso] starting SSO attempt, status:', status)
        const { authentication } = await import('@microsoft/teams-js')

        // Use shared init promise (5 s timeout, result cached for reuse by camera etc.)
        const inTeams = await getTeamsInitPromise()
        if (!inTeams) throw new Error('Not in Teams host')
        console.log('[TeamsSso] app.initialize() succeeded')

        // Confirm we have a real Teams context (user + tenant)
        const { app } = await import('@microsoft/teams-js')
        const context = await app.getContext()
        console.log('[TeamsSso] context:', JSON.stringify(context?.user))
        if (!context?.user?.tenant?.id) throw new Error('No Teams context / tenant id')
        if (cancelled) return

        // Request an SSO token for our app's API audience
        console.log('[TeamsSso] requesting auth token...')
        const teamsToken = await authentication.getAuthToken()
        console.log('[TeamsSso] got teamsToken, length:', teamsToken?.length)
        if (cancelled) return

        const result = await signIn('teams-sso', {
          teamsToken,
          redirect: false,
        })
        console.log('[TeamsSso] signIn result:', JSON.stringify(result))

        if (result?.ok && !result?.error) {
          // Reload so the session is picked up by the server
          window.location.reload()
          return
        }

        if (result?.error) {
          console.error('[TeamsSso] signIn error:', result.error)
        }
      } catch (err) {
        console.error('[TeamsSso] SSO failed:', err)
      }

      if (!cancelled) setTrying(false)
    })()

    return () => {
      cancelled = true
    }
  }, [status])

  if (trying) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return null
}
