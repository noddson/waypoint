import { describe, expect, it } from 'vitest'
import { Trip } from './types'
import { sortTripsByTravelDate, tripFirstTravelDate, tripLastTravelDate } from './tripOrder'

const trip=(id:string,dates:Array<{start:string,end?:string}>,updatedAt='2026-01-01T00:00:00Z'):Trip=>({
  id,name:id,destination:'',createdAt:updatedAt,updatedAt,
  items:dates.map((dates,index)=>({id:`${id}-${index}`,type:'event',title:id,timeZone:'UTC',status:'confirmed',...dates})),
})

describe('trip ordering',()=>{
  it('derives the first start and latest end or start from itinerary entries',()=>{
    const itinerary=trip('Ireland',[{start:'2026-07-18T20:00',end:'2026-07-19T08:00'},{start:'2026-08-01T09:00'}])
    expect(tripFirstTravelDate(itinerary)).toBe('2026-07-18')
    expect(tripLastTravelDate(itinerary)).toBe('2026-08-01')
  })

  it('orders current, upcoming, past, and undated trips for the chooser',()=>{
    const ordered=sortTripsByTravelDate([
      trip('Past older',[{start:'2026-07-01T09:00',end:'2026-07-02T17:00'}]),
      trip('Upcoming later',[{start:'2026-09-01T09:00',end:'2026-09-03T17:00'}]),
      trip('Current',[{start:'2026-08-01T09:00',end:'2026-08-10T17:00'}]),
      trip('No dates',[]),
      trip('Past recent',[{start:'2026-07-20T09:00',end:'2026-08-05T17:00'}]),
      trip('Upcoming next',[{start:'2026-08-12T09:00',end:'2026-10-01T17:00'}]),
    ],'2026-08-06')
    expect(ordered.map(value=>value.name)).toEqual(['Current','Upcoming next','Upcoming later','Past recent','Past older','No dates'])
  })

  it('orders undated trips by modification time after dated trips',()=>{
    const ordered=sortTripsByTravelDate([
      trip('Older undated',[],'2026-01-01T00:00:00Z'),
      trip('Newer undated',[],'2026-08-01T00:00:00Z'),
      trip('Dated',[{start:'2027-01-01T09:00'}],'2026-09-01T00:00:00Z'),
    ],'2026-08-06')
    expect(ordered.map(value=>value.name)).toEqual(['Dated','Newer undated','Older undated'])
  })

  it('uses modification time only when the relevant travel dates match',()=>{
    const ordered=sortTripsByTravelDate([
      trip('Earlier edit',[{start:'2026-08-01T09:00'}],'2026-01-01T00:00:00Z'),
      trip('Later edit',[{start:'2026-08-01T18:00'}],'2026-02-01T00:00:00Z'),
    ],'2026-08-06')
    expect(ordered.map(value=>value.name)).toEqual(['Later edit','Earlier edit'])
  })
})
