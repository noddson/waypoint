import { describe, expect, it } from 'vitest'
import { copyRelatedDetailsToJournal, journalSnapshotForSave, migrateLegacyJournalEntries } from './journalItems'
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

  it('copies related item details once and leaves the journal snapshot independently editable',()=>{
    const journal:TripItem={id:'journal-1',type:'journal',title:'Arrival',start:'2026-08-07T12:00',timeZone:'UTC',location:'Old location',relatedItemId:'flight-1',status:'planned'}
    const linked=copyRelatedDetailsToJournal(journal,{...itineraryItem,allDay:true})
    expect(linked).toMatchObject({relatedItemId:itineraryItem.id,start:itineraryItem.start,end:itineraryItem.end,timeZone:itineraryItem.timeZone,location:itineraryItem.location,allDay:true})
    const edited={...linked,start:'2026-08-07T12:30',end:'2026-08-07T13:45',timeZone:'America/Winnipeg',location:'The Forks',allDay:false}
    const changedItinerary={...itineraryItem,start:'2026-08-07T10:05',location:'Toronto Pearson'}
    expect(journalSnapshotForSave(edited,changedItinerary,'2026-08-08T01:00:00Z')).toMatchObject({relatedItemId:changedItinerary.id,start:'2026-08-07T12:30',end:'2026-08-07T13:45',timeZone:'America/Winnipeg',location:'The Forks',updatedAt:'2026-08-08T01:00:00Z'})
  })

  it('removes only the relationship when a journal item is unlinked',()=>{
    const journal:TripItem={id:'journal-1',type:'journal',title:'Arrival',start:'2026-08-07T12:30',end:'2026-08-07T13:45',timeZone:'America/Winnipeg',location:'The Forks',relatedItemId:'flight-1',status:'planned'}
    expect(copyRelatedDetailsToJournal(journal)).toEqual({...journal,relatedItemId:undefined})
  })
})
