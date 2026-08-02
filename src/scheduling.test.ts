import { describe, expect, it } from 'vitest'
import { isAirCanadaCheckInOpen, zonedDateTimeEpoch } from './checkin'
import { sortTripItems, TripItem } from './types'

describe('scheduling helpers', () => {
  it('sorts rows explicitly by date and then time', () => {
    const make = (id:string,start:string,allDay=false):TripItem => ({id,type:'event',title:id,start,timeZone:'Europe/Dublin',status:'confirmed',allDay})
    const sorted = sortTripItems([
      make('late','2026-07-28T18:00'),
      make('next day','2026-07-29T08:00'),
      make('early','2026-07-28T09:00'),
      make('unspecified','2026-07-28T12:00',true),
    ])
    expect(sorted.map(item=>item.id)).toEqual(['early','unspecified','late','next day'])
  })

  it('opens Air Canada check-in only during the 24-hour window in the departure time zone', () => {
    const flight:TripItem = {id:'ac',type:'flight',title:'Toronto → Dublin',provider:'Air Canada',confirmation:'ABC123',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed'}
    const departure = zonedDateTimeEpoch(flight.start,flight.timeZone)
    expect(new Date(departure).toISOString()).toBe('2026-07-19T00:50:00.000Z')
    expect(isAirCanadaCheckInOpen(flight,departure-24*60*60*1000-1)).toBe(false)
    expect(isAirCanadaCheckInOpen(flight,departure-24*60*60*1000)).toBe(true)
    expect(isAirCanadaCheckInOpen(flight,departure)).toBe(false)
  })
})
