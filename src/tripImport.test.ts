import { describe, expect, it } from 'vitest'
import { createTripExportV2, migrateTripExportToV2, safeHttpsLink, tripNameWithoutImportedSuffix, validTripExport } from './tripImport'
import { SCHEMA_VERSION, type Trip } from './types'

const exportData = () => ({
  schemaVersion:1,
  exportedAt:'2026-08-02T12:00:00.000Z',
  trip:{
    id:'trip-1',name:'Ireland',destination:'Ireland',createdAt:'2026-08-02T12:00:00.000Z',updatedAt:'2026-08-02T12:00:00.000Z',
    items:[{id:'item-1',type:'flight',title:'Toronto → Dublin',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed',bookedBy:'Nick',link:'https://airline.example/manage',emailLink:'https://mail.google.com/mail/#all/message-1'}],
  },
})

describe('Waypoint JSON validation', () => {
  it('emits schema v2 while continuing to accept schema v1 imports',()=>{
    expect(SCHEMA_VERSION).toBe(2)
    expect(validTripExport(exportData())).toBe(true)
    expect(validTripExport({...exportData(),schemaVersion:2})).toBe(true)
  })

  it('accepts a detailed item with booker attribution and an HTTPS link', () => {
    expect(validTripExport(exportData())).toBe(true)
  })

  it('accepts text and Drive-media journal entries',()=>{
    const value=exportData()
    ;(value.trip as typeof value.trip&{journalEntries:unknown[]}).journalEntries=[
      {id:'entry-1',date:'2026-07-18',text:'Arrived in Dublin.',relatedItemId:'item-1',photos:[],createdAt:'2026-07-18T12:00:00.000Z',updatedAt:'2026-07-18T12:00:00.000Z'},
      {id:'entry-2',date:'2026-07-19',photos:[{id:'photo-1',driveFileId:'drive-photo-1',resourceKey:'photo-key',name:'castle.jpg',mimeType:'image/jpeg',size:1234,createdAt:'2026-07-19T12:00:00.000Z'}],audio:[{id:'audio-1',driveFileId:'drive-audio-1',resourceKey:'audio-key',name:'music.m4a',mimeType:'audio/mp4',size:4321,createdAt:'2026-07-19T12:01:00.000Z'}],createdAt:'2026-07-19T12:00:00.000Z',updatedAt:'2026-07-19T12:00:00.000Z'},
    ]
    expect(validTripExport(value)).toBe(true)
  })

  it('rejects empty, malformed, and duplicate journal data',()=>{
    const empty=exportData();(empty.trip as typeof empty.trip&{journalEntries:unknown[]}).journalEntries=[{id:'entry-1',date:'2026-07-18',photos:[],createdAt:'2026-07-18T12:00:00.000Z',updatedAt:'2026-07-18T12:00:00.000Z'}]
    expect(validTripExport(empty)).toBe(false)
    const malformed=exportData();(malformed.trip as typeof malformed.trip&{journalEntries:unknown[]}).journalEntries=[{id:'entry-1',date:'July 18',text:'Note',photos:[],createdAt:'2026-07-18T12:00:00.000Z',updatedAt:'2026-07-18T12:00:00.000Z'}]
    expect(validTripExport(malformed)).toBe(false)
    const duplicate=exportData();(duplicate.trip as typeof duplicate.trip&{journalEntries:unknown[]}).journalEntries=[{id:'entry-1',date:'2026-07-18',text:'Note',photos:[{id:'photo-1',driveFileId:'file-1',name:'a.jpg',mimeType:'image/jpeg',size:1,createdAt:'2026-07-18T12:00:00.000Z'},{id:'photo-1',driveFileId:'file-2',name:'b.jpg',mimeType:'image/jpeg',size:1,createdAt:'2026-07-18T12:00:00.000Z'}],createdAt:'2026-07-18T12:00:00.000Z',updatedAt:'2026-07-18T12:00:00.000Z'}]
    expect(validTripExport(duplicate)).toBe(false)
    const wrongMime=exportData();(wrongMime.trip.items[0] as unknown as Record<string,unknown>)={...wrongMime.trip.items[0],type:'journal',audio:[{id:'audio-1',driveFileId:'drive-audio',name:'notes.txt',mimeType:'text/plain',size:20,createdAt:'2026-07-18T12:00:00.000Z'}]}
    expect(validTripExport(wrongMime)).toBe(false)
  })

  it('accepts a linked public calendar subscription and rejects an unsafe URL',()=>{
    const linked={...exportData(),calendarSubscription:{provider:'google-drive',format:'ics',mimeType:'text/calendar',access:'public-read-only',fileId:'calendar-file',resourceKey:'resource-key',publicUrl:'https://drive.google.com/uc?id=calendar-file&export=download',linkedAt:'2026-08-04T12:00:00.000Z'}}
    expect(validTripExport(linked)).toBe(true)
    linked.calendarSubscription.publicUrl='javascript:alert(1)'
    expect(validTripExport(linked)).toBe(false)
  })

  it('requires a source-email link to use HTTPS when present',()=>{
    const activeLink=exportData();activeLink.trip.items[0].emailLink='javascript:alert(1)'
    expect(validTripExport(activeLink)).toBe(false)
  })

  it('rejects active links, malformed optional fields, and duplicate IDs', () => {
    const activeLink=exportData();activeLink.trip.items[0].link='javascript:alert(1)'
    expect(validTripExport(activeLink)).toBe(false)
    const malformed=exportData();(malformed.trip.items[0] as unknown as Record<string,unknown>).bookedBy={name:'Nick'}
    expect(validTripExport(malformed)).toBe(false)
    const duplicate=exportData();duplicate.trip.items.push({...duplicate.trip.items[0]})
    expect(validTripExport(duplicate)).toBe(false)
  })

  it('strictly validates dates, time zones, identifiers, and aggregate size',()=>{
    const invalidExportTime=exportData();invalidExportTime.exportedAt='2026-02-31T12:00:00.000Z'
    expect(validTripExport(invalidExportTime)).toBe(false)
    const invalidStart=exportData();invalidStart.trip.items[0].start='2026-02-30T20:50'
    expect(validTripExport(invalidStart)).toBe(false)
    const invalidZone=exportData();invalidZone.trip.items[0].timeZone='Mars/Olympus_Mons'
    expect(validTripExport(invalidZone)).toBe(false)
    const emptyId=exportData();emptyId.trip.items[0].id=''
    expect(validTripExport(emptyId)).toBe(false)
    const oversized=exportData()
    oversized.trip.items=Array.from({length:450},(_,index)=>({...oversized.trip.items[0],id:`item-${index}`,notes:'x'.repeat(12_000)}))
    expect(validTripExport(oversized)).toBe(false)
  })

  it('rejects unknown or legacy envelope data in canonical v2 while v1 remains migratable',()=>{
    const v1=exportData() as ReturnType<typeof exportData>&Record<string,unknown>
    v1.futureMigrationField='ignored during migration'
    expect(validTripExport(v1)).toBe(true)
    const v2={...exportData(),schemaVersion:2,futureCanonicalField:'reject me'}
    expect(validTripExport(v2)).toBe(false)
    const nested={...exportData(),schemaVersion:2}
    ;(nested.trip.items[0] as unknown as Record<string,unknown>).futureCanonicalField='reject me too'
    expect(validTripExport(nested)).toBe(false)
    expect(validTripExport({...exportData(),schemaVersion:2,calendarSubscription:{}})).toBe(false)
  })

  it('rejects removed plan and reference item types', () => {
    for(const type of ['plan','reference']){
      const removed=exportData()
      ;(removed.trip.items[0] as unknown as Record<string,unknown>).type=type
      expect(validTripExport(removed)).toBe(false)
    }
  })

  it('normalizes only secure web links', () => {
    expect(safeHttpsLink('https://example.test/manage')).toBe('https://example.test/manage')
    expect(safeHttpsLink('http://example.test/manage')).toBeUndefined()
  })

  it('removes only the app-generated imported title suffix',()=>{
    expect(tripNameWithoutImportedSuffix('Kenora 2025 (imported)')).toBe('Kenora 2025')
    expect(tripNameWithoutImportedSuffix('Imported memories')).toBe('Imported memories')
  })

  it('validates advisory author references without accepting private profile fields',()=>{
    const value={...exportData(),schemaVersion:2}
    ;(value.trip.items[0] as unknown as Record<string,unknown>).createdBy={profileId:'profile-1',displayName:'Alex'}
    ;(value.trip.items[0] as unknown as Record<string,unknown>).updatedBy={profileId:'profile-2',displayName:'Sam'}
    expect(validTripExport(value)).toBe(true)
    ;((value.trip.items[0] as unknown as Record<string,unknown>).createdBy as Record<string,unknown>).email='alex@example.com'
    expect(validTripExport(value)).toBe(false)
  })

  it('migrates legacy envelopes to a private-data-only v2 canonical export',()=>{
    const legacy=exportData() as ReturnType<typeof exportData>&Record<string,unknown>
    legacy.calendarSubscription={provider:'google-drive',format:'ics',mimeType:'text/calendar',access:'public-read-only',fileId:'calendar-file',publicUrl:'https://drive.example/calendar',linkedAt:'2026-08-09T00:00:00.000Z'}
    legacy.collaboration={revision:'revision-1',drive:{fileId:'private-drive-id'}}
    ;(legacy.trip as unknown as Record<string,unknown>).futureTripSecret='drop me'
    ;(legacy.trip.items[0] as unknown as Record<string,unknown>).futureItemSecret='drop me too'
    const migrated=migrateTripExportToV2(legacy)
    expect(migrated).toMatchObject({schemaVersion:2,exportedAt:legacy.exportedAt,trip:{id:'trip-1',items:[{id:'item-1'}]}})
    expect(migrated).not.toHaveProperty('calendarSubscription')
    expect(migrated).not.toHaveProperty('collaboration')
    expect(migrated?.trip).not.toHaveProperty('futureTripSecret')
    expect(migrated?.trip.items[0]).not.toHaveProperty('futureItemSecret')
  })

  it('creates sanitized v2 exports from current trip data',()=>{
    const source=exportData().trip as Trip
    ;(source.items[0] as unknown as Record<string,unknown>).runtimeOnly='secret'
    const created=createTripExportV2(source,'2026-08-09T15:00:00.000Z')
    expect(created.schemaVersion).toBe(2)
    expect(created).not.toHaveProperty('calendarSubscription')
    expect(created.trip.items[0]).not.toHaveProperty('runtimeOnly')
    expect(source.items[0]).toHaveProperty('runtimeOnly','secret')
  })
})
