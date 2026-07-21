import {
  addDays,
  addWeeks,
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfISOWeek,
} from 'date-fns'
import { it } from 'date-fns/locale'

export interface WeekRef {
  /** ISO week-numbering year */
  year: number
  /** ISO week number (1-53) */
  week: number
  /** Monday of the week */
  start: Date
  /** Sunday of the week */
  end: Date
}

export function weekFromDate(date: Date): WeekRef {
  const start = startOfISOWeek(date)

  return {
    year: getISOWeekYear(date),
    week: getISOWeek(date),
    start,
    end: endOfISOWeek(date),
  }
}

export function currentWeek(): WeekRef {
  return weekFromDate(new Date())
}

export function shiftWeek(week: WeekRef, offset: number): WeekRef {
  return weekFromDate(addWeeks(week.start, offset))
}

export function weekOfIsoDate(isoDate: string): { year: number; week: number } {
  const parsed = parseISO(isoDate)

  return {
    year: getISOWeekYear(parsed),
    week: getISOWeek(parsed),
  }
}

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatWeekRange(week: WeekRef): string {
  const sameMonth = week.start.getMonth() === week.end.getMonth()
  const startLabel = format(week.start, sameMonth ? 'd' : 'd MMMM', { locale: it })
  const endLabel = format(week.end, 'd MMMM yyyy', { locale: it })

  return `dal ${startLabel} al ${endLabel}`
}

export function formatVisitDate(isoDate: string): string {
  return format(parseISO(isoDate), 'EEEE d MMMM', { locale: it })
}

export function formatDayHeading(isoDate: string): string {
  const label = formatVisitDate(isoDate)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export interface WeekDay {
  /** ISO date yyyy-MM-dd */
  iso: string
  /** short weekday label, e.g. "lun" */
  label: string
  /** day-of-month, e.g. "21" */
  dayNumber: string
  /** true when this day is today */
  isToday: boolean
}

export function weekDays(week: WeekRef): WeekDay[] {
  const todayIso = toIsoDate(new Date())

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(week.start, index)
    const iso = toIsoDate(day)

    return {
      iso,
      label: format(day, 'EEE', { locale: it }),
      dayNumber: format(day, 'd'),
      isToday: iso === todayIso,
    }
  })
}

/** Default day to preselect for a week: today if inside the week, else Monday. */
export function defaultDayForWeek(week: WeekRef): string {
  const today = new Date()

  if (today >= week.start && today <= week.end) {
    return toIsoDate(today)
  }

  return toIsoDate(week.start)
}
