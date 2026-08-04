import { describe, expect, it } from 'vitest'
import { initialTripDayIndex, localDateKey } from './mobileDay'

describe('initial mobile trip day',()=>{
  const days=['2026-07-18','2026-07-19','2026-07-22','2026-08-01']

  it('opens the current itinerary day during the travel window',()=>{
    expect(initialTripDayIndex(days,'2026-07-19')).toBe(1)
  })

  it('opens the next scheduled entry when today has no items',()=>{
    expect(initialTripDayIndex(days,'2026-07-20')).toBe(2)
  })

  it('keeps the first day selected outside the travel window',()=>{
    expect(initialTripDayIndex(days,'2026-07-17')).toBe(0)
    expect(initialTripDayIndex(days,'2026-08-02')).toBe(0)
  })

  it('formats the device-local calendar date',()=>{
    expect(localDateKey(new Date(2026,6,9,23,30))).toBe('2026-07-09')
  })
})
