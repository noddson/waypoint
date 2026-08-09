import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTripListTab, saveTripListTab } from './tripList'

describe('trip list tab storage',()=>{
  const values=new Map<string,string>()

  beforeEach(()=>{
    values.clear()
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>values.set(key,value),
    })
  })

  it('defaults to favourites and restores the last selected tab',()=>{
    expect(loadTripListTab()).toBe('favourites')
    saveTripListTab('local-only')
    expect(loadTripListTab()).toBe('local-only')
    saveTripListTab('shared-with-me')
    expect(loadTripListTab()).toBe('shared-with-me')
  })

  it('ignores an unknown stored tab',()=>{
    values.set('waypoint-trip-list-tab','unknown')
    expect(loadTripListTab()).toBe('favourites')
  })
})
