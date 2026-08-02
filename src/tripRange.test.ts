import { describe, expect, it } from 'vitest'
import { TripItem } from './types'
import { formatTripRange } from './tripRange'

const item = (id: string, start: string, end?: string): TripItem => ({id,type:'plan',title:id,start,end,timeZone:'UTC',status:'planned'})
const flight = (id: string, start: string, end: string): TripItem => ({...item(id,start,end),type:'flight',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin'})

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

  it('separates overnight departure and morning return dates from trip days', () => {
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

  it('counts a late return date as a trip day when at least 75% is spent at the destination', () => {
    const label = formatTripRange([
      flight('outbound','2026-07-18T20:50','2026-07-19T08:15'),
      flight('return','2026-08-01T20:00','2026-08-01T22:00'),
    ])
    expect(label).toContain('14 trip days')
    expect(label).toContain('1 travel day')
  })
})
