import { describe, expect, it } from 'vitest'
import { JournalAudio, JournalPhoto, Trip, TripItem } from './types'
import { retainExistingDriveJournalMedia, stripDriveJournalMediaFromTripCopy } from './tripMediaSafety'

const photo:JournalPhoto={id:'photo-local',driveFileId:'drive-photo',resourceKey:'photo-key',name:'arrival.jpg',mimeType:'image/jpeg',size:123,createdAt:'2026-08-01T12:00:00.000Z'}
const audio:JournalAudio={id:'audio-local',driveFileId:'drive-audio',resourceKey:'audio-key',name:'arrival.m4a',mimeType:'audio/mp4',size:456,createdAt:'2026-08-01T12:01:00.000Z'}
const journal:TripItem={id:'journal-1',type:'journal',title:'Arrival',start:'2026-08-01T12:00',timeZone:'Europe/Dublin',status:'planned',photos:[photo],audio:[audio]}
const trip:Trip={id:'trip-1',name:'Ireland',destination:'Dublin',createdAt:'2026-08-01T10:00:00.000Z',updatedAt:'2026-08-01T10:00:00.000Z',items:[journal],journalEntries:[{id:'legacy-1',date:'2026-08-01',text:'Legacy note',photos:[photo],audio:[audio],createdAt:'2026-08-01T12:00:00.000Z',updatedAt:'2026-08-01T12:00:00.000Z'}]}

describe('Drive journal media safety',()=>{
  it('strips Drive media references from current and legacy journals in a trip copy without mutating the source',()=>{
    const copied=stripDriveJournalMediaFromTripCopy(trip)

    expect(copied.items[0]).not.toHaveProperty('photos')
    expect(copied.items[0]).not.toHaveProperty('audio')
    expect(copied.journalEntries?.[0]).toMatchObject({text:'Legacy note',photos:[],audio:[]})
    expect(trip.items[0]).toMatchObject({photos:[photo],audio:[audio]})
    expect(trip.journalEntries?.[0]).toMatchObject({photos:[photo],audio:[audio]})
  })

  it('retains only existing Drive identities and restores their trusted metadata',()=>{
    const candidate:TripItem={
      ...journal,
      photos:[
        {...photo,id:'replacement-local-id',name:'tampered.jpg'},
        {...photo,id:'foreign-photo',driveFileId:'other-file'},
      ],
      audio:[{...audio,id:'replacement-audio-id'}],
    }
    const retained=retainExistingDriveJournalMedia(candidate,journal)

    expect(retained.photos).toEqual([photo])
    expect(retained.audio).toEqual([audio])
    expect(candidate.photos?.[0].name).toBe('tampered.jpg')
  })

  it('removes every Drive media reference from a newly pasted journal item',()=>{
    expect(retainExistingDriveJournalMedia(journal)).toMatchObject({photos:[],audio:[]})
  })

  it('requires an exact resource key match',()=>{
    const candidate={...journal,photos:[{...photo,resourceKey:'wrong-key'}]}
    expect(retainExistingDriveJournalMedia(candidate,journal).photos).toEqual([])
  })
})
