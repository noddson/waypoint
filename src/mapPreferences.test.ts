import { describe, expect, it, vi } from 'vitest'
import { MAP_PROVIDER_SESSION_KEY, readMapProvider, saveMapProvider } from './mapPreferences'

describe('map provider session preference',()=>{
  it('defaults to Google Maps and restores Apple Maps',()=>{
    expect(readMapProvider({getItem:()=>null})).toBe('google')
    expect(readMapProvider({getItem:()=> 'apple'})).toBe('apple')
    expect(readMapProvider({getItem:()=> 'unexpected'})).toBe('google')
  })

  it('saves the choice under the session key',()=>{
    const setItem=vi.fn()
    saveMapProvider('apple',{setItem})
    expect(setItem).toHaveBeenCalledWith(MAP_PROVIDER_SESSION_KEY,'apple')
  })
})
