import { TripItem } from './types'

const utcDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)
const minutesOfDay = (value: string) => {
  const [hours = 0, minutes = 0] = value.slice(11, 16).split(':').map(Number)
  return hours * 60 + minutes
}

const travelBoundaryDates = (items: TripItem[]) => {
  const flights = items.filter(item => item.type === 'flight' && item.end)
  if (!flights.length) return new Set<string>()

  const firstFlight = flights.reduce((first, flight) => flight.start < first.start ? flight : first)
  const lastFlight = flights.reduce((last, flight) => flight.end! > last.end! ? flight : last)
  const dates = new Set<string>()
  // A boundary is a trip day once at least half of it is spent in the location reached by that flight.
  const minimumNewLocationMinutes = 24 * 60 * 0.5

  const departureDate = firstFlight.start.slice(0, 10)
  const outboundDestinationMinutes = firstFlight.end!.slice(0, 10) === departureDate ? 24 * 60 - minutesOfDay(firstFlight.end!) : 0
  if (outboundDestinationMinutes < minimumNewLocationMinutes) dates.add(departureDate)

  const returnDate = lastFlight.end!.slice(0, 10)
  const returnNewLocationMinutes = 24 * 60 - minutesOfDay(lastFlight.end!)
  if (returnNewLocationMinutes < minimumNewLocationMinutes) dates.add(returnDate)

  return dates
}

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
  const travelDays = travelBoundaryDates(items).size
  const tripDays = Math.max(durationDays - travelDays, 0)
  const durationLabel = travelDays
    ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'} total · ${tripDays} trip ${tripDays === 1 ? 'day' : 'days'} · ${travelDays} travel ${travelDays === 1 ? 'day' : 'days'}`
    : `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`

  return `${startLabel} – ${endLabel} · ${durationLabel}`
}
