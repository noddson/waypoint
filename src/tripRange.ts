import { TripItem } from './types'

const utcDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)

export function formatTripRange(items: TripItem[]) {
  if (!items.length) return 'No trip dates yet'

  const first = items.reduce((earliest, item) => item.start < earliest ? item.start : earliest, items[0].start)
  const last = items.reduce((latest, item) => {
    const itemLast = item.end || item.start
    return itemLast > latest ? itemLast : latest
  }, items[0].end || items[0].start)
  const firstDate = utcDate(first)
  const lastDate = utcDate(last)
  const durationDays = Math.round((lastDate.getTime() - firstDate.getTime()) / 86_400_000) + 1
  const sameYear = firstDate.getUTCFullYear() === lastDate.getUTCFullYear()
  const startLabel = new Intl.DateTimeFormat(undefined, {timeZone:'UTC',month:'short',day:'numeric',year:sameYear?undefined:'numeric'}).format(firstDate)
  const endLabel = new Intl.DateTimeFormat(undefined, {timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(lastDate)

  return `${startLabel} – ${endLabel} · ${durationDays} ${durationDays === 1 ? 'day' : 'days'}`
}
