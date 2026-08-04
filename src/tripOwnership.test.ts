import { describe, expect, it } from 'vitest'
import { ownsTripItinerary } from './tripOwnership'

describe('ownsTripItinerary',()=>{
  it('treats independent local trips as owned',()=>{
    expect(ownsTripItinerary(false)).toBe(true)
  })

  it('treats Drive files owned by the current user as owned',()=>{
    expect(ownsTripItinerary(false,{ownedByMe:true})).toBe(true)
  })

  it('does not treat Drive files shared with the current user as owned',()=>{
    expect(ownsTripItinerary(false,{ownedByMe:false})).toBe(false)
  })

  it('disables access until legacy Drive ownership can be verified',()=>{
    expect(ownsTripItinerary(false,{})).toBe(false)
  })

  it('does not treat a received static snapshot as owned',()=>{
    expect(ownsTripItinerary(true)).toBe(false)
  })
})
