import { describe, expect, it } from 'vitest'
import { alignBoardingPassesWithFlights, boardingPassForFlight, MAX_BOARDING_PASS_IMAGE_BYTES, validBoardingPass, validBoardingPassImage } from './boardingPass'
import { airlineCheckInUrl } from './airlineCheckIn'
import { isAirlineCheckInOpen } from './checkin'
import { createTripExport, migrateTripExport, validTripExport } from './tripImport'
import { parseTripItemsJson } from './itemJson'
import { validatedStoredTrip } from './storage'
import { buildTripCalendar } from './calendarExport'
import { tripRouteStops, tripGroundRouteSegments } from './destinations'
import { weatherPlansForItem } from './weather'
import { buildShareProjection, sharePolicyForPreset } from './sharePolicy'
import { sortTripItems, Trip, TripItem } from './types'

const flight:TripItem={id:'flight-1',type:'flight',title:'Flight to London',flightNumber:'AC 854',provider:'Air Canada',confirmation:'ABC123',passengerLastName:'Example',start:'2026-11-19T18:00',end:'2026-11-20T06:00',timeZone:'America/Toronto',endTimeZone:'Europe/London',location:'Toronto YYZ',endLocation:'London LHR',status:'confirmed'}
const png={name:'pass.png',mimeType:'image/png' as const,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvGQAAAAASUVORK5CYII='}
const pass:TripItem={...boardingPassForFlight(flight,'pass-1'),boardingPass:{url:'https://airline.example/pass/private-token',image:png},notes:'Seat 12A'}
const trip:Trip={id:'trip-1',name:'Trip',destination:'London',createdAt:'2026-11-18T12:00:00Z',updatedAt:'2026-11-18T12:00:00Z',items:[flight,pass]}

describe('personalized check-in links',()=>{
  it('uses the supplied Air Canada URL format and encodes booking data safely',()=>{
    const url=new URL(airlineCheckInUrl({...flight,passengerLastName:"D'Example & Co",confirmation:'AB+123'})!)
    expect(url.origin+url.pathname).toBe('https://checkin.aircanada.com/ac/ssci')
    expect(Object.fromEntries(url.searchParams)).toEqual({ln:'en-CA',orderId:'AB+123',lastName:"D'Example & Co"})
  })
  it('uses every known booking detail rather than dropping back to the generic Air Canada page',()=>{
    for(const passengerLastName of [undefined,' ']){
      const url=new URL(airlineCheckInUrl({...flight,passengerLastName})!)
      expect(url.origin+url.pathname).toBe('https://checkin.aircanada.com/ac/ssci')
      expect(url.searchParams.get('orderId')).toBe('ABC123')
      expect(url.searchParams.has('lastName')).toBe(false)
    }
    const surnameOnly=new URL(airlineCheckInUrl({...flight,confirmation:undefined})!)
    expect(surnameOnly.searchParams.get('lastName')).toBe('Example')
    expect(surnameOnly.searchParams.has('orderId')).toBe(false)
    expect(airlineCheckInUrl({...flight,confirmation:undefined,passengerLastName:undefined})).toBe('https://www.aircanada.com/home/ca/en/aco/checkin')
    expect(airlineCheckInUrl({...flight,flightNumber:'WS 1',provider:'WestJet'})).toBe('https://checkin.westjet.com')
  })
  it('enhances saved generic Air Canada links while preserving personalized links from the carrier',()=>{
    const generated=airlineCheckInUrl(flight)
    expect(airlineCheckInUrl({...flight,checkInUrl:'https://www.aircanada.com/home/ca/en/aco/checkin'})).toBe(generated)
    const carrierUrl='https://checkin.aircanada.com/ac/ssci?ln=en-CA&orderId=DEF456&lastName=Other'
    expect(airlineCheckInUrl({...flight,checkInUrl:carrierUrl})).toBe(carrierUrl)
    const suppliedPage='https://www.aircanada.com/home/ca/en/aco/checkin?orderId=DEF456&lastName=Other'
    expect(airlineCheckInUrl({...flight,checkInUrl:suppliedPage})).toBe(suppliedPage)
  })
  it('prefers an HTTPS link from the carrier and supports otherwise unknown airlines',()=>{
    const item={...flight,flightNumber:'ZZ 12',provider:'Example Airline',checkInUrl:'https://carrier.example/checkin?booking=example'}
    expect(airlineCheckInUrl(item)).toBe(item.checkInUrl)
    expect(isAirlineCheckInOpen(item,Date.parse('2026-11-19T12:00:00Z'))).toBe(true)
    expect(airlineCheckInUrl({...flight,checkInUrl:'javascript:alert(1)'})).toContain('https://checkin.aircanada.com/')
    expect(airlineCheckInUrl({...item,type:'stay'})).toBeUndefined()
  })
})

describe('boarding-pass data and migration',()=>{
  it('round-trips the image, URL, flight relationship, and check-in metadata in v3',()=>{
    const exported=createTripExport(trip,trip.updatedAt)
    expect(exported.schemaVersion).toBe(3)
    expect(migrateTripExport(JSON.parse(JSON.stringify(exported)))?.trip).toEqual(trip)
    expect(validatedStoredTrip({...trip,schemaVersion:3})).toEqual(trip)
    expect(exported.trip.items[1].boardingPass?.image).not.toBe(png)
  })
  it.each([1,2])('migrates v%s without changing existing itinerary data',schemaVersion=>{
    const {passengerLastName,...oldFlight}=flight,legacy={...trip,items:[oldFlight]}
    expect(migrateTripExport({schemaVersion,exportedAt:trip.updatedAt,trip:legacy})).toEqual({schemaVersion:3,exportedAt:trip.updatedAt,trip:legacy})
    expect(validatedStoredTrip({...legacy,...(schemaVersion===2?{schemaVersion}: {})})).toEqual(legacy)
  })
  it('does not accept new fields or item types in a v2 envelope or unknown future versions',()=>{
    expect(validTripExport({schemaVersion:2,exportedAt:trip.updatedAt,trip})).toBe(false)
    expect(migrateTripExport({schemaVersion:4,exportedAt:trip.updatedAt,trip})).toBeNull()
  })
  it('validates URL-only and image-only passes and rejects unsafe or oversized images',()=>{
    expect(validBoardingPass({url:'https://carrier.example/pass'})).toBe(true)
    expect(validBoardingPass({image:png})).toBe(true)
    for(const data of [{},{url:'javascript:alert(1)'},{url:'http://example.test'},{image:{...png,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}},{image:{...png,dataUrl:'data:image/png;base64,YWJjZA=='}},{image:{...png,dataUrl:png.dataUrl+'A'.repeat(MAX_BOARDING_PASS_IMAGE_BYTES*2)}}])expect(validBoardingPass(data)).toBe(false)
    expect(validBoardingPassImage({...png,unexpected:'secret'})).toBe(false)
    expect(validTripExport({schemaVersion:3,exportedAt:trip.updatedAt,trip:{...trip,items:[{...flight,boardingPass:pass.boardingPass}]}})).toBe(false)
  })
  it('imports flight and pass JSON together with fresh IDs and a remapped relationship',()=>{
    let id=0
    const parsed=parseTripItemsJson(JSON.stringify([flight,pass]),()=>`new-${++id}`)
    expect(parsed.ok).toBe(true)
    if(parsed.ok){expect(parsed.items[1].relatedItemId).toBe('new-1');expect(parsed.items[1].boardingPass).toEqual(pass.boardingPass);expect(parsed.items[0].passengerLastName).toBe('Example')}
    expect(parseTripItemsJson(JSON.stringify({...pass,boardingPass:{url:'file:///pass.png'}})).ok).toBe(false)
  })
  it('keeps passes with their flight after rescheduling and preserves a pass after flight removal',()=>{
    const moved={...flight,start:'2026-11-20T20:00'}
    const aligned=alignBoardingPassesWithFlights([pass,moved])
    expect(aligned[0]).toMatchObject({relatedItemId:flight.id,start:moved.start,boardingPass:pass.boardingPass})
    expect(sortTripItems(aligned).map(item=>item.id)).toEqual([flight.id,pass.id])
    expect(alignBoardingPassesWithFlights([pass])).toEqual([pass])
  })
  it('does not create duplicate calendar events, route stops, or weather requests',()=>{
    const onlyFlight={...trip,items:[flight]}
    expect(buildTripCalendar(trip)).toBe(buildTripCalendar(onlyFlight))
    expect(tripRouteStops(trip.items)).toEqual(tripRouteStops(onlyFlight.items))
    expect(tripGroundRouteSegments(trip.items)).toEqual(tripGroundRouteSegments(onlyFlight.items))
    expect(weatherPlansForItem(pass)).toEqual([])
  })
  it('keeps boarding passes and personalized check-in credentials out of viewer projections',()=>{
    for(const audience of ['public-trip','named-trip','public-calendar'] as const){
      const policy=sharePolicyForPreset(audience,'full'),projection=buildShareProjection(trip,policy,{publishedAt:trip.updatedAt})
      expect(projection.trip.items).toHaveLength(1)
      expect(JSON.stringify(projection)).not.toMatch(/boardingPass|passengerLastName|checkInUrl|private-token|base64/)
    }
  })
})
