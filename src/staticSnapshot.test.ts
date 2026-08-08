import { describe, expect, it } from 'vitest'
import { tripForStaticSnapshot } from './staticSnapshot'
import { Trip } from './types'

const trip:Trip={
  id:'trip-1',name:'Media trip',destination:'Toronto',createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-02T00:00:00Z',
  items:[{
    id:'journal-1',type:'journal',title:'Arrival',start:'2026-08-01T12:00',timeZone:'America/Toronto',status:'planned',notes:'We made it.',
    photos:[{id:'photo-1',driveFileId:'drive-photo',resourceKey:'photo-key',name:'arrival.jpg',mimeType:'image/jpeg',size:123,createdAt:'2026-08-01T12:01:00Z'}],
    audio:[{id:'audio-1',driveFileId:'drive-audio',resourceKey:'audio-key',name:'arrival.m4a',mimeType:'audio/mp4',size:456,createdAt:'2026-08-01T12:02:00Z'}],
  }],
}

describe('tripForStaticSnapshot',()=>{
  it('omits photo and audio references without changing the source trip',()=>{
    const snapshot=tripForStaticSnapshot(trip)

    expect(snapshot.items[0]).toMatchObject({id:'journal-1',title:'Arrival',notes:'We made it.'})
    expect(snapshot.items[0]).not.toHaveProperty('photos')
    expect(snapshot.items[0]).not.toHaveProperty('audio')
    expect(JSON.stringify(snapshot)).not.toContain('drive-photo')
    expect(JSON.stringify(snapshot)).not.toContain('drive-audio')
    expect(trip.items[0].photos).toHaveLength(1)
    expect(trip.items[0].audio).toHaveLength(1)
  })

  it('migrates legacy journal text while omitting its media references',()=>{
    const legacy:Trip={...trip,items:[],journalEntries:[{
      id:'legacy-1',date:'2026-08-01',text:'Legacy note',photos:trip.items[0].photos!,audio:trip.items[0].audio,
      createdAt:'2026-08-01T12:00:00Z',updatedAt:'2026-08-01T12:00:00Z',
    }]}

    const snapshot=tripForStaticSnapshot(legacy)

    expect(snapshot).not.toHaveProperty('journalEntries')
    expect(snapshot.items[0]).toMatchObject({id:'legacy-1',type:'journal',notes:'Legacy note'})
    expect(snapshot.items[0]).not.toHaveProperty('photos')
    expect(snapshot.items[0]).not.toHaveProperty('audio')
  })
})
