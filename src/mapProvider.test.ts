import { describe, expect, it } from 'vitest'
import { mapProviderFromStorage } from './mapProvider'

describe('map provider preference',()=>{
  it('defaults missing and unsupported values to Google Maps',()=>{
    expect(mapProviderFromStorage(null)).toBe('google')
    expect(mapProviderFromStorage('unsupported')).toBe('google')
  })

  it('restores Apple Maps when selected',()=>{
    expect(mapProviderFromStorage('apple')).toBe('apple')
  })
})
