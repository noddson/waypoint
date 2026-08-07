import { describe, expect, it } from 'vitest'
import { JournalEntry, SCHEMA_VERSION, Trip, TripItem } from './types'
import { mergeTripVersions } from './tripMerge'
import { validTripExport } from './tripImport'

const item=(id:string,title:string):TripItem=>({id,type:'event',title,start:'2026-07-18T10:00',timeZone:'UTC',status:'planned'})
const trip=(items:TripItem[]):Trip=>({id:'trip',name:'Trip',destination:'Dublin',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',items})
const entry=(id:string,text:string):JournalEntry=>({id,date:'2026-07-18',text,photos:[],createdAt:'2026-07-18T12:00:00Z',updatedAt:'2026-07-18T12:00:00Z'})

describe('collaborative trip merging',()=>{
  it('combines independent additions',()=>{
    const merged=mergeTripVersions(trip([]),trip([item('local','Local event')]),trip([item('remote','Remote event')]))
    expect(merged.conflicts).toBe(0)
    expect(merged.trip.items.map(value=>value.id).sort()).toEqual(['local','remote'])
  })

  it('keeps both versions when the same item changed differently',()=>{
    const base=trip([item('shared','Original')])
    const merged=mergeTripVersions(base,trip([item('shared','Local edit')]),trip([item('shared','Drive edit')]))
    expect(merged.conflicts).toBe(1)
    expect(merged.trip.items).toHaveLength(2)
    expect(merged.trip.items.map(value=>value.title).sort()).toEqual(['Drive edit (Drive conflict)','Local edit (local conflict)'])
    expect(merged.trip.items.map(value=>value.conflictSource).sort()).toEqual(['drive','local'])
  })

  it('uses a one-sided edit without duplication',()=>{
    const base=trip([item('shared','Original')])
    const merged=mergeTripVersions(base,base,trip([item('shared','Drive edit')]))
    expect(merged.conflicts).toBe(0)
    expect(merged.trip.items[0].title).toBe('Drive edit')
  })

  it('lets deletion beat an unchanged item but preserves an edited item',()=>{
    const base=trip([item('shared','Original')])
    expect(mergeTripVersions(base,trip([]),base).trip.items).toEqual([])
    expect(mergeTripVersions(base,trip([]),trip([item('shared','Drive edit')])).trip.items[0].title).toBe('Drive edit')
    expect(mergeTripVersions(base,trip([item('shared','Local edit')]),trip([])).trip.items[0].title).toBe('Local edit')
  })

  it('carries archive state across devices',()=>{
    const base=trip([]),archived={...base,archivedAt:'2026-08-02T12:00:00Z'}
    expect(mergeTripVersions(base,base,archived).trip.archivedAt).toBe(archived.archivedAt)
    expect(mergeTripVersions(base,archived,base).trip.archivedAt).toBe(archived.archivedAt)
  })

  it('combines independent journal entries and keeps concurrent edits',()=>{
    const base={...trip([]),journalEntries:[entry('shared','Original')]}
    const local={...base,journalEntries:[entry('shared','Local edit'),entry('local','Local note')]}
    const remote={...base,journalEntries:[entry('shared','Drive edit'),entry('remote','Drive note')]}
    const merged=mergeTripVersions(base,local,remote)
    expect(merged.conflicts).toBe(1)
    expect(merged.trip.journalEntries).toHaveLength(4)
    expect(merged.trip.journalEntries?.map(value=>value.text).sort()).toEqual(['Drive edit','Drive note','Local edit','Local note'])
    expect(merged.trip.journalEntries?.filter(value=>value.conflictOf==='shared').map(value=>value.conflictSource).sort()).toEqual(['drive','local'])
  })

  it('gives duplicated photo descriptors fresh IDs when a journal entry conflicts',()=>{
    const shared={...entry('shared','Original'),photos:[{id:'photo',driveFileId:'drive-photo',name:'lake.jpg',mimeType:'image/jpeg',size:1200,createdAt:'2026-07-18T12:00:00Z'}]}
    const base={...trip([]),journalEntries:[shared]}
    const merged=mergeTripVersions(base,{...base,journalEntries:[{...shared,text:'Local edit'}]},{...base,journalEntries:[{...shared,text:'Drive edit'}]})
    const photos=merged.trip.journalEntries!.flatMap(value=>value.photos)
    expect(new Set(photos.map(photo=>photo.id)).size).toBe(2)
    expect(new Set(photos.map(photo=>photo.driveFileId))).toEqual(new Set(['drive-photo']))
    expect(validTripExport({schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),trip:merged.trip})).toBe(true)
  })

  it('preserves an edited journal entry when the other side deletes it',()=>{
    const base={...trip([]),journalEntries:[entry('shared','Original')]}
    const local={...base,journalEntries:[]}
    const remote={...base,journalEntries:[entry('shared','Drive edit')]}
    expect(mergeTripVersions(base,local,remote).trip.journalEntries?.[0].text).toBe('Drive edit')
  })

  it('derives the route summary from merged item locations',()=>{
    const base=trip([]),localItem={...item('local','Kylemore stay'),location:'Kylemore House, Kylemore, Ireland'},remoteItem={...item('remote','Oranmore stay'),start:'2026-07-19T10:00',location:'Main Street, Oranmore, Ireland'}
    expect(mergeTripVersions(base,trip([localItem]),trip([remoteItem])).trip.destination).toBe('Kylemore → Oranmore')
  })

  it('refuses to merge data belonging to different trips',()=>{
    const base=trip([item('ireland','Ireland event')])
    const hawaii={...trip([item('hawaii','Hawaii event')]),id:'hawaii-trip'}
    expect(()=>mergeTripVersions(base,hawaii,base)).toThrow('Cannot merge different trips.')
  })
})
