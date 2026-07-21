import { ReportBackend } from '@/lib/backend/types'
import { memoryBackend } from '@/lib/backend/providers/memory'
import { microsoft365Backend } from '@/lib/backend/providers/microsoft365'

function getBackendProviderName(): string {
  return (process.env.REPORTS_BACKEND_PROVIDER ?? 'memory').toLowerCase()
}

export function getReportBackend(): ReportBackend {
  const providerName = getBackendProviderName()

  if (providerName === 'microsoft365') {
    return microsoft365Backend
  }

  return memoryBackend
}
