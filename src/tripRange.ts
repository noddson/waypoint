import { TripItem } from './types'

const utcDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)
const minutesOfDay = (value: string) => {
  const [hours = 0, minutes = 0] = value.slice(11, 16).split(':').map(Number)
  return hours * 60 + minutes
}

const dateTimeParts = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  return {year:Number(year),month:Number(month),day:Number(day),hour:Number(hour),minute:Number(minute)}
}

const zonedTime = (value: string, timeZone: string) => {
  const parts = dateTimeParts(value)
  if (!parts) return Number.NaN
  const wanted = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  let instant = wanted
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit',
      hourCycle:'h23',
    })
    // Re-evaluate once so changes in UTC offset near daylight-saving boundaries settle correctly.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const actual = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]))
      const displayed = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute))
      instant += wanted - displayed
    }
    return instant
  } catch {
    return Number.NaN
  }
}

const flightDurationMinutes = (flight: TripItem) => {
  if (flight.durationMinutes !== undefined) return flight.durationMinutes
  if (!flight.end) return 0
  const start = zonedTime(flight.start, flight.timeZone)
  const end = zonedTime(flight.end, flight.endTimeZone || flight.timeZone)
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return Math.round((end - start) / 60_000)
  return 0
}

const travelBoundaryDates = (items: TripItem[]) => {
  const flights = items.filter(item => item.type === 'flight')
  if (!flights.length) return new Set<string>()

  const dates = new Set<string>()
  // A boundary is a trip day once at least half of it is spent in the location reached by that flight.
  const minimumNewLocationMinutes = 24 * 60 * 0.5

  const flightsWithArrival = flights.filter((flight): flight is TripItem & {end:string} => !!flight.end)
  if (flightsWithArrival.length) {
    const firstFlight = flightsWithArrival.reduce((first, flight) => flight.start < first.start ? flight : first)
    const lastFlight = flightsWithArrival.reduce((last, flight) => flight.end > last.end ? flight : last)

    const departureDate = firstFlight.start.slice(0, 10)
    const outboundDestinationMinutes = firstFlight.end.slice(0, 10) === departureDate ? 24 * 60 - minutesOfDay(firstFlight.end) : 0
    if (outboundDestinationMinutes < minimumNewLocationMinutes) dates.add(departureDate)

    const returnDate = lastFlight.end.slice(0, 10)
    const returnNewLocationMinutes = 24 * 60 - minutesOfDay(lastFlight.end)
    if (returnNewLocationMinutes < minimumNewLocationMinutes) dates.add(returnDate)
  }

  const flightMinutesByDate = new Map<string, number>()
  for (const flight of flights) {
    const date = flight.start.slice(0, 10)
    flightMinutesByDate.set(date, (flightMinutesByDate.get(date) || 0) + flightDurationMinutes(flight))
  }
  for (const [date, flightMinutes] of flightMinutesByDate) {
    if (flightMinutes > minimumNewLocationMinutes) dates.add(date)
  }

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
