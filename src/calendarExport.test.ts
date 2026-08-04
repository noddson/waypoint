import { describe, expect, it } from 'vitest'
import { buildTripCalendar, tripCalendarFilename } from './calendarExport'
import { Trip } from './types'

const trip:Trip={
  id:'trip-1',name:'Ireland 2026',destination:'Toronto → Dublin',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-07-01T12:34:56.000Z',
  items:[
    {id:'stay-1',type:'stay',title:'Listowel stay',provider:'The Listowel Arms Hotel',start:'2026-07-25T15:00',end:'2026-07-27T11:00',timeZone:'Europe/Dublin',location:'14 Lower William Street, Listowel, Ireland',confirmation:'ABC123',bookedBy:'Craig',status:'confirmed',notes:'Breakfast included.',link:'https://example.com/booking',emailLink:'https://mail.example.com/source'},
    {id:'flight-1',type:'flight',title:'Toronto to Dublin',start:'2026-07-18T20:50',end:'2026-07-19T08:15',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin',location:'Toronto Pearson International Airport (YYZ)',endLocation:'Dublin Airport (DUB)',status:'confirmed'},
    {id:'event-1',type:'event',title:'Festival day',start:'2026-07-28T12:00',timeZone:'Europe/Dublin',allDay:true,status:'planned'},
  ],
}

describe('iCalendar itinerary export',()=>{
  it('creates portable events with UTC times, details, URLs, and map-ready locations',()=>{
    const calendar=buildTripCalendar(trip,{includeSourceEmail:true}),unfolded=calendar.replace(/\r\n /g,'')
    expect(calendar).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')
    expect(calendar).toContain('UID:stay-1@waypoint.travel')
    expect(calendar).toContain('DTSTART:20260725T140000Z')
    expect(calendar).toContain('DTEND:20260727T100000Z')
    expect(calendar).toContain('DTSTART:20260719T005000Z')
    expect(calendar).toContain('DTEND:20260719T071500Z')
    expect(unfolded).toContain('LOCATION:The Listowel Arms Hotel\\, 14 Lower William Street\\, Listowel\\, Ireland')
    expect(unfolded).toContain('Confirmation: ABC123')
    expect(unfolded).toContain('Booking: https://example.com/booking')
    expect(unfolded).toContain('Source email: https://mail.example.com/source')
    expect(calendar).toContain('URL:https://example.com/booking')
  })

  it('keeps booking links in public subscriptions while excluding source-email links',()=>{
    const calendar=buildTripCalendar(trip,{includeSourceEmail:false}),unfolded=calendar.replace(/\r\n /g,'')
    expect(unfolded).toContain('Booking: https://example.com/booking')
    expect(calendar).toContain('URL:https://example.com/booking')
    expect(calendar).not.toContain('Source email:')
  })

  it('uses an exclusive next-day end for all-day entries',()=>{
    const calendar=buildTripCalendar(trip)
    expect(calendar).toContain('DTSTART;VALUE=DATE:20260728')
    expect(calendar).toContain('DTEND;VALUE=DATE:20260729')
    expect(calendar).not.toContain('Source email:')
  })

  it('embeds best-effort binary attachments and folds every content line',()=>{
    const calendar=buildTripCalendar(trip,{attachments:{'stay-1':[{mimeType:'image/png',dataBase64:'a'.repeat(300)}]}})
    expect(calendar).toContain('ATTACH;FMTTYPE=image/png;ENCODING=BASE64;VALUE=BINARY:')
    for(const line of calendar.split('\r\n').filter(Boolean))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })

  it('creates a readable calendar filename',()=>{
    expect(tripCalendarFilename(trip)).toBe('Ireland-2026-itinerary.ics')
  })
})
