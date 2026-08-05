import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPersistedTripId, closestUpcomingTrip, initialTrip, loadPersistedTripId, persistTripId } from './startupTrip'
import { Trip } from './types'

const trip = (id:string,start?:string,end?:string,archived=false):Trip => ({
  id,name:id,destination:'',createdAt:'2026-08-05T12:00:00.000Z',updatedAt:'2026-08-05T12:00:00.000Z',
  archivedAt:archived?'2026-08-05T12:00:00.000Z':undefined,
  items:start?[{id:`${id}-item`,type:'event',title:id,start,end,timeZone:'UTC',status:'confirmed'}]:[],
})

describe('startup trip',()=>{
  const trips=[trip('later','2026-10-10T09:00'),trip('persisted','2026-06-01T09:00'),trip('linked','2026-12-01T09:00'),trip('nearest','2026-08-12T09:00')]

  it('restores an explicitly persisted trip instead of choosing by travel date',()=>{
    expect(initialTrip(trips,undefined,'persisted','2026-08-05')?.id).toBe('persisted')
  })

  it('lets an explicit trip link take precedence over the persisted trip',()=>{
    expect(initialTrip(trips,'linked','persisted','2026-08-05')?.id).toBe('linked')
  })

  it('defaults to the closest upcoming non-archived trip when no trip was persisted',()=>{
    expect(initialTrip(trips,undefined,null,'2026-08-05')?.id).toBe('nearest')
  })

  it('ignores a persisted archived trip and opens the closest upcoming trip',()=>{
    const archived=trip('archived','2026-08-06T09:00',undefined,true)
    expect(initialTrip([archived,...trips],undefined,'archived','2026-08-05')?.id).toBe('nearest')
  })

  it('treats an in-progress trip as closer than a future trip',()=>{
    const current=trip('current','2026-08-01T09:00','2026-08-07T18:00')
    expect(closestUpcomingTrip([trips[3],current],'2026-08-05')?.id).toBe('current')
  })

  it('still opens an archived trip when an explicit link requests it',()=>{
    const archived=trip('archived','2026-08-06T09:00',undefined,true)
    expect(initialTrip([archived,...trips],'archived','persisted','2026-08-05')?.id).toBe('archived')
  })
})

describe('persisted startup choice',()=>{
  const values=new Map<string,string>()

  beforeEach(()=>{
    values.clear()
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>values.set(key,value),
      removeItem:(key:string)=>values.delete(key),
    })
  })

  it('changes only through the explicit persist and clear operations',()=>{
    expect(loadPersistedTripId()).toBeNull()
    persistTripId('chosen-trip')
    expect(loadPersistedTripId()).toBe('chosen-trip')
    clearPersistedTripId()
    expect(loadPersistedTripId()).toBeNull()
  })
})
