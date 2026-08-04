import { describe, expect, it } from 'vitest'
import { buildWaypointItemUrl, virtualEventLink, waypointItemAnchorId, waypointItemDayIndex, waypointItemFromUrl } from './calendarItemLink'
import { TripItem } from './types'

const event=(link:string):TripItem=>({id:'event-1',type:'event',title:'Online event',start:'2026-08-04T10:00',timeZone:'UTC',status:'confirmed',link})

describe('Waypoint calendar item links',()=>{
  it('builds a local-trip deep link and reads it back',()=>{
    const url=buildWaypointItemUrl('https://waypoint.example/app/?old=value#section','trip 1','item/1')
    expect(url).toBe('https://waypoint.example/app/?tripId=trip+1&item=item%2F1')
    expect(waypointItemFromUrl(url)).toEqual({tripId:'trip 1',itemId:'item/1'})
  })

  it('builds a Drive-backed deep link when the itinerary is synchronized',()=>{
    const url=buildWaypointItemUrl('https://waypoint.example/','trip-1','item-1',{fileId:'drive-file',resourceKey:'key'})
    expect(url).toBe('https://waypoint.example/?driveTrip=drive-file&resourceKey=key&item=item-1')
    expect(waypointItemFromUrl(url)).toEqual({tripId:undefined,itemId:'item-1'})
  })

  it('recognizes common virtual-event hosts without treating ticket sites as meetings',()=>{
    expect(virtualEventLink(event('https://meet.google.com/abc-defg-hij'))).toBe('https://meet.google.com/abc-defg-hij')
    expect(virtualEventLink(event('https://tickets.example.com/order/123'))).toBeUndefined()
  })

  it('creates a stable DOM anchor without unsafe URL characters',()=>{
    expect(waypointItemAnchorId('item/with space')).toBe('waypoint-item-item_2Fwith_20space')
  })

  it('selects the target item’s day in a multi-day itinerary',()=>{
    const items=[{...event('https://tickets.example.com/1'),id:'day-two',start:'2026-08-05T10:00'},{...event('https://tickets.example.com/2'),id:'day-one',start:'2026-08-04T10:00'},{...event('https://tickets.example.com/3'),id:'day-three',start:'2026-08-06T10:00'}]
    expect(waypointItemDayIndex(items,'day-two')).toBe(1)
    expect(waypointItemDayIndex(items,'missing')).toBe(-1)
  })
})
