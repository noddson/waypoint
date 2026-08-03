import { describe, expect, it } from 'vitest'
import { appleMapsDirectionsUrls, appleMapsSearchUrl, destinationLabel, googleMapsDirectionsUrls, googleMapsSearchUrl, mapDirectionsUrls, mapSearchUrl, tripDestinations, tripGroundRouteSegments, tripRouteStops } from './destinations'
import { TripItem } from './types'

const item=(id:string,start:string,location:string,endLocation?:string):TripItem=>({id,type:'stay',title:id,start,timeZone:'Europe/Dublin',location,endLocation,status:'confirmed'})
const flight=(id:string,start:string,location:string,endLocation:string):TripItem=>({...item(id,start,location,endLocation),type:'flight',end:start})

describe('derived trip destinations',()=>{
  it('keeps sequential nearby towns as distinct stops',()=>{
    const stops=tripDestinations([
      item('one','2026-07-25T15:00','Kylemore House, Kylemore, Ireland'),
      item('two','2026-07-26T12:00','Main Street, Oranmore, Ireland'),
    ])
    expect(stops.map(stop=>stop.label)).toEqual(['Kylemore','Oranmore'])
  })

  it('extracts cities from airports and postal addresses',()=>{
    expect(destinationLabel('Toronto Pearson International Airport (YYZ), Terminal 1')).toBe('Toronto')
    expect(destinationLabel('Bridge End, Rotterdam Street, Belfast, United Kingdom, BT5 4AA')).toBe('Belfast')
    expect(destinationLabel('Butcher Street, Derry, Londonderry, Northern Ireland, BT48 6HL')).toBe('Derry')
    expect(destinationLabel("Titanic Belfast, 1 Olympic Way, Queen's Road, Belfast, United Kingdom")).toBe('Belfast')
    expect(destinationLabel('Rock of Cashel, Cashel, County Tipperary, Ireland')).toBe('Cashel')
    expect(destinationLabel('Maldron Hotel Kevin Street, Kevin Street Upper, Dublin 8, Ireland')).toBe('Dublin')
    expect(destinationLabel('Downtown Vancouver, British Columbia')).toBe('Vancouver')
  })

  it('keeps repeated start and end cities in the chronological route',()=>{
    const flight=(id:string,start:string,location:string,endLocation:string):TripItem=>({...item(id,start,location,endLocation),type:'flight'})
    const stops=tripRouteStops([
      item('home-transfer','2026-07-18T15:30','Waterloo, Ontario, Canada','Toronto Pearson International Airport (YYZ), Terminal 1'),
      flight('outbound','2026-07-18T20:50','Toronto Pearson International Airport (YYZ), Terminal 1','Dublin Airport (DUB), Terminal 2'),
      item('belfast','2026-07-19T14:00','Belfast, Northern Ireland'),
      item('dublin','2026-07-31T12:00','Dublin 8, Ireland'),
      flight('return','2026-08-01T09:20','Dublin Airport (DUB), Terminal 2','Toronto Pearson International Airport (YYZ), Terminal 1'),
      item('home','2026-08-01T13:00','Toronto Pearson International Airport (YYZ), Terminal 1','Waterloo, Ontario, Canada'),
    ])
    expect(stops.map(stop=>stop.label)).toEqual(['Toronto','Dublin','Belfast','Dublin','Toronto'])
  })

  it('creates an encoded Google Maps search URL',()=>{
    expect(googleMapsSearchUrl('14 Lower William Street, Listowel, Ireland')).toBe('https://www.google.com/maps/search/?api=1&query=14%20Lower%20William%20Street%2C%20Listowel%2C%20Ireland')
  })

  it('creates Apple Maps search and driving links',()=>{
    const stops=[
      {id:'one',label:'One',address:'Dublin Airport, Ireland'},
      {id:'two',label:'Two',address:'Belfast, Northern Ireland'},
      {id:'three',label:'Three',address:'Derry, Northern Ireland'},
    ]
    expect(appleMapsSearchUrl('Dublin Airport, Ireland')).toBe('https://maps.apple.com/?q=Dublin%20Airport%2C%20Ireland')
    const links=appleMapsDirectionsUrls(stops)
    expect(links).toHaveLength(2)
    expect(new URL(links[0]).searchParams.get('saddr')).toBe(stops[0].address)
    expect(new URL(links[0]).searchParams.get('daddr')).toBe(stops[1].address)
    expect(new URL(links[0]).searchParams.get('dirflg')).toBe('d')
    expect(mapSearchUrl(stops[0].address,'apple')).toBe(appleMapsSearchUrl(stops[0].address))
    expect(mapDirectionsUrls(stops,'google')).toEqual(googleMapsDirectionsUrls(stops))
  })

  it('splits long directions into links that keep every route leg',()=>{
    const stops=Array.from({length:14},(_,index)=>({id:String(index),label:`Stop ${index}`,address:`Stop ${index}, Ireland`}))
    const links=googleMapsDirectionsUrls(stops)
    expect(links).toHaveLength(2)
    expect(decodeURIComponent(links[0])).toContain('waypoints=Stop+1,+Ireland|Stop+2,+Ireland')
    expect(decodeURIComponent(links[0])).toContain('destination=Stop+7,+Ireland')
    expect(decodeURIComponent(links[1])).toContain('origin=Stop+7,+Ireland')
    expect(decodeURIComponent(links[1])).toContain('destination=Stop+13,+Ireland')
    const stopCounts=links.map(link=>{const params=new URL(link).searchParams,waypoints=params.get('waypoints')?.split('|').length||0;return waypoints+2})
    expect(stopCounts).toEqual([8,7])
  })

  it('uses connected flights as boundaries around one Vancouver ground route',()=>{
    const segments=tripGroundRouteSegments([
      flight('to-calgary','2025-10-09T06:00','Region of Waterloo International Airport (YKF), Kitchener/Waterloo, Ontario','Calgary International Airport (YYC), Calgary, Alberta'),
      flight('to-vancouver','2025-10-09T09:00','Calgary International Airport (YYC), Calgary, Alberta','Vancouver International Airport (YVR), Vancouver, British Columbia'),
      item('hotel','2025-10-09T10:23','1234 Hornby Street, Vancouver, BC V6Z 1W2'),
      item('event','2025-10-11T14:00','Downtown Vancouver, British Columbia'),
      flight('from-vancouver','2025-10-13T14:30','Vancouver International Airport (YVR), Vancouver, British Columbia','Calgary International Airport (YYC), Calgary, Alberta'),
      flight('home','2025-10-13T19:05','Calgary International Airport (YYC), Calgary, Alberta','Region of Waterloo International Airport (YKF), Kitchener/Waterloo, Ontario'),
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].stops.map(stop=>stop.address)).toEqual([
      'Vancouver International Airport (YVR), Vancouver, British Columbia',
      '1234 Hornby Street, Vancouver, BC V6Z 1W2',
      'Downtown Vancouver, British Columbia',
      'Vancouver International Airport (YVR), Vancouver, British Columbia',
    ])
    expect(segments[0].stops.some(stop=>stop.address.includes('Calgary'))).toBe(false)
  })

  it('creates separately named ground routes between regional flights',()=>{
    const segments=tripGroundRouteSegments([
      flight('to-scotland','2026-06-01T08:00','Toronto Pearson International Airport, Toronto, Canada','Edinburgh Airport, Edinburgh, Scotland'),
      item('edinburgh','2026-06-01T12:00','Royal Mile, Edinburgh, Scotland'),
      item('inverness','2026-06-04T12:00','Academy Street, Inverness, Scotland'),
      flight('to-germany','2026-06-08T09:00','Glasgow Airport, Glasgow, Scotland','Berlin Brandenburg Airport, Berlin, Germany'),
      item('berlin','2026-06-08T13:00','Alexanderplatz, Berlin, Germany'),
      item('munich','2026-06-12T13:00','Marienplatz, Munich, Germany'),
      flight('home','2026-06-15T09:00','Munich Airport, Munich, Germany','Toronto Pearson International Airport, Toronto, Canada'),
    ])
    expect(segments.map(segment=>segment.label)).toEqual(['Scotland','Germany'])
    expect(segments[0].stops[0].address).toContain('Edinburgh Airport')
    expect(segments[0].stops[segments[0].stops.length-1]?.address).toContain('Glasgow Airport')
    expect(segments[1].stops[0].address).toContain('Berlin Brandenburg Airport')
    expect(segments[1].stops[segments[1].stops.length-1]?.address).toContain('Munich Airport')
    expect(segments.flatMap(segment=>segment.stops).some(stop=>stop.address.includes('Toronto'))).toBe(false)
  })
})
