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

  it('supports journal relationship, photo, and audio metadata through the normal item JSON editor',()=>{
    const journal={...event,type:'journal' as const,title:'Arrival notes',relatedItemId:'flight-1',notes:'Smooth landing.',photos:[{id:'copied-photo',driveFileId:'drive-photo',name:'arrival.jpg',mimeType:'image/jpeg',size:123,createdAt:'2026-08-04T10:05:00Z'}],audio:[{id:'copied-audio',driveFileId:'drive-audio',name:'arrival.m4a',mimeType:'audio/mp4',size:456,createdAt:'2026-08-04T10:06:00Z'}]}
    const result=parseTripItemsJson(JSON.stringify(journal),()=> 'fresh-id')
    expect(result.ok&&result.items[0]).toMatchObject({id:'fresh-id',type:'journal',relatedItemId:'flight-1',notes:'Smooth landing.',photos:[{driveFileId:'drive-photo'}]})
    expect(result.ok&&result.items[0].photos?.[0].id).not.toBe('copied-photo')
    expect(result.ok&&result.items[0].audio?.[0]).toMatchObject({driveFileId:'drive-audio'})
    expect(result.ok&&result.items[0].audio?.[0].id).not.toBe('copied-audio')
  })

  it('keeps journal associations intact when related items are pasted together',()=>{
    let nextId=0
    const result=parseTripItemsJson(JSON.stringify([{...event,id:'event-copy'},{...event,id:'journal-copy',type:'journal',title:'Visit notes',relatedItemId:'event-copy'}]),()=>`fresh-${++nextId}`)
    expect(result.ok&&result.items).toMatchObject([{id:'fresh-1'},{id:'fresh-2',relatedItemId:'fresh-1'}])
  })

  it('preserves optional schema fields regardless of whether the type exposes them in the form',()=>{
    const source={...event,type:'insurance' as const,end:'2026-08-04T11:00',endTimeZone:'Europe/London',location:'Hidden start',endLocation:'Hidden end',provider:'Provider',relatedItemId:'related-1',conflictOf:'original-1',conflictSource:'drive' as const}
    const result=parseTripItemsJson(JSON.stringify(source),()=> 'fresh-id')
    expect(result.ok&&result.items[0]).toEqual({...source,id:'fresh-id'})
  })
})
