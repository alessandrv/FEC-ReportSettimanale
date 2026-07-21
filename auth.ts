import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { getReportBackend } from '@/lib/backend/provider'

function getEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim()

    if (value) {
      return value
    }
  }

  return undefined
}

function normalizeIssuer(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, '')
}

function normalizeEmail(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  return value.trim().toLowerCase()
}

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.AUTH_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email))
  )
}

interface CachedAdminLookup {
  expiresAt: number
  isAdmin: boolean
}

function logAuthError(error: Error): void {
  const authError = error as Error & {
    cause?: unknown
    type?: string
  }

  console.error(
    '[auth][error]',
    authError.type ?? authError.name,
    authError.message
  )

  if (authError.cause) {
    console.error('[auth][cause]', JSON.stringify(authError.cause, null, 2))
    return
  }

  if (authError.stack) {
    console.error(authError.stack.replace(/.*/, '').substring(1))
  }
}

const adminEmails = getAdminEmails()
const adminLookupCache = new Map<string, CachedAdminLookup>()
const tenantId = getEnvValue('MICROSOFT365_TENANT_ID')
const authClientId = getEnvValue(
  'AUTH_MICROSOFT_ENTRA_ID_ID',
  'MICROSOFT365_CLIENT_ID'
)
const authClientSecret = getEnvValue(
  'AUTH_MICROSOFT_ENTRA_ID_SECRET',
  'MICROSOFT365_CLIENT_SECRET'
)
const authIssuer =
  normalizeIssuer(getEnvValue('AUTH_MICROSOFT_ENTRA_ID_ISSUER')) ??
  (tenantId
    ? `https://login.microsoftonline.com/${tenantId}/v2.0`
    : undefined)

async function resolveAdminStatus(email: string | undefined): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    return false
  }

  if (adminEmails.has(normalizedEmail)) {
    return true
  }

  const cached = adminLookupCache.get(normalizedEmail)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.isAdmin
  }

  try {
    const isAdmin = await getReportBackend().isAdminEmail(normalizedEmail)

    adminLookupCache.set(normalizedEmail, {
      expiresAt: Date.now() + 60_000,
      isAdmin,
    })

    return isAdmin
  } catch (error) {
    console.error(
      '[auth][admin-lookup]',
      error instanceof Error ? error.message : 'Failed to resolve admin status'
    )

    return false
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    getEnvValue('AUTH_SECRET') ??
    getEnvValue('MICROSOFT365_CLIENT_SECRET') ??
    'change-me-in-production',
  logger: {
    error(error) {
      logAuthError(error)
    },
  },
  session: {
    strategy: 'jwt',
  },
  // Teams embeds the app in an iframe — SameSite=Lax cookies are blocked,
  // which causes the CSRF check to fail. SameSite=None; Secure fixes this.
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: true },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: { sameSite: 'none', path: '/', secure: true },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: true },
    },
  },
  providers: [
    Credentials({
      id: 'teams-sso',
      name: 'Teams SSO',
      credentials: {
        teamsToken: { type: 'text' },
      },
      async authorize(credentials) {
        const teamsToken = credentials?.teamsToken as string | undefined
        if (!teamsToken) return null

        try {
          // Exchange the Teams SSO token for a Graph access token via OBO flow
          const params = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            client_id: authClientId ?? '',
            client_secret: authClientSecret ?? '',
            assertion: teamsToken,
            scope: 'https://graph.microsoft.com/User.Read',
            requested_token_use: 'on_behalf_of',
          })

          const tokenResp = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
            }
          )

          if (!tokenResp.ok) {
            console.error('[teams-sso] OBO exchange failed', await tokenResp.text())
            return null
          }

          const { access_token } = await tokenResp.json() as { access_token: string }

          // Fetch the user profile from Microsoft Graph
          const meResp = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${access_token}` },
          })

          if (!meResp.ok) {
            console.error('[teams-sso] Graph /me failed', await meResp.text())
            return null
          }

          const me = await meResp.json() as {
            id: string
            displayName?: string
            userPrincipalName?: string
            mail?: string
          }

          const email = (me.userPrincipalName ?? me.mail ?? '').toLowerCase()
          return { id: me.id, name: me.displayName ?? email, email }
        } catch (error) {
          console.error('[teams-sso] authorize error', error)
          return null
        }
      },
    }),
    MicrosoftEntraID({
      clientId: authClientId ?? '',
      clientSecret: authClientSecret ?? '',
      issuer: authIssuer,
      client: {
        token_endpoint_auth_method: 'client_secret_post',
      },
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, profile, user }) {
      if (profile) {
        const microsoftProfile = profile as {
          email?: string
          name?: string
          oid?: string
          preferred_username?: string
          sub?: string
          upn?: string
        }

        token.userId = microsoftProfile.oid ?? microsoftProfile.sub
        token.userName = microsoftProfile.name ?? token.name ?? undefined
        token.userEmail =
          normalizeEmail(microsoftProfile.email) ??
          normalizeEmail(microsoftProfile.preferred_username) ??
          normalizeEmail(microsoftProfile.upn) ??
          normalizeEmail(token.email)
      } else if (user && !token.userId) {
        // Teams SSO credentials flow — only runs on initial JWT creation
        token.userId = user.id
        token.userName = user.name ?? ''
        token.userEmail = normalizeEmail(user.email)
      }

      token.isAdmin = await resolveAdminStatus(token.userEmail as string | undefined)
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? '')
        session.user.name = String(token.userName ?? session.user.name ?? '')
        session.user.email = normalizeEmail(String(token.userEmail ?? session.user.email ?? '')) ?? ''
        session.user.isAdmin = Boolean(token.isAdmin)
      }

      return session
    },
  },
})