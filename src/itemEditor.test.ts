import { describe, expect, it } from 'vitest'
import { itemFromEditor, itemTypeForFilter } from './itemEditor'
import { TripItem, types } from './types'

const item=(type:TripItem['type'],location?:string,endLocation?:string):TripItem=>({
  id:'item-1',type,title:'Item',start:'2026-08-07T12:00',timeZone:'America/Toronto',location,endLocation,status:'planned'
})

describe('item editor normalization',()=>{
  it.each(types)('preserves every existing schema field when saving a %s form',type=>{
    const source={...item(type,'Start location','End location'),endTimeZone:'America/Winnipeg',provider:'Provider',relatedItemId:'related-1'}
    expect(itemFromEditor(source)).toEqual(source)
  })

  it('uses the active item filter as the new-item type and defaults All to Event',()=>{
    for(const type of types)expect(itemTypeForFilter(type)).toBe(type)
    expect(itemTypeForFilter('all')).toBe('event')
  })
})
