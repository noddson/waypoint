import { describe, expect, it } from 'vitest'
import { Trip } from './types'
import { compareLastTravelDates, sortTripsByLastTravelDate, tripLastTravelDate } from './tripOrder'

const trip=(id:string,dates:Array<{start:string,end?:string}>,updatedAt='2026-01-01T00:00:00Z'):Trip=>({
  id,name:id,destination:'',createdAt:updatedAt,updatedAt,
  items:dates.map((dates,index)=>({id:`${id}-${index}`,type:'event',title:id,timeZone:'UTC',status:'confirmed',...dates})),
})

describe('trip ordering',()=>{
  it('uses the latest end or start date in an itinerary',()=>{
    expect(tripLastTravelDate(trip('Ireland',[{start:'2026-07-18T20:00',end:'2026-07-19T08:00'},{start:'2026-08-01T09:00'}]))).toBe('2026-08-01')
  })

  it('puts undated trips first, then sorts final travel dates newest first',()=>{
    const ordered=sortTripsByLastTravelDate([
      trip('Older but edited recently',[{start:'2025-07-01T09:00'}],'2026-08-03T00:00:00Z'),
      trip('Newest trip',[{start:'2027-02-10T09:00',end:'2027-02-14T18:00'}]),
      trip('Middle trip',[{start:'2026-08-01T09:00'}]),
      trip('No dates',[]),
    ])
    expect(ordered.map(value=>value.name)).toEqual(['No dates','Newest trip','Middle trip','Older but edited recently'])
  })

  it('compares missing travel dates ahead of dated trips',()=>{
    expect(compareLastTravelDates('', '2026-08-01')).toBeLessThan(0)
    expect(compareLastTravelDates('2026-08-01', '')).toBeGreaterThan(0)
  })

  it('orders undated trips by modification time, newest first',()=>{
    const ordered=sortTripsByLastTravelDate([
      trip('Older undated',[],'2026-01-01T00:00:00Z'),
      trip('Newer undated',[],'2026-08-01T00:00:00Z'),
      trip('Dated',[{start:'2027-01-01T09:00'}],'2026-09-01T00:00:00Z'),
    ])
    expect(ordered.map(value=>value.name)).toEqual(['Newer undated','Older undated','Dated'])
  })

  it('uses modification time only when final travel dates match',()=>{
    const ordered=sortTripsByLastTravelDate([
      trip('Earlier edit',[{start:'2026-08-01T09:00'}],'2026-01-01T00:00:00Z'),
      trip('Later edit',[{start:'2026-08-01T18:00'}],'2026-02-01T00:00:00Z'),
    ])
    expect(ordered.map(value=>value.name)).toEqual(['Later edit','Earlier edit'])
  })
})
