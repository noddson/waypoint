import { TripItem } from './types'
import { currentLanguage, languageMetadata, LanguageCode, uiMessage, uiText } from './i18n'

const utcDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)
const dateBounds = (items: TripItem[]) => items.length ? {
  first:items.reduce((earliest, item) => item.start < earliest ? item.start : earliest, items[0].start),
  last:items.reduce((latest, item) => {
    const itemLast = item.end || item.start
    return itemLast > latest ? itemLast : latest
  }, items[0].end || items[0].start),
} : undefined
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

type CompleteFlight = TripItem & {end:string}

const flightStartTime = (flight: CompleteFlight) => zonedTime(flight.start, flight.timeZone)
const flightEndTime = (flight: CompleteFlight) => zonedTime(flight.end, flight.endTimeZone || flight.timeZone)

const connectedFlightChains = (flights: CompleteFlight[]) => {
  const connectionLimit = 18 * 60 * 60_000
  const ordered = [...flights].sort((a, b) => {
    const difference = flightStartTime(a) - flightStartTime(b)
    return Number.isFinite(difference) ? difference : a.start.localeCompare(b.start)
  })
  const chains: CompleteFlight[][] = []

  for (const flight of ordered) {
    const chain = chains[chains.length - 1]
    const previous = chain?.[chain.length - 1]
    if (chain && previous) {
      const connectionTime = flightStartTime(flight) - flightEndTime(previous)
      if (Number.isFinite(connectionTime) && connectionTime >= 0 && connectionTime <= connectionLimit) {
        chain.push(flight)
        continue
      }
    }
    chains.push([flight])
  }

  return chains
}

const awakeStartMinutes = 8 * 60
const awakeEndMinutes = 23 * 60
const minimumUsableMinutes = (awakeEndMinutes - awakeStartMinutes) * 0.5

const usableMinutesAfter = (value: string) => {
  const arrivalMinutes = minutesOfDay(value)
  return Math.max(awakeEndMinutes - Math.max(arrivalMinutes, awakeStartMinutes), 0)
}

const usableMinutesBefore = (value: string) => {
  const departureMinutes = minutesOfDay(value)
  return Math.max(Math.min(departureMinutes, awakeEndMinutes) - awakeStartMinutes, 0)
}

const travelBoundaryDates = (items: TripItem[]) => {
  const flights = items.filter(item => item.type === 'flight')
  if (!flights.length) return new Set<string>()

  const dates = new Set<string>()
  const flightsWithArrival = flights.filter((flight): flight is TripItem & {end:string} => !!flight.end)
  const tripDates = new Set<string>()
  const chains = connectedFlightChains(flightsWithArrival)
  const outbound = chains[0]
  if (outbound) {
    const firstFlight = outbound[0]
    const finalFlight = outbound[outbound.length - 1]
    const departureDate = firstFlight.start.slice(0, 10)
    const arrivalDate = finalFlight.end.slice(0, 10)
    if (usableMinutesAfter(finalFlight.end) > minimumUsableMinutes) tripDates.add(arrivalDate)
    else dates.add(arrivalDate)
    if (departureDate !== arrivalDate) dates.add(departureDate)
  }

  const returning = chains.length > 1 ? chains[chains.length - 1] : undefined
  if (returning) {
    const firstFlight = returning[0]
    const finalFlight = returning[returning.length - 1]
    const departureDate = firstFlight.start.slice(0, 10)
    const homeArrivalDate = finalFlight.end.slice(0, 10)
    if (usableMinutesBefore(firstFlight.start) > minimumUsableMinutes) tripDates.add(departureDate)
    else dates.add(departureDate)
    // A date spent back at home is not a viable day at the trip destination.
    if (homeArrivalDate !== departureDate) dates.add(homeArrivalDate)
  }

  const flightMinutesByDate = new Map<string, number>()
  for (const flight of flights) {
    const date = flight.start.slice(0, 10)
    flightMinutesByDate.set(date, (flightMinutesByDate.get(date) || 0) + flightDurationMinutes(flight))
  }
  for (const [date, flightMinutes] of flightMinutesByDate) {
    if (flightMinutes > minimumUsableMinutes && !tripDates.has(date)) dates.add(date)
  }

  for (const date of tripDates) dates.delete(date)

  return dates
}

export function formatTravelDateRange(first?:string, last?:string, language:LanguageCode=currentLanguage()) {
  if (!first || !last) return uiText('No trip dates yet',language)

  const firstDate = utcDate(first)
  const lastDate = utcDate(last)
  const sameYear = firstDate.getUTCFullYear() === lastDate.getUTCFullYear()
  const locale=languageMetadata[language].locale
  const startLabel = new Intl.DateTimeFormat(locale, {timeZone:'UTC',month:'short',day:'numeric',year:sameYear?undefined:'numeric'}).format(firstDate)
  const endLabel = new Intl.DateTimeFormat(locale, {timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(lastDate)
  return first.slice(0,10) === last.slice(0,10) ? endLabel : `${startLabel} – ${endLabel}`
}

export function formatTripDateRange(items: TripItem[],language:LanguageCode=currentLanguage()) {
  const bounds = dateBounds(items)
  return formatTravelDateRange(bounds?.first, bounds?.last,language)
}

export function formatTripRange(items: TripItem[],language:LanguageCode=currentLanguage()) {
  const bounds = dateBounds(items)
  if (!bounds) return uiText('No trip dates yet',language)

  const firstDate = utcDate(bounds.first)
  const lastDate = utcDate(bounds.last)
  const durationDays = Math.round((lastDate.getTime() - firstDate.getTime()) / 86_400_000) + 1
  const sameYear = firstDate.getUTCFullYear() === lastDate.getUTCFullYear()
  const locale=languageMetadata[language].locale
  const startLabel = new Intl.DateTimeFormat(locale, {timeZone:'UTC',month:'short',day:'numeric',year:sameYear?undefined:'numeric'}).format(firstDate)
  const endLabel = new Intl.DateTimeFormat(locale, {timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(lastDate)
  const travelDays = travelBoundaryDates(items).size
  const tripDays = Math.max(durationDays - travelDays, 0)
  const count=(value:number,singular:string,plural:string)=>uiMessage(value===1?singular:plural,language,{count:value})
  const durationLabel = travelDays
    ? `${count(durationDays,'{count} day total','{count} days total')} · ${count(tripDays,'{count} trip day','{count} trip days')} · ${count(travelDays,'{count} travel day','{count} travel days')}`
    : count(durationDays,'{count} day','{count} days')

  return `${startLabel} – ${endLabel} · ${durationLabel}`
}
