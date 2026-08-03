import { describe, expect, it } from 'vitest'
import { dayWaypointStops, destinationLabel, googleMapsDirectionsUrls, googleMapsSearchUrl, mapDirectionsUrls, mapLocationQuery, mapSearchUrl, tripDestinations, tripGroundRouteSegments, tripRouteStops } from './destinations'
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

  it('uses airport codes in routes and extracts cities from postal addresses',()=>{
    expect(destinationLabel('Toronto Pearson International Airport (YYZ), Terminal 1')).toBe('YYZ')
    expect(destinationLabel('Winnipeg James Armstrong Richardson International Airport (YWG), Gate 12')).toBe('YWG')
    expect(destinationLabel('Heathrow Airport [LHR], Terminal 5')).toBe('LHR')
    expect(destinationLabel('JFK Airport, Queens, New York')).toBe('JFK')
    expect(destinationLabel('Airport: CDG, Roissy-en-France')).toBe('CDG')
    expect(destinationLabel('Tokyo Haneda Airport, IATA code HND')).toBe('HND')
    expect(destinationLabel('Airport bus terminal, Winnipeg, Manitoba')).toBe('Winnipeg')
    expect(destinationLabel('Bridge End, Rotterdam Street, Belfast, United Kingdom, BT5 4AA')).toBe('Belfast')
    expect(destinationLabel('Butcher Street, Derry, Londonderry, Northern Ireland, BT48 6HL')).toBe('Derry')
    expect(destinationLabel("Titanic Belfast, 1 Olympic Way, Queen's Road, Belfast, United Kingdom")).toBe('Belfast')
    expect(destinationLabel('Rock of Cashel, Cashel, County Tipperary, Ireland')).toBe('Cashel')
    expect(destinationLabel('Maldron Hotel Kevin Street, Kevin Street Upper, Dublin 8, Ireland')).toBe('Dublin')
    expect(destinationLabel('Downtown Vancouver, British Columbia')).toBe('Vancouver')
    expect(destinationLabel('Turtle Bay Resort, 57-091 Kamehameha Highway, Kahuku, HI 96731')).toBe('Kahuku')
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
    expect(stops.map(stop=>stop.label)).toEqual(['YYZ','DUB','Belfast','Dublin','DUB','YYZ'])
  })

  it('creates an encoded Google Maps search URL',()=>{
    expect(googleMapsSearchUrl('14 Lower William Street, Listowel, Ireland')).toBe('https://www.google.com/maps/search/?api=1&query=14%20Lower%20William%20Street%2C%20Listowel%2C%20Ireland')
  })

  it('puts a stay provider before its address in individual map searches',()=>{
    const stay={...item('hotel','2026-07-25T15:00','14 Lower William Street, Listowel, Ireland'),provider:'The Listowel Arms Hotel'}
    const query=mapLocationQuery(stay,stay.location!)
    expect(query).toBe('The Listowel Arms Hotel, 14 Lower William Street, Listowel, Ireland')
    expect(new URL(mapSearchUrl(query)).searchParams.get('query')).toBe(query)
    expect(mapLocationQuery({...stay,provider:'  '},stay.location!)).toBe(stay.location)
    expect(mapLocationQuery({...stay,provider:'The Listowel Arms Hotel'},'The Listowel Arms Hotel, 14 Lower William Street')).toBe('The Listowel Arms Hotel, 14 Lower William Street')
    for(const type of ['flight','car','event','transport','insurance'] as const){
      expect(mapLocationQuery({...stay,type,provider:'The Listowel Arms Hotel'},stay.location!)).toBe(stay.location)
    }
  })

  it('uses Google Maps for shared search and directions links',()=>{
    const stops=[
      {id:'one',label:'One',address:'Dublin Airport, Ireland'},
      {id:'two',label:'Two',address:'Belfast, Northern Ireland'},
      {id:'three',label:'Three',address:'Derry, Northern Ireland'},
    ]
    expect(mapSearchUrl(stops[0].address)).toBe(googleMapsSearchUrl(stops[0].address))
    expect(mapDirectionsUrls(stops)).toEqual(googleMapsDirectionsUrls(stops))
  })

  it('uses stay providers in full-route map payloads without changing raw stop addresses',()=>{
    const first={...item('first','2026-07-25T15:00','1 Main Street, Dublin, Ireland'),provider:'Dublin House'}
    const middle={...item('middle','2026-07-26T12:00','2 High Street, Belfast, Northern Ireland'),type:'event' as const,provider:'Belfast Museum'}
    const last={...item('last','2026-07-27T15:00','3 Quay Street, Derry, Northern Ireland'),provider:'Derry Inn'}
    const segment=tripGroundRouteSegments([first,middle,last])[0]
    expect(segment.stops.map(stop=>stop.address)).toEqual([first.location,middle.location,last.location])
    expect(segment.stops.map(stop=>stop.mapQuery)).toEqual([
      `Dublin House, ${first.location}`,
      undefined,
      `Derry Inn, ${last.location}`,
    ])
    const params=new URL(googleMapsDirectionsUrls(segment.stops)[0]).searchParams
    expect(params.get('origin')).toBe(`Dublin House, ${first.location}`)
    expect(params.get('waypoints')).toBe(middle.location)
    expect(params.get('destination')).toBe(`Derry Inn, ${last.location}`)
  })

  it('uses a stay provider for a single-stop directions fallback',()=>{
    const links=googleMapsDirectionsUrls([{id:'hotel',label:'Listowel',address:'14 Lower William Street, Listowel, Ireland',mapQuery:'The Listowel Arms Hotel, 14 Lower William Street, Listowel, Ireland'}])
    expect(new URL(links[0]).searchParams.get('query')).toBe('The Listowel Arms Hotel, 14 Lower William Street, Listowel, Ireland')
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

  it('uses connected flights as boundaries and keeps airport codes distinct from their cities',()=>{
    const segments=tripGroundRouteSegments([
      flight('to-calgary','2025-10-09T06:00','Region of Waterloo International Airport (YKF), Kitchener/Waterloo, Ontario','Calgary International Airport (YYC), Calgary, Alberta'),
      flight('to-vancouver','2025-10-09T09:00','Calgary International Airport (YYC), Calgary, Alberta','Vancouver International Airport (YVR), Vancouver, British Columbia'),
      item('hotel','2025-10-09T10:23','1234 Hornby Street, Vancouver, BC V6Z 1W2'),
      item('event','2025-10-11T14:00','Downtown Vancouver, British Columbia'),
      flight('from-vancouver','2025-10-13T14:30','Vancouver International Airport (YVR), Vancouver, British Columbia','Calgary International Airport (YYC), Calgary, Alberta'),
      flight('home','2025-10-13T19:05','Calgary International Airport (YYC), Calgary, Alberta','Region of Waterloo International Airport (YKF), Kitchener/Waterloo, Ontario'),
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].label).toBe('British Columbia')
    expect(segments[0].stops.map(stop=>stop.label)).toEqual(['YVR','Vancouver','YVR'])
    expect(segments[0].arrivalFlightRoute).toEqual(['YKF','YYC','YVR'])
    expect(segments[0].departureFlightRoute).toEqual(['YVR','YYC','YKF'])
    expect(segments[0].stops.some(stop=>stop.address.includes('Calgary'))).toBe(false)
  })

  it('pairs direct inbound and outbound airport-code routes around a ground segment',()=>{
    const segments=tripGroundRouteSegments([
      flight('outbound','2025-07-04T08:05','Toronto Pearson International Airport (YYZ)','Winnipeg James Armstrong Richardson International Airport (YWG)'),
      item('hotel','2025-07-04T15:00','Courtyard Winnipeg Airport, Winnipeg, Manitoba'),
      flight('return','2025-07-13T07:40','Winnipeg James Armstrong Richardson International Airport (YWG)','Toronto Pearson International Airport (YYZ)'),
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].arrivalFlightRoute).toEqual(['YYZ','YWG'])
    expect(segments[0].departureFlightRoute).toEqual(['YWG','YYZ'])
  })

  it('keeps connecting airport codes in each side of a ground-route pairing',()=>{
    const segments=tripGroundRouteSegments([
      flight('to-minneapolis','2026-02-01T08:00','Toronto Pearson International Airport (YYZ)','Minneapolis-Saint Paul International Airport (MSP)'),
      flight('to-honolulu','2026-02-01T12:00','Minneapolis-Saint Paul International Airport (MSP)','Daniel K. Inouye International Airport (HNL)'),
      item('resort','2026-02-01T20:00','Turtle Bay Resort, Kahuku, Hawaii'),
      flight('to-san-francisco','2026-02-07T12:00','Daniel K. Inouye International Airport (HNL)','San Francisco International Airport (SFO)'),
      flight('home','2026-02-07T22:00','San Francisco International Airport (SFO)','Toronto Pearson International Airport (YYZ)'),
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].arrivalFlightRoute).toEqual(['YYZ','MSP','HNL'])
    expect(segments[0].departureFlightRoute).toEqual(['HNL','SFO','YYZ'])
    expect(segments[0].arrivalFlightItemIds).toEqual(['to-minneapolis','to-honolulu'])
    expect(segments[0].departureFlightItemIds).toEqual(['to-san-francisco','home'])
  })

  it('labels a US ground route by state instead of its ZIP code',()=>{
    const segments=tripGroundRouteSegments([
      flight('to-hawaii','2026-02-01T08:00','Toronto Pearson International Airport, Toronto, Canada','Daniel K. Inouye International Airport, Honolulu, HI 96819'),
      item('resort','2026-02-01T15:00','Turtle Bay Resort, 57-091 Kamehameha Highway, Kahuku, HI 96731'),
      item('beach','2026-02-02T10:00','Waikiki Beach, Honolulu, HI 96815'),
      flight('home','2026-02-07T12:00','Daniel K. Inouye International Airport, Honolulu, HI 96819','Toronto Pearson International Airport, Toronto, Canada'),
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].label).toBe('Hawaii')
    expect(segments[0].stops.map(stop=>stop.label)).toEqual(['Honolulu','Kahuku','Honolulu'])
  })

  it('collapses adjacent city stops but preserves a city revisited later',()=>{
    const segments=tripGroundRouteSegments([
      flight('outbound','2026-07-18T20:50','Toronto Pearson International Airport, Toronto, Canada','Dublin Airport, Dublin, Ireland'),
      item('hotel','2026-07-19T15:00','Maldron Hotel, Dublin, Ireland'),
      item('car','2026-07-20T09:00','Budget Car Rental, Dublin, Ireland'),
      item('belfast','2026-07-21T10:00','Titanic Belfast, Belfast, Northern Ireland'),
      item('return','2026-07-22T10:00','Dublin 8, Ireland'),
      flight('home','2026-07-23T09:00','Dublin Airport, Dublin, Ireland','Toronto Pearson International Airport, Toronto, Canada'),
    ])
    expect(segments[0].stops.map(stop=>stop.label)).toEqual(['Dublin','Belfast','Dublin'])
  })

  it('keeps distinct same-city addresses as daily map waypoints',()=>{
    const stops=dayWaypointStops([
      item('hotel','2026-02-01T09:00','1234 Hornby Street, Vancouver, BC V6Z 1W2'),
      item('duplicate','2026-02-01T10:00','1234 Hornby Street, Vancouver, BC V6Z 1W2'),
      item('event','2026-02-01T11:00','Stanley Park, Vancouver, British Columbia'),
      flight('flight','2026-02-01T12:00','Vancouver International Airport, Vancouver, British Columbia','Calgary International Airport, Calgary, Alberta'),
    ])
    expect(stops.map(stop=>stop.address)).toEqual([
      '1234 Hornby Street, Vancouver, BC V6Z 1W2',
      'Stanley Park, Vancouver, British Columbia',
    ])
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
    expect(segments[1].stops[segments[1].stops.length-1]?.address).toContain('Marienplatz')
    expect(segments.flatMap(segment=>segment.stops).some(stop=>stop.address.includes('Toronto'))).toBe(false)
  })
})
