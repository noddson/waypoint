import { describe, expect, it } from 'vitest'
import { formatTripItemJson, parseTripItemsJson } from './itemJson'
import { TripItem } from './types'

const event:Omit<TripItem,'id'>={type:'event',title:'Museum visit',start:'2026-08-04T10:00',timeZone:'Europe/Dublin',status:'planned'}

describe('item JSON',()=>{
  it('loads one item and assigns a fresh id',()=>{
    const result=parseTripItemsJson(JSON.stringify({...event,id:'copied-id'}),()=> 'fresh-id')
    expect(result).toEqual({ok:true,items:[{...event,id:'fresh-id'}]})
  })

  it('loads arrays and items wrappers',()=>{
    let nextId=0
    const createId=()=>`new-${++nextId}`
    const array=parseTripItemsJson(JSON.stringify([event,{...event,title:'Dinner'}]),createId)
    const wrapper=parseTripItemsJson(JSON.stringify({items:[event]}),createId)
    expect(array.ok&&array.items.map(item=>item.id)).toEqual(['new-1','new-2'])
    expect(wrapper.ok&&wrapper.items[0]).toMatchObject({id:'new-3',title:'Museum visit'})
  })

  it('rejects malformed JSON, incomplete items, and unsafe links',()=>{
    const malformed=parseTripItemsJson('{')
    const incomplete=parseTripItemsJson(JSON.stringify({...event,title:''}))
    const unsafe=parseTripItemsJson(JSON.stringify({...event,link:'javascript:alert(1)'}))
    expect(!malformed.ok&&malformed.error).toMatch(/not valid/)
    expect(!incomplete.ok&&incomplete.error).toMatch(/title/)
    expect(!unsafe.ok&&unsafe.error).toMatch(/https/)
  })

  it('formats an item as readable JSON',()=>{
    expect(formatTripItemJson({...event,id:'item-1'})).toBe(JSON.stringify({...event,id:'item-1'},null,2))
  })
})
