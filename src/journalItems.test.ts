import { describe, expect, it } from 'vitest'
import { migrateLegacyJournalEntries, resolveJournalItemRelations } from './journalItems'
import { Trip, TripItem } from './types'

const itineraryItem:TripItem={id:'flight-1',type:'flight',title:'Toronto to Winnipeg',start:'2026-08-07T09:35',end:'2026-08-07T11:15',timeZone:'America/Toronto',location:'Toronto',status:'confirmed'}
const trip=(items:TripItem[]=[itineraryItem]):Trip=>({id:'trip-1',name:'Trip',destination:'Canada',createdAt:'2026-08-01T12:00:00Z',updatedAt:'2026-08-01T12:00:00Z',items})

describe('journal itinerary items',()=>{
  it('migrates legacy journal entries without losing notes, photos, or relationships',()=>{
    const legacy={...trip(),journalEntries:[{id:'entry-1',date:'2026-08-07',text:'Arrived safely.',relatedItemId:'flight-1',photos:[{id:'photo-1',driveFileId:'drive-1',name:'arrival.jpg',mimeType:'image/jpeg',size:10,createdAt:'2026-08-07T12:00:00Z'}],createdAt:'2026-08-07T12:00:00Z',updatedAt:'2026-08-07T12:00:00Z'}]}
    const migrated=migrateLegacyJournalEntries(legacy)
    expect(migrated.journalEntries).toBeUndefined()
    expect(migrated.items[1]).toMatchObject({id:'entry-1',type:'journal',title:'Arrived safely.',start:itineraryItem.start,end:itineraryItem.end,timeZone:itineraryItem.timeZone,location:itineraryItem.location,notes:'Arrived safely.',relatedItemId:'flight-1',photos:[{driveFileId:'drive-1'}]})
  })

  it('keeps related journal schedule and location inherited from the current itinerary item',()=>{
    const journal:TripItem={id:'journal-1',type:'journal',title:'Arrival',start:'2026-08-07T12:00',timeZone:'UTC',location:'Old location',relatedItemId:'flight-1',status:'planned'}
    const updated={...itineraryItem,start:'2026-08-07T10:05',location:'Toronto Pearson'}
    expect(resolveJournalItemRelations([updated,journal])[1]).toMatchObject({start:'2026-08-07T10:05',end:updated.end,timeZone:updated.timeZone,location:'Toronto Pearson'})
  })
})
