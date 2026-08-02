import { describe, expect, it } from 'vitest'
import { TripItem } from './types'
import { formatTripRange } from './tripRange'

const item = (id: string, start: string, end?: string): TripItem => ({id,type:'plan',title:id,start,end,timeZone:'UTC',status:'planned'})

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
})
