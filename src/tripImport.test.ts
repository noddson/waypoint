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
