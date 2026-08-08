import { describe, expect, it } from 'vitest'
import { itemFromEditor } from './itemEditor'
import { TripItem } from './types'

const item=(type:TripItem['type'],location?:string,endLocation?:string):TripItem=>({
  id:'item-1',type,title:'Item',start:'2026-08-07T12:00',timeZone:'America/Toronto',location,endLocation,status:'planned'
})

describe('item editor normalization',()=>{
  it('keeps a stay end location synchronized with its visible location',()=>{
    expect(itemFromEditor(item('stay','Hotel','Old address'))).toMatchObject({location:'Hotel',endLocation:'Hotel'})
    expect(itemFromEditor(item('stay',undefined,'Old address')).endLocation).toBeUndefined()
  })

  it('preserves distinct endpoints for travel item types',()=>{
    expect(itemFromEditor(item('car','Airport','Downtown'))).toMatchObject({location:'Airport',endLocation:'Downtown'})
  })
})
