import { auth } from '@/auth'

export interface SessionUser {
  email?: string
  id: string
  isAdmin: boolean
  name: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const user = session?.user

  if (!user?.id) {
    return null
  }

  return {
    email: user.email ?? undefined,
    id: user.id,
    isAdmin: Boolean(user.isAdmin),
    name: user.name ?? user.email ?? user.id,
  }
}