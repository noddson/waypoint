import { describe, expect, it } from 'vitest'
import { destinationLabel, googleMapsSearchUrl, tripDestinations } from './destinations'
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
  })

  it('creates an encoded Google Maps search URL',()=>{
    expect(googleMapsSearchUrl('14 Lower William Street, Listowel, Ireland')).toBe('https://www.google.com/maps/search/?api=1&query=14%20Lower%20William%20Street%2C%20Listowel%2C%20Ireland')
  })
})
