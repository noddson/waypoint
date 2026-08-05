import { describe, expect, it } from 'vitest'
import { googleFlightStatusUrl, isAirCanadaCheckInOpen, isAirlineCheckInOpen, isFlightStatusWindowOpen, zonedDateTimeEpoch } from './checkin'
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

  it('uses the same check-in window for a mapped WestJet flight code', () => {
    const flight:TripItem = {id:'ws',type:'flight',title:'Toronto → Calgary',provider:'WestJet',flightNumber:'WS 665',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed'}
    const departure = zonedDateTimeEpoch(flight.start,flight.timeZone)
    expect(isAirlineCheckInOpen(flight,departure-24*60*60*1000-1)).toBe(false)
    expect(isAirlineCheckInOpen(flight,departure-24*60*60*1000)).toBe(true)
    expect(isAirlineCheckInOpen(flight,departure)).toBe(false)
  })

  it('links to Google flight status from 12 hours before departure through arrival', () => {
    const flight:TripItem = {id:'ac800',type:'flight',title:'Toronto → Dublin',provider:'Air Canada',flightNumber:'AC800',start:'2026-08-04T20:50',end:'2026-08-05T08:25',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin',status:'confirmed'}
    const departure=zonedDateTimeEpoch(flight.start,flight.timeZone)
    const arrival=zonedDateTimeEpoch(flight.end!,flight.endTimeZone!)
    expect(new Date(departure).toISOString()).toBe('2026-08-05T00:50:00.000Z')
    expect(new Date(arrival).toISOString()).toBe('2026-08-05T07:25:00.000Z')
    expect(googleFlightStatusUrl(flight)).toBe('https://www.google.com/search?q=AC800+flight+status')
    expect(isFlightStatusWindowOpen(flight,departure-12*60*60*1000-1)).toBe(false)
    expect(isFlightStatusWindowOpen(flight,departure-12*60*60*1000)).toBe(true)
    expect(isFlightStatusWindowOpen(flight,Date.parse('2026-08-05T00:06:00Z'))).toBe(true)
    expect(isFlightStatusWindowOpen(flight,departure)).toBe(true)
    expect(isFlightStatusWindowOpen(flight,arrival)).toBe(false)
  })

  it('requires a flight number before offering flight status', () => {
    const flight:TripItem = {id:'unknown',type:'flight',title:'Toronto → Dublin',provider:'Air Canada',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed'}
    expect(googleFlightStatusUrl(flight)).toBeUndefined()
    expect(isFlightStatusWindowOpen(flight,zonedDateTimeEpoch(flight.start,flight.timeZone))).toBe(false)
  })

  it('keeps flight status available for 12 hours after departure when arrival is missing', () => {
    const flight:TripItem = {id:'ac',type:'flight',title:'Toronto → Dublin',flightNumber:'AC 800',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed'}
    const departure=zonedDateTimeEpoch(flight.start,flight.timeZone)
    expect(isFlightStatusWindowOpen(flight,departure+12*60*60*1000-1)).toBe(true)
    expect(isFlightStatusWindowOpen(flight,departure+12*60*60*1000)).toBe(false)
  })
})
