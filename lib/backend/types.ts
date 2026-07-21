import { CreateVisitInput, Visit } from '@/lib/types'

export interface ListVisitsFilters {
  userId?: string
  year?: number
  week?: number
}

export interface ReportBackend {
  getVisit(id: string): Promise<Visit | null>
  listVisits(filters?: ListVisitsFilters): Promise<Visit[]>
  createVisits(inputs: CreateVisitInput[]): Promise<Visit[]>
  deleteVisit(id: string): Promise<boolean>
  isAdminEmail(email: string): Promise<boolean>
}
