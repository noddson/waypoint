import { describe, expect, it } from 'vitest'
import { safeHttpsLink, tripNameWithoutImportedSuffix, validTripExport } from './tripImport'

const exportData = () => ({
  schemaVersion:1,
  exportedAt:'2026-08-02T12:00:00.000Z',
  trip:{
    id:'trip-1',name:'Ireland',destination:'Ireland',createdAt:'2026-08-02T12:00:00.000Z',updatedAt:'2026-08-02T12:00:00.000Z',
    items:[{id:'item-1',type:'flight',title:'Toronto → Dublin',start:'2026-07-18T20:50',timeZone:'America/Toronto',status:'confirmed',bookedBy:'Nick',link:'https://airline.example/manage',emailLink:'https://mail.google.com/mail/#all/message-1'}],
  },
})

describe('Waypoint JSON validation', () => {
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
})
