import { describe, expect, it } from 'vitest'
import { buildTripCalendar, tripCalendarFilename } from './calendarExport'
import { Trip } from './types'

const trip:Trip={
  id:'trip-1',name:'Ireland 2026',destination:'Toronto → Dublin',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-07-01T12:34:56.000Z',
  items:[
    {id:'stay-1',type:'stay',title:'Listowel stay',provider:'The Listowel Arms Hotel',start:'2026-07-25T15:00',end:'2026-07-27T11:00',timeZone:'Europe/Dublin',location:'14 Lower William Street, Listowel, Ireland',confirmation:'ABC123',bookedBy:'Craig',status:'confirmed',notes:'Breakfast included.',link:'https://example.com/booking',emailLink:'https://mail.example.com/source'},
    {id:'flight-1',type:'flight',title:'Toronto to Dublin',start:'2026-07-18T20:50',end:'2026-07-19T08:15',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin',location:'Toronto Pearson International Airport (YYZ)',endLocation:'Dublin Airport (DUB)',status:'confirmed'},
    {id:'event-1',type:'event',title:'Festival day',start:'2026-07-28T12:00',timeZone:'Europe/Dublin',allDay:true,status:'planned'},
    {id:'event-2',type:'event',title:'Evening show',start:'2026-07-29T19:30',timeZone:'Europe/Dublin',status:'confirmed'},
    {id:'transport-1',type:'transport',title:'Intercity train',start:'2026-07-24T09:00',end:'2026-07-24T11:00',timeZone:'Europe/Dublin',status:'confirmed'},
    {id:'car-1',type:'car',title:'Rental pickup',start:'2026-07-20T16:00',timeZone:'Europe/Dublin',status:'confirmed'},
  ],
}

describe('iCalendar itinerary export',()=>{
  it('creates portable events with UTC times, details, URLs, and map-ready locations',()=>{
    const waypointUrl='https://waypoint.example/?tripId=trip-1&item=stay-1',calendar=buildTripCalendar(trip,{includeSourceEmail:true,itemUrls:{'stay-1':waypointUrl}}),unfolded=calendar.replace(/\r\n /g,'')
    expect(calendar).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')
    expect(calendar).toContain('X-WAYPOINT-DATA-FLOW:ITINERARY-JSON-TO-CALENDAR')
    expect(calendar).toContain('UID:stay-1@waypoint.travel')
    expect(calendar).toContain('DTSTART:20260725T140000Z')
    expect(calendar).toContain('DTEND:20260727T100000Z')
    expect(calendar).toContain('DTSTART:20260719T005000Z')
    expect(calendar).toContain('DTEND:20260719T071500Z')
    expect(unfolded).toContain('LOCATION:The Listowel Arms Hotel\\, 14 Lower William Street\\, Listowel\\, Ireland')
    expect(unfolded).toContain('Confirmation: ABC123')
    expect(unfolded).toContain('Booking: https://example.com/booking')
    expect(unfolded).toContain('Source email: https://mail.example.com/source')
    expect(calendar).toContain(`URL:${waypointUrl}`)
    expect(calendar).not.toContain('URL:https://example.com/booking')
  })

  it('keeps booking links in public subscriptions while excluding source-email links',()=>{
    const calendar=buildTripCalendar(trip,{includeSourceEmail:false,itemUrls:{'stay-1':'https://waypoint.example/?tripId=trip-1&item=stay-1'}}),unfolded=calendar.replace(/\r\n /g,'')
    expect(unfolded).toContain('Booking: https://example.com/booking')
    expect(calendar).not.toContain('URL:https://example.com/booking')
    expect(calendar).toContain('URL:https://waypoint.example/?tripId=trip-1&item=stay-1')
    expect(calendar).not.toContain('Source email:')
  })

  it('keeps a virtual event link as the primary calendar URL',()=>{
    const virtualTrip:Trip={...trip,items:[{id:'virtual-1',type:'event',title:'Video call',start:'2026-07-29T19:30',timeZone:'Europe/Dublin',status:'confirmed',link:'https://meet.google.com/abc-defg-hij'}]},calendar=buildTripCalendar(virtualTrip,{itemUrls:{'virtual-1':'https://waypoint.example/?tripId=trip-1&item=virtual-1'}}).replace(/\r\n /g,'')
    expect(calendar).toContain('URL:https://meet.google.com/abc-defg-hij')
    expect(calendar).toContain('Virtual event: https://meet.google.com/abc-defg-hij')
    expect(calendar).not.toContain('URL:https://waypoint.example/')
  })

  it('uses an exclusive next-day end for all-day entries',()=>{
    const calendar=buildTripCalendar(trip)
    expect(calendar).toContain('DTSTART;VALUE=DATE:20260728')
    expect(calendar).toContain('DTEND;VALUE=DATE:20260729')
    expect(calendar).not.toContain('Source email:')
  })

  it('can represent stays as all-day spans through checkout without changing itinerary times',()=>{
    const calendar=buildTripCalendar(trip,{stayTiming:'all-day'}).replace(/\r\n /g,''),stay=calendar.split('BEGIN:VEVENT').find(event=>event.includes('UID:stay-1@waypoint.travel'))||''
    expect(stay).toContain('DTSTART;VALUE=DATE:20260725')
    expect(stay).toContain('DTEND;VALUE=DATE:20260728')
    expect(stay).not.toContain('DTSTART:20260725T140000Z')
    expect(stay).toContain('TRIGGER;VALUE=DATE-TIME:20260725T140000Z')
    expect(stay).toContain('TRIGGER;VALUE=DATE-TIME:20260727T100000Z')
    expect(trip.items[0].start).toBe('2026-07-25T15:00')
  })

  it('adds the requested display alarms for travel, stays, cars, and events',()=>{
    const calendar=buildTripCalendar(trip).replace(/\r\n /g,''),event=(id:string)=>calendar.split('BEGIN:VEVENT').find(value=>value.includes(`UID:${id}@waypoint.travel`))||''
    expect(event('flight-1')).toContain('TRIGGER:-P1D')
    expect(event('flight-1')).toContain('TRIGGER:-PT3H')
    expect(event('transport-1')).toContain('TRIGGER:-PT1H')
    expect(event('car-1')).toContain('TRIGGER;VALUE=DATE-TIME:20260720T070000Z')
    expect(event('stay-1')).toContain('TRIGGER;VALUE=DATE-TIME:20260725T140000Z')
    expect(event('stay-1')).toContain('TRIGGER;VALUE=DATE-TIME:20260727T100000Z')
    expect(event('event-2')).toContain('TRIGGER:-P1D')
    expect(event('event-2')).toContain('TRIGGER:-PT2H')
    expect(event('event-1')).toContain('TRIGGER:-P1D')
    expect(event('event-1')).not.toContain('TRIGGER:-PT2H')
  })

  it('alerts for car pickup and return at 8 AM or the earlier stored time',()=>{
    const carTrip:Trip={...trip,items:[{id:'car-span',type:'car',title:'Rental period',start:'2026-07-20T07:15',end:'2026-07-22T06:30',timeZone:'UTC',status:'confirmed'},{id:'car-return',type:'car',title:'Return rental car',start:'2026-07-23T16:00',timeZone:'UTC',status:'confirmed'}]},calendar=buildTripCalendar(carTrip).replace(/\r\n /g,''),event=(id:string)=>calendar.split('BEGIN:VEVENT').find(value=>value.includes(`UID:${id}@waypoint.travel`))||''
    expect(event('car-span')).toContain('TRIGGER;VALUE=DATE-TIME:20260720T071500Z')
    expect(event('car-span')).toContain('TRIGGER;VALUE=DATE-TIME:20260722T063000Z')
    expect(event('car-return')).toContain('TRIGGER;VALUE=DATE-TIME:20260723T080000Z')
    expect(event('car-return')).toContain('DESCRIPTION:Car rental return time')
  })

  it('does not add a departure alarm to transit without a known time',()=>{
    const noTimeTrip:Trip={...trip,items:[{id:'transport-all-day',type:'transport',title:'Rail pass day',start:'2026-07-24T12:00',timeZone:'Europe/Dublin',allDay:true,status:'planned'}]}
    expect(buildTripCalendar(noTimeTrip)).not.toContain('BEGIN:VALARM')
  })

  it('excludes journal entries from exported and published calendar content',()=>{
    const journalTrip:Trip={...trip,items:[...trip.items,{id:'journal-1',type:'journal',title:'Private arrival notes',start:'2026-07-19T09:00',timeZone:'Europe/Dublin',status:'planned',notes:'Personal journal text.'}]}
    const calendar=buildTripCalendar(journalTrip)
    expect(calendar).not.toContain('UID:journal-1@waypoint.travel')
    expect(calendar).not.toContain('Private arrival notes')
    expect(calendar).not.toContain('Personal journal text')
    expect(calendar).toContain('UID:flight-1@waypoint.travel')
  })

  it('omits binary attachments and folds every content line',()=>{
    const calendar=buildTripCalendar(trip)
    expect(calendar).not.toContain('ATTACH')
    for(const line of calendar.split('\r\n').filter(Boolean))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })

  it('creates a readable calendar filename',()=>{
    expect(tripCalendarFilename(trip)).toBe('Ireland-2026-itinerary.ics')
  })
})
