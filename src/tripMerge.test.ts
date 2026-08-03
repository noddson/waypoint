import { describe, expect, it } from 'vitest'
import { Trip, TripItem } from './types'
import { mergeTripVersions } from './tripMerge'

const item=(id:string,title:string):TripItem=>({id,type:'plan',title,start:'2026-07-18T10:00',timeZone:'UTC',status:'planned'})
const trip=(items:TripItem[]):Trip=>({id:'trip',name:'Trip',destination:'Dublin',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',items})

describe('collaborative trip merging',()=>{
  it('combines independent additions',()=>{
    const merged=mergeTripVersions(trip([]),trip([item('local','Local plan')]),trip([item('remote','Remote plan')]))
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

  it('carries archive state across devices',()=>{
    const base=trip([]),archived={...base,archivedAt:'2026-08-02T12:00:00Z'}
    expect(mergeTripVersions(base,base,archived).trip.archivedAt).toBe(archived.archivedAt)
    expect(mergeTripVersions(base,archived,base).trip.archivedAt).toBe(archived.archivedAt)
  })

  it('derives the route summary from merged item locations',()=>{
    const base=trip([]),localItem={...item('local','Kylemore stay'),location:'Kylemore House, Kylemore, Ireland'},remoteItem={...item('remote','Oranmore stay'),start:'2026-07-19T10:00',location:'Main Street, Oranmore, Ireland'}
    expect(mergeTripVersions(base,trip([localItem]),trip([remoteItem])).trip.destination).toBe('Kylemore → Oranmore')
  })

  it('refuses to merge data belonging to different trips',()=>{
    const base=trip([item('ireland','Ireland plan')])
    const hawaii={...trip([item('hawaii','Hawaii plan')]),id:'hawaii-trip'}
    expect(()=>mergeTripVersions(base,hawaii,base)).toThrow('Cannot merge different trips.')
  })
})
