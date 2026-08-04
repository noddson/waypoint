import { describe, expect, it } from 'vitest'
import { GroundRouteSegment } from './destinations'
import { routeStepFlightFilterId, routeStepFlightItemIds } from './routeSelection'

const segment:GroundRouteSegment={
  id:'ground-1',
  label:'Hawaii',
  stops:[
    {id:'hnl',label:'HNL',address:'Honolulu Airport'},
    {id:'kahuku',label:'Kahuku',address:'Kahuku, Hawaii'},
    {id:'return-hnl',label:'HNL',address:'Honolulu Airport'},
  ],
  arrivalFlightItemIds:['to-minneapolis','to-honolulu'],
  departureFlightItemIds:['to-san-francisco','home'],
}

describe('ground route flight selection',()=>{
  it('gives the first and last flight-bearing route stops independent filters',()=>{
    expect(routeStepFlightFilterId(segment,0)).toBe('flight:ground-1:arrival')
    expect(routeStepFlightFilterId(segment,2)).toBe('flight:ground-1:departure')
    expect(routeStepFlightFilterId(segment,1)).toBeUndefined()
  })

  it('selects only the flights represented by the chosen endpoint',()=>{
    expect(routeStepFlightItemIds(segment,0)).toEqual(['to-minneapolis','to-honolulu'])
    expect(routeStepFlightItemIds(segment,2)).toEqual(['to-san-francisco','home'])
  })
})
