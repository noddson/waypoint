import { describe, expect, it } from 'vitest'
import { numberDriveRevisions, restoredTripFromVersion, restoredVersionTripName, versionHistoryEnabledFromStorage } from './versionHistory'
import { Trip } from './types'

describe('Drive version history',()=>{
  it('is opt-in',()=>{
    expect(versionHistoryEnabledFromStorage(null)).toBe(false)
    expect(versionHistoryEnabledFromStorage('disabled')).toBe(false)
    expect(versionHistoryEnabledFromStorage('enabled')).toBe(true)
  })

  it('numbers available revisions chronologically and identifies the Drive head',()=>{
    const revisions=numberDriveRevisions([
      {id:'newest-listed',modifiedTime:'2026-08-06T12:00:00.000Z'},
      {id:'oldest',modifiedTime:'2026-08-04T12:00:00.000Z'},
      {id:'head',modifiedTime:'2026-08-05T12:00:00.000Z'},
    ],'head')
    expect(revisions.map(revision=>[revision.id,revision.number,revision.current])).toEqual([
      ['oldest',1,false],
      ['head',2,true],
      ['newest-listed',3,false],
    ])
  })

  it('uses the newest available revision as current when the head ID is unavailable',()=>{
    const revisions=numberDriveRevisions([{id:'1',modifiedTime:'2026-08-04T12:00:00.000Z'},{id:'2',modifiedTime:'2026-08-05T12:00:00.000Z'}])
    expect(revisions.map(revision=>revision.current)).toEqual([false,true])
  })

  it('builds a stable restored-copy title from the selected version date',()=>{
    expect(restoredVersionTripName('Ireland',3,'2026-08-06T12:34:56.000Z')).toBe('Ireland (restored version 3 2026-08-06)')
  })

  it('restores a historical trip as a fresh, editable local copy without changing the source',()=>{
    const source:Trip={id:'original',name:'Ireland',destination:'Dublin',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-02-01T00:00:00.000Z',archivedAt:'2026-03-01T00:00:00.000Z',items:[{id:'item',type:'event',title:'Museum',start:'2026-07-01T10:00',timeZone:'Europe/Dublin',status:'planned'}]}
    const restored=restoredTripFromVersion(source,2,'2026-02-01T12:00:00.000Z','restored','2026-08-06T14:00:00.000Z')
    expect(restored).toMatchObject({id:'restored',name:'Ireland (restored version 2 2026-02-01)',createdAt:'2026-08-06T14:00:00.000Z',updatedAt:'2026-08-06T14:00:00.000Z'})
    expect(restored.archivedAt).toBeUndefined()
    expect(restored.items).not.toBe(source.items)
    expect(source.archivedAt).toBe('2026-03-01T00:00:00.000Z')
  })

})
