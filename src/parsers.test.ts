import { describe, expect, it } from 'vitest'
import { parseDocumentText, parseEmail } from './parsers'
import { sortTripItems, TripItem } from './types'
import { isAirCanadaCheckInOpen, zonedDateTimeEpoch } from './checkin'

describe('content-driven email parsing',()=>{
  it('extracts the actual taxi pickup time and booking confirmation from HTML',()=>{
    const raw=`From: United Taxi <bookings@unitedtaxi.example>
Date: Wed, 1 Jul 2026 10:00:00 -0400
Subject: Interac Pending - New Ride Booking - #11137 - Nick Oddson
Content-Type: text/html; charset=UTF-8

<table>
<tr><td>Company</td><td>United Taxi</td></tr>
<tr><td>Pickup Date</td><td>July 18, 2026</td></tr>
<tr><td>Pickup Time</td><td>5:00 PM</td></tr>
<tr><td>Pickup Location</td><td>Waterloo, Ontario</td></tr>
<tr><td>Dropoff Location</td><td>Toronto Pearson Airport</td></tr>
<tr><td>Booking Confirmation</td><td>UT-11137</td></tr>
<tr><td>Time Zone</td><td>America/Toronto</td></tr>
</table>
<a href="https://unitedtaxi.example/booking/11137">Manage booking</a>`
    const draft=parseEmail(raw).drafts[0]
    expect(draft).toMatchObject({type:'transport',start:'2026-07-18T17:00',timeZone:'America/Toronto',confirmation:'UT-11137',status:'pending',location:'Waterloo, Ontario',endLocation:'Toronto Pearson Airport'})
  })

  it('does not invent a provider-specific time when the email omits it',()=>{
    const draft=parseEmail('From: United Taxi <bookings@unitedtaxi.example>\nDate: July 1, 2026 10:00 EDT\nSubject: Pending ride booking #11137\n\nYour ride is awaiting scheduling.').drafts[0]
    expect(draft.start).not.toBe('2026-07-18T16:00')
    expect(draft.notes).toContain('Review date and time')
  })

  it('uses arbitrary provider, date, and time values from uploaded content',()=>{
    const raw=`From: North Star Lodging <reservations@northstar.example>
Subject: Your hotel reservation

Check-in Date: November 3, 2031
Check-in Time: 3:45 PM
Check-out Date: 5 November 2031
Check-out Time: 11:10 AM
Property: North Star Lodge
Reservation Number: NSL-8392
Time Zone: Europe/London`
    expect(parseEmail(raw).drafts[0]).toMatchObject({type:'stay',provider:'North Star Lodge',start:'2031-11-03T15:45',end:'2031-11-05T11:10',confirmation:'NSL-8392',timeZone:'Europe/London'})
  })

  it('creates flight legs only from repeated flight content',()=>{
    const raw=`From: Air Canada <bookings@aircanada.example>
Date: July 1, 2026 10:00 EDT
Subject: Booking reference: TEST42

Flight AC 800
Departure Date: July 18, 2026
Departure Time: 8:50 PM
From: Toronto Pearson (YYZ)
Arrival Date: July 19, 2026
Arrival Time: 8:15 AM
To: Dublin (DUB)
Time Zone: America/Toronto

Flight AC 801
Departure Date: August 1, 2026
Departure Time: 9:20 AM
From: Dublin (DUB)
Arrival Date: August 1, 2026
Arrival Time: 11:25 AM
To: Toronto Pearson (YYZ)
Time Zone: Europe/Dublin`
    const result=parseEmail(raw)
    expect(result.drafts).toHaveLength(2)
    expect(result.drafts[0]).toMatchObject({type:'flight',start:'2026-07-18T20:50',end:'2026-07-19T08:15',flightNumber:'AC 800',confirmation:'TEST42'})
    expect(result.drafts[1]).toMatchObject({start:'2026-08-01T09:20',end:'2026-08-01T11:25',flightNumber:'AC 801'})
  })

  it('extracts generic itinerary and policy identifiers from subjects',()=>{
    expect(parseEmail('From: Expedia <travel@expedia.example>\nSubject: Flight purchase confirmation - Itinerary no. 73115345225870\n\nDeparture Date: July 4, 2026').drafts[0]).toMatchObject({type:'flight',confirmation:'73115345225870'})
    expect(parseEmail('From: Allianz <confirmation@allianz.example>\nSubject: Travel Insurance Confirmation for Policy 971738711\n\nCoverage begins July 18, 2026').drafts[0]).toMatchObject({type:'insurance',confirmation:'971738711'})
  })

  it('uses a safe generic draft for unknown mail',()=>{
    const draft=parseEmail('From: someone@example.test\nSubject: Museum booking\n\nSee you July 25, 2026').drafts[0]
    expect(draft).toMatchObject({type:'reference',status:'planned',start:'2026-07-25T12:00'})
  })

  it('keeps only safe HTTPS booking links and reassembles quoted-printable links',()=>{
    const raw='From: Hotel <stay@example.test>\nSubject: Hotel confirmation\nContent-Type: text/html\nContent-Transfer-Encoding: quoted-printable\n\n<a href=3D"javascript:alert(1)">bad</a><a href=3D"https://example.test/booking/123/=\nmanage">Manage booking</a>'
    expect(parseEmail(raw).drafts[0].link).toBe('https://example.test/booking/123/manage')
  })

  it('treats uploaded HTML as inert text and strips active or deceptive content',()=>{
    const raw=`From: <script>alert('sender')</script> Safe Tours <tickets@example.test>
Subject: <img src=x onerror=alert(1)> Tour ticket #SAFE42
Content-Type: text/html

<script>window.location='https://evil.example'</script>
<style>body{display:none}</style>
<iframe src="https://evil.example"></iframe>
<p>Event Date: July 25, 2026</p><p>Event Time: 10:30 AM</p>
<a href="javascript:alert(1)">Open</a>`
    const result=parseEmail(raw),serialized=JSON.stringify(result)
    expect(serialized).not.toMatch(/window\.location|onerror|javascript:|display:none/)
    expect(result.drafts[0]).toMatchObject({type:'event',start:'2026-07-25T10:30',link:undefined})
  })

  it('rejects oversized email input before parsing',()=>{
    expect(()=>parseEmail(`Subject: Huge\n\n${'x'.repeat(2_000_001)}`)).toThrow(/too large/i)
  })

  it('decodes base64 MIME and keeps date-only events all-day',()=>{
    const encoded=btoa('Event Date: 28 July 2026\nTicket Type: Admission\nReference Number: TEST42\nTime Zone: Europe/Dublin')
    const raw=`From: Bunratty Castle <tickets@example.test>
Subject: Booking Confirmation
Content-Type: multipart/alternative; boundary="test"

--test
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: base64

${encoded}
--test--`
    expect(parseEmail(raw).drafts[0]).toMatchObject({type:'event',start:'2026-07-28T12:00',timeZone:'Europe/Dublin',allDay:true,confirmation:'TEST42'})
  })
})

describe('document and scheduling helpers',()=>{
  it('creates reviewable drafts from dated PDF text',()=>{const result=parseDocumentText('Flight AC 800 departing July 18, 2026 booking reference TEST42','itinerary.pdf');expect(result.drafts[0]).toMatchObject({type:'flight',confirmation:'TEST42',provider:'PDF import'})})
  it('sorts rows explicitly by date and then time',()=>{const make=(id:string,start:string,allDay=false):TripItem=>({id,type:'event',title:id,start,timeZone:'Europe/Dublin',status:'confirmed',allDay});const sorted=sortTripItems([make('late','2026-07-28T18:00'),make('next day','2026-07-29T08:00'),make('early','2026-07-28T09:00'),make('unspecified','2026-07-28T12:00',true)]);expect(sorted.map(item=>item.id)).toEqual(['unspecified','early','late','next day'])})
  it('opens Air Canada check-in only during the 24-hour window in the departure time zone',()=>{const flight:TripItem={id:'ac',type:'flight',title:'Toronto → Dublin',provider:'Air Canada',confirmation:'ABC123',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed'};const departure=zonedDateTimeEpoch(flight.start,flight.timeZone);expect(new Date(departure).toISOString()).toBe('2026-07-19T00:50:00.000Z');expect(isAirCanadaCheckInOpen(flight,departure-24*60*60*1000-1)).toBe(false);expect(isAirCanadaCheckInOpen(flight,departure-24*60*60*1000)).toBe(true);expect(isAirCanadaCheckInOpen(flight,departure)).toBe(false)})
})
