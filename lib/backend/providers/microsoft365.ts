import { z } from 'zod'
import { CreateVisitInput, Employee, Visit } from '@/lib/types'
import { ListVisitsFilters, ReportBackend } from '@/lib/backend/types'

interface GraphListItem {
  id: string
  createdDateTime?: string
  fields?: Record<string, unknown>
}

interface GraphCollection<T> {
  value: T[]
  '@odata.nextLink'?: string
}

const configSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  sharePointHostname: z.string().min(1),
  sharePointSitePath: z.string().min(1),
  siteId: z.string().min(1).optional(),
  visitsListId: z.string().min(1),
  employeesListId: z.string().min(1).optional(),
})

type Microsoft365Config = z.infer<typeof configSchema>

interface CachedToken {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, CachedToken>()
let resolvedSiteId: string | null = null

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getConfig(): Microsoft365Config {
  const parsed = configSchema.safeParse({
    tenantId: process.env.MICROSOFT365_TENANT_ID,
    clientId: process.env.MICROSOFT365_CLIENT_ID,
    clientSecret: process.env.MICROSOFT365_CLIENT_SECRET,
    sharePointHostname: process.env.MICROSOFT365_SHAREPOINT_HOSTNAME,
    sharePointSitePath: process.env.MICROSOFT365_SHAREPOINT_SITE_PATH,
    siteId: normalizeOptionalEnv(process.env.MICROSOFT365_SITE_ID),
    visitsListId: process.env.MICROSOFT365_VISITS_LIST_ID,
    employeesListId: normalizeOptionalEnv(process.env.MICROSOFT365_EMPLOYEES_LIST_ID),
  })

  if (!parsed.success) {
    const missingKeys = parsed.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ')

    throw new Error(`Missing Microsoft 365 configuration: ${missingKeys}`)
  }

  return parsed.data
}

function normalizeSitePath(sitePath: string): string {
  return sitePath.replace(/^\/+/, '').replace(/\/+$/, '')
}

async function getAccessToken(scope: string): Promise<string> {
  const config = getConfig()
  const cacheKey = scope.toLowerCase()
  const cached = tokenCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'client_credentials',
        scope,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to acquire access token: ${await response.text()}`)
  }

  const data = (await response.json()) as {
    access_token: string
    expires_in: number
  }

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1_000,
  })

  return data.access_token
}

async function getGraphToken(): Promise<string> {
  return getAccessToken('https://graph.microsoft.com/.default')
}

async function graphRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getGraphToken()
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed: ${await response.text()}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return graphRequest(`https://graph.microsoft.com/v1.0${path}`, init)
}

async function graphFetchAll<T>(path: string): Promise<T[]> {
  let nextUrl = `https://graph.microsoft.com/v1.0${path}`
  const items: T[] = []

  while (nextUrl) {
    const page = await graphRequest<GraphCollection<T>>(nextUrl)
    items.push(...page.value)
    nextUrl = page['@odata.nextLink'] ?? ''
  }

  return items
}

async function getResolvedSiteId(): Promise<string> {
  const config = getConfig()

  if (config.siteId) {
    return config.siteId
  }

  if (resolvedSiteId) {
    return resolvedSiteId
  }

  const site = await graphFetch<{ id: string }>(
    `/sites/${config.sharePointHostname}:/${normalizeSitePath(config.sharePointSitePath)}`
  )

  resolvedSiteId = site.id
  return site.id
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (['true', '1', 'yes', 'si', 'sì'].includes(normalized)) {
      return true
    }

    if (['false', '0', 'no'].includes(normalized)) {
      return false
    }
  }

  return undefined
}

function normalizeEmail(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase()
}

function mapVisit(item: GraphListItem): Visit {
  const fields = item.fields ?? {}
  const date = asString(fields.VisitDate)?.slice(0, 10) ?? ''

  return {
    id: item.id,
    userId:
      asString(fields.EmployeeId) ??
      asString(fields.EmployeeEmail) ??
      asString(fields.EmployeeName) ??
      item.id,
    userName: asString(fields.EmployeeName),
    userEmail: asString(fields.EmployeeEmail),
    date,
    clientName: asString(fields.ClientName) ?? '',
    clientId: asString(fields.ClientId),
    notes: asString(fields.Notes),
    year: asNumber(fields.Year) ?? 0,
    week: asNumber(fields.Week) ?? 0,
    createdAt: item.createdDateTime ?? new Date().toISOString(),
  }
}

function mapEmployee(item: GraphListItem): Employee | null {
  const fields = item.fields ?? {}
  const name = asString(fields.Title)

  if (!name) {
    return null
  }

  return {
    id: asString(fields.EmployeeId) ?? asString(fields.Email) ?? item.id,
    name,
    email: asString(fields.Email),
    isActive: asBoolean(fields.IsActive) ?? true,
    isAdmin: asBoolean(fields.IsAdmin) ?? false,
  }
}

async function getVisitItem(visitId: string): Promise<Visit | null> {
  const config = getConfig()
  const siteId = await getResolvedSiteId()

  try {
    const item = await graphFetch<GraphListItem>(
      `/sites/${siteId}/lists/${config.visitsListId}/items/${visitId}?$expand=fields`
    )

    return mapVisit(item)
  } catch {
    return null
  }
}

async function listEmployeesFromMicrosoft365(): Promise<Employee[]> {
  const config = getConfig()

  if (!config.employeesListId) {
    return []
  }

  const siteId = await getResolvedSiteId()
  const items = await graphFetchAll<GraphListItem>(
    `/sites/${siteId}/lists/${config.employeesListId}/items?$expand=fields&$top=999`
  )

  return items
    .map(mapEmployee)
    .filter((employee): employee is Employee => Boolean(employee?.isActive))
}

async function createVisitItem(input: CreateVisitInput): Promise<Visit> {
  const config = getConfig()
  const siteId = await getResolvedSiteId()
  const createdItem = await graphFetch<GraphListItem>(
    `/sites/${siteId}/lists/${config.visitsListId}/items`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          Title: `${input.userName ?? input.userId} - ${input.date} - ${input.clientName}`,
          EmployeeId: input.userId,
          EmployeeName: input.userName ?? input.userId,
          EmployeeEmail: input.userEmail ?? '',
          VisitDate: input.date,
          Year: String(input.year),
          Week: String(input.week),
          ClientName: input.clientName,
          ClientId: input.clientId ?? '',
          Notes: input.notes ?? '',
        },
      }),
    }
  )

  const visit = await getVisitItem(createdItem.id)

  if (!visit) {
    throw new Error('Visit was created but could not be reloaded from Microsoft Lists')
  }

  return visit
}

export const microsoft365Backend: ReportBackend = {
  async getVisit(id) {
    return getVisitItem(id)
  },

  async listVisits(filters = {}) {
    const config = getConfig()
    const siteId = await getResolvedSiteId()
    const items = await graphFetchAll<GraphListItem>(
      `/sites/${siteId}/lists/${config.visitsListId}/items?$expand=fields&$top=999`
    )

    return items
      .map(mapVisit)
      .filter((visit) => {
        if (filters.userId && visit.userId !== filters.userId) {
          return false
        }

        if (typeof filters.year === 'number' && visit.year !== filters.year) {
          return false
        }

        if (typeof filters.week === 'number' && visit.week !== filters.week) {
          return false
        }

        return true
      })
      .sort((left, right) => left.date.localeCompare(right.date))
  },

  async createVisits(inputs) {
    const created: Visit[] = []

    for (const input of inputs) {
      created.push(await createVisitItem(input))
    }

    return created
  },

  async deleteVisit(id) {
    const config = getConfig()
    const siteId = await getResolvedSiteId()
    await graphFetch<void>(
      `/sites/${siteId}/lists/${config.visitsListId}/items/${id}`,
      { method: 'DELETE' }
    )
    return true
  },

  async isAdminEmail(email) {
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail) {
      return false
    }

    const employees = await listEmployeesFromMicrosoft365()
    return employees.some((employee) => {
      return employee.isAdmin === true && normalizeEmail(employee.email) === normalizedEmail
    })
  },
}
