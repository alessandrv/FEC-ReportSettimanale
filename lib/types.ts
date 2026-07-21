export interface Visit {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  /** ISO date (yyyy-MM-dd) of the visit */
  date: string
  clientName: string
  /** Id of the client in the client directory, when picked from search results */
  clientId?: string
  notes?: string
  /** ISO week-numbering year the visit belongs to */
  year: number
  /** ISO week number (1-53) the visit belongs to */
  week: number
  createdAt: string
}

export interface Client {
  id: string
  name: string
  city?: string
}

export interface Employee {
  id: string
  name: string
  email?: string
  isActive: boolean
  isAdmin?: boolean
}

export interface CreateVisitInput {
  userId: string
  userName?: string
  userEmail?: string
  date: string
  clientName: string
  clientId?: string
  notes?: string
  year: number
  week: number
}
