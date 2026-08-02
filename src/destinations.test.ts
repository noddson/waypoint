import { describe, expect, it } from 'vitest'
import { destinationLabel, googleMapsDirectionsUrls, googleMapsSearchUrl, tripDestinations, tripRouteStops } from './destinations'
import { TripItem } from './types'

const item=(id:string,start:string,location:string,endLocation?:string):TripItem=>({id,type:'stay',title:id,start,timeZone:'Europe/Dublin',location,endLocation,status:'confirmed'})

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

  it('splits long directions into links that keep every route leg',()=>{
    const stops=Array.from({length:14},(_,index)=>({id:String(index),label:`Stop ${index}`,address:`Stop ${index}, Ireland`}))
    const links=googleMapsDirectionsUrls(stops)
    expect(links).toHaveLength(2)
    expect(decodeURIComponent(links[0])).toContain('waypoints=Stop+1,+Ireland|Stop+2,+Ireland')
    expect(decodeURIComponent(links[1])).toContain('origin=Stop+10,+Ireland')
    expect(decodeURIComponent(links[1])).toContain('destination=Stop+13,+Ireland')
  })
})
