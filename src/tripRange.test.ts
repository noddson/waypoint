import { describe, expect, it } from 'vitest'
import { TripItem } from './types'
import { formatTripRange } from './tripRange'

const item = (id: string, start: string, end?: string): TripItem => ({id,type:'event',title:id,start,end,timeZone:'UTC',status:'planned'})
const flight = (id: string, start: string, end: string): TripItem => ({...item(id,start,end),type:'flight',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin'})
const timedFlight = (id: string, start: string, end: string, durationMinutes: number): TripItem => ({...flight(id,start,end),durationMinutes})

describe('trip date range', () => {
  it('uses the earliest start and latest end regardless of item order', () => {
    const label = formatTripRange([
      item('middle', '2026-07-22T10:00'),
      item('last', '2026-08-01T08:00', '2026-08-01T11:25'),
      item('first', '2026-07-18T20:50', '2026-07-19T08:15'),
    ])
    expect(label).toMatch(/Jul 18/)
    expect(label).toMatch(/Aug 1, 2026/)
    expect(label).toContain('15 days')
  })

  it('uses a one-day duration for one item without an end', () => {
    expect(formatTripRange([item('visit', '2026-07-28T12:00')])).toContain('1 day')
  })

  it('handles a trip with no recorded items', () => {
    expect(formatTripRange([])).toBe('No trip dates yet')
  })

  it('counts an overnight outbound date and a home-return date as travel days', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      item('stay','2026-07-19T15:00','2026-07-31T11:00'),
      flight('return','2026-08-01T09:20','2026-08-01T11:25'),
    ])
    expect(label).toContain('15 days total')
    expect(label).toContain('13 trip days')
    expect(label).toContain('2 travel days')
  })

  it('does not classify flights between destinations as outer travel days', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      {...flight('internal','2026-07-24T10:00','2026-07-24T11:10'),timeZone:'Europe/Dublin',endTimeZone:'Europe/London'},
      {...flight('return','2026-08-01T09:20','2026-08-01T11:25'),timeZone:'Europe/London',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('13 trip days')
    expect(label).toContain('2 travel days')
  })

  it('keeps a late return departure as a trip day when most awake hours were at the destination', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      flight('return','2026-08-01T20:00','2026-08-01T22:00'),
    ])
    expect(label).toContain('14 trip days')
    expect(label).toContain('1 travel day')
  })

  it('counts an arrival with more than half the awake window remaining as a trip day', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T06:00','2026-07-18T12:00'),
      flight('return','2026-08-01T20:00','2026-08-01T22:00'),
    ])
    expect(label).toContain('15 days')
    expect(label).not.toContain('travel day')
  })

  it('classifies an internal date with more than half the awake window in flights as a travel day', () => {
    const label = formatTripRange([
      timedFlight('outbound','2026-07-18T06:00','2026-07-18T08:00',120),
      timedFlight('leg-one','2026-07-20T05:00','2026-07-20T11:40',400),
      timedFlight('leg-two','2026-07-20T13:00','2026-07-20T18:30',330),
      {...timedFlight('return','2026-07-22T06:00','2026-07-22T08:00',120),timeZone:'Europe/Dublin',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('5 days total')
    expect(label).toContain('3 trip days')
    expect(label).toContain('2 travel days')
  })

  it('does not classify exactly half the awake window in flights as more than half', () => {
    const label = formatTripRange([
      timedFlight('outbound','2026-07-18T06:00','2026-07-18T08:00',120),
      timedFlight('leg-one','2026-07-20T05:00','2026-07-20T11:30',225),
      timedFlight('leg-two','2026-07-20T13:00','2026-07-20T18:30',225),
      {...timedFlight('return','2026-07-22T06:00','2026-07-22T08:00',120),timeZone:'Europe/Dublin',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('5 days')
    expect(label).toContain('4 trip days')
    expect(label).toContain('1 travel day')
  })

  it('falls back to zoned timestamps when a flight duration is unavailable', () => {
    const label = formatTripRange([
      {...flight('long-flight','2026-07-18T05:00','2026-07-18T18:00'),timeZone:'UTC',endTimeZone:'UTC'},
      {...timedFlight('return','2026-07-19T06:00','2026-07-19T08:00',120),timeZone:'UTC',endTimeZone:'UTC'},
    ])
    expect(label).toContain('2 days total')
    expect(label).toContain('1 trip day')
    expect(label).toContain('1 travel day')
  })

  it('uses a known duration even when the arrival timestamp is missing', () => {
    const label = formatTripRange([
      {...item('long-flight','2026-07-18T05:00'),type:'flight',durationMinutes:721},
      item('arrival-event','2026-07-19T10:00'),
    ])
    expect(label).toContain('2 days total')
    expect(label).toContain('1 trip day')
    expect(label).toContain('1 travel day')
  })

  it('counts the New York arrival as usable and the same-day return home as travel', () => {
    const label = formatTripRange([
      {...timedFlight('outbound','2025-01-21T11:15','2025-01-21T12:55',100),timeZone:'America/Toronto',endTimeZone:'America/New_York'},
      item('stay','2025-01-21T15:00','2025-01-24T08:00'),
      {...timedFlight('return','2025-01-24T08:45','2025-01-24T10:29',104),timeZone:'America/New_York',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('4 days total')
    expect(label).toContain('3 trip days')
    expect(label).toContain('1 travel day')
  })

  it('counts a usable Hawaii arrival as a trip day and both return dates as travel', () => {
    const label = formatTripRange([
      {...timedFlight('outbound-one','2024-08-03T06:30','2024-08-03T07:51',141),timeZone:'America/Toronto',endTimeZone:'America/Chicago'},
      {...timedFlight('outbound-two','2024-08-03T10:35','2024-08-03T14:10',515),timeZone:'America/Chicago',endTimeZone:'Pacific/Honolulu'},
      {...timedFlight('return-one','2024-08-10T11:45','2024-08-10T20:00',315),timeZone:'Pacific/Honolulu',endTimeZone:'America/Los_Angeles'},
      {...timedFlight('return-two','2024-08-10T22:39','2024-08-11T06:38',299),timeZone:'America/Los_Angeles',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('9 days total')
    expect(label).toContain('7 trip days')
    expect(label).toContain('2 travel days')
  })
})
