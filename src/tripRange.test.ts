import { describe, expect, it } from 'vitest'
import { TripItem } from './types'
import { formatTripRange } from './tripRange'

const item = (id: string, start: string, end?: string): TripItem => ({id,type:'plan',title:id,start,end,timeZone:'UTC',status:'planned'})
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

  it('counts a morning return as a trip day when at least half the date is spent in the new location', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      item('stay','2026-07-19T15:00','2026-07-31T11:00'),
      flight('return','2026-08-01T09:20','2026-08-01T11:25'),
    ])
    expect(label).toContain('15 days total')
    expect(label).toContain('14 trip days')
    expect(label).toContain('1 travel day')
  })

  it('does not classify flights between destinations as outer travel days', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      {...flight('internal','2026-07-24T10:00','2026-07-24T11:10'),timeZone:'Europe/Dublin',endTimeZone:'Europe/London'},
      {...flight('return','2026-08-01T09:20','2026-08-01T11:25'),timeZone:'Europe/London',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('14 trip days')
    expect(label).toContain('1 travel day')
  })

  it('keeps a late return date as a travel day when less than half is spent in the new location', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      flight('return','2026-08-01T20:00','2026-08-01T22:00'),
    ])
    expect(label).toContain('13 trip days')
    expect(label).toContain('2 travel days')
  })

  it('counts a same-day arrival as a trip day at the exact 50% threshold', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T06:00','2026-07-18T12:00'),
      flight('return','2026-08-01T20:00','2026-08-01T22:00'),
    ])
    expect(label).toContain('14 trip days')
    expect(label).toContain('1 travel day')
  })

  it('classifies an internal date with more than 12 hours of flights as a travel day', () => {
    const label = formatTripRange([
      timedFlight('outbound','2026-07-18T06:00','2026-07-18T08:00',120),
      timedFlight('leg-one','2026-07-20T05:00','2026-07-20T11:40',400),
      timedFlight('leg-two','2026-07-20T13:00','2026-07-20T18:30',330),
      {...timedFlight('return','2026-07-22T06:00','2026-07-22T08:00',120),timeZone:'Europe/Dublin',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('5 days total')
    expect(label).toContain('4 trip days')
    expect(label).toContain('1 travel day')
  })

  it('does not classify exactly 12 hours of flights as more than half the day', () => {
    const label = formatTripRange([
      timedFlight('outbound','2026-07-18T06:00','2026-07-18T08:00',120),
      timedFlight('leg-one','2026-07-20T05:00','2026-07-20T11:30',390),
      timedFlight('leg-two','2026-07-20T13:00','2026-07-20T18:30',330),
      {...timedFlight('return','2026-07-22T06:00','2026-07-22T08:00',120),timeZone:'Europe/Dublin',endTimeZone:'America/Toronto'},
    ])
    expect(label).toContain('5 days')
    expect(label).not.toContain('travel day')
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
      item('arrival-plan','2026-07-19T10:00'),
    ])
    expect(label).toContain('2 days total')
    expect(label).toContain('1 trip day')
    expect(label).toContain('1 travel day')
  })
})
