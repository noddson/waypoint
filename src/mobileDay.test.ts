import { describe, expect, it } from 'vitest'
import { initialTripDayIndex, initialTripEntryIndex, localDateKey, tripEntryIndexAfterSwipe } from './mobileDay'

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

describe('landscape mobile trip entry',()=>{
  const starts=['2026-07-18T09:00','2026-07-18T14:00','2026-07-19T08:30','2026-07-22T11:00']

  it('opens the first entry on the current or next itinerary day',()=>{
    expect(initialTripEntryIndex(starts,'2026-07-18')).toBe(0)
    expect(initialTripEntryIndex(starts,'2026-07-19')).toBe(2)
    expect(initialTripEntryIndex(starts,'2026-07-20')).toBe(3)
  })

  it('keeps the first entry selected outside the travel window',()=>{
    expect(initialTripEntryIndex(starts,'2026-07-17')).toBe(0)
    expect(initialTripEntryIndex(starts,'2026-07-23')).toBe(0)
  })

  it('moves right through the flat entry sequence, including into the next day',()=>{
    expect(tripEntryIndexAfterSwipe(0,80,starts.length)).toBe(1)
    expect(tripEntryIndexAfterSwipe(1,80,starts.length)).toBe(2)
  })

  it('moves left backward and stops at both ends',()=>{
    expect(tripEntryIndexAfterSwipe(2,-80,starts.length)).toBe(1)
    expect(tripEntryIndexAfterSwipe(0,-80,starts.length)).toBe(0)
    expect(tripEntryIndexAfterSwipe(starts.length-1,80,starts.length)).toBe(starts.length-1)
  })
})
