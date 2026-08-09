import { describe,expect,it } from 'vitest'
import { validatedStoredTrip } from './storage'
import type { Trip } from './types'

const trip:Trip={
  id:'trip-1',name:'Validated cache',destination:'Toronto',
  createdAt:'2026-08-09T12:00:00.000Z',updatedAt:'2026-08-09T13:00:00.000Z',
  items:[{id:'flight-1',type:'flight',title:'Flight',start:'2026-08-10T09:00',timeZone:'America/Toronto',status:'confirmed'}],
}

describe('validated local trip cache',()=>{
  it('accepts and canonicalizes a valid legacy IndexedDB record',()=>{
    const candidate={...trip,localRuntimeSecret:'discard me',items:[{...trip.items[0],futureSecret:'discard me'}]}
    const validated=validatedStoredTrip(candidate)
    expect(validated).toEqual(trip)
    expect(JSON.stringify(validated)).not.toContain('futureSecret')
  })

  it('rejects malformed dates and time zones before activating a cached trip',()=>{
    expect(validatedStoredTrip({...trip,updatedAt:'not-an-instant'})).toBeUndefined()
    expect(validatedStoredTrip({...trip,items:[{...trip.items[0],timeZone:'Mars/Olympus'}]})).toBeUndefined()
  })

  it('rejects an oversized browser cache record',()=>{
    expect(validatedStoredTrip({...trip,items:[{...trip.items[0],notes:'x'.repeat(5_000_001)}]})).toBeUndefined()
  })
})
