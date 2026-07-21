import { randomUUID } from 'crypto'
import { Visit } from '@/lib/types'
import { ListVisitsFilters, ReportBackend } from '@/lib/backend/types'

const visits = new Map<string, Visit>()

function matchesFilters(visit: Visit, filters: ListVisitsFilters): boolean {
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
}

export const memoryBackend: ReportBackend = {
  async getVisit(id) {
    return visits.get(id) ?? null
  },

  async listVisits(filters = {}) {
    return Array.from(visits.values())
      .filter((visit) => matchesFilters(visit, filters))
      .sort((left, right) => left.date.localeCompare(right.date))
  },

  async createVisits(inputs) {
    return inputs.map((input) => {
      const visit: Visit = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      }

      visits.set(visit.id, visit)
      return visit
    })
  },

  async deleteVisit(id) {
    return visits.delete(id)
  },

  async isAdminEmail(email) {
    void email
    return false
  },
}
