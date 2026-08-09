import { beforeEach,describe,expect,it,vi } from 'vitest'
import { isSavedSharedTrip,listSavedShares,removeSavedShare,savedShareForSource,savedShareListCategory,savedSharesForTripListTab,savedSharesStorageKey,saveSavedShare,validSavedShareDescriptorV1 } from './savedShares'

class MemoryStorage {
  values=new Map<string,string>()
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
}

const input={provider:'google-drive' as const,fileId:'drive-file-1',resourceKey:'resource-key',accessMode:'named-viewer' as const,tripId:'trip-1',tripName:'Toronto'}

describe('saved shared trips',()=>{
  let storage:MemoryStorage

  beforeEach(()=>{
    storage=new MemoryStorage()
    vi.stubGlobal('localStorage',storage)
  })

  it('persists a validated descriptor and looks it up by provider and file id',()=>{
    const share=saveSavedShare({...input,fileId:' drive-file-1 ',tripName:' Toronto '},'2026-08-09T12:00:00.000Z')
    expect(share).toEqual({schemaVersion:1,...input,savedAt:'2026-08-09T12:00:00.000Z',lastSavedAt:'2026-08-09T12:00:00.000Z'})
    expect(listSavedShares()).toEqual([share])
    expect(savedShareForSource('google-drive',' drive-file-1 ')).toEqual(share)
    expect(isSavedSharedTrip('trip-1')).toBe(true)
  })

  it('deduplicates by provider and file id while preserving the first saved time',()=>{
    saveSavedShare(input,'2026-08-09T12:00:00.000Z')
    const updated=saveSavedShare({...input,accessMode:'collaborator',tripName:'Toronto updated',lastPublishedAt:'2026-08-10T10:00:00.000Z'},'2026-08-10T12:00:00.000Z')
    expect(listSavedShares()).toHaveLength(1)
    expect(updated).toMatchObject({accessMode:'collaborator',tripName:'Toronto updated',savedAt:'2026-08-09T12:00:00.000Z',lastSavedAt:'2026-08-10T12:00:00.000Z',lastPublishedAt:'2026-08-10T10:00:00.000Z'})
    const refreshed=saveSavedShare({...input,resourceKey:undefined,tripName:'Toronto refreshed'},'2026-08-11T12:00:00.000Z')
    expect(refreshed).toMatchObject({resourceKey:'resource-key',lastPublishedAt:'2026-08-10T10:00:00.000Z'})
  })

  it('strictly rejects invalid descriptors and ignores malformed stored entries',()=>{
    const valid={schemaVersion:1,...input,savedAt:'2026-08-09T12:00:00.000Z',lastSavedAt:'2026-08-09T12:00:00.000Z'}
    expect(validSavedShareDescriptorV1(valid)).toBe(true)
    expect(validSavedShareDescriptorV1({...valid,accessMode:'owner'})).toBe(false)
    expect(validSavedShareDescriptorV1({...valid,savedAt:'not-a-date'})).toBe(false)
    expect(validSavedShareDescriptorV1({...valid,savedAt:'2026-02-31T12:00:00.000Z'})).toBe(false)
    expect(validSavedShareDescriptorV1({...valid,lastSavedAt:'2026-08-08T12:00:00.000Z'})).toBe(false)
    expect(validSavedShareDescriptorV1({...valid,oauthToken:'secret'})).toBe(false)
    expect(()=>saveSavedShare({...input,fileId:''},'2026-08-09T12:00:00.000Z')).toThrow('descriptor is invalid')

    storage.values.set(savedSharesStorageKey,JSON.stringify([valid,{...valid,fileId:''}]))
    expect(listSavedShares()).toEqual([valid])
    storage.values.set(savedSharesStorageKey,'{broken')
    expect(listSavedShares()).toEqual([])
  })

  it('keeps active received trips in Shared with Me and archived received trips in Archived',()=>{
    const active=saveSavedShare(input,'2026-08-09T12:00:00.000Z')
    const archived=saveSavedShare({...input,fileId:'drive-file-2',tripId:'trip-2',tripName:'Past trip',archivedAt:'2026-08-08T12:00:00.000Z'},'2026-08-10T12:00:00.000Z')
    const shares=listSavedShares()
    expect(savedShareListCategory(active)).toBe('shared-with-me')
    expect(savedShareListCategory(archived)).toBe('archived')
    expect(savedSharesForTripListTab(shares,'shared-with-me')).toEqual([active])
    expect(savedSharesForTripListTab(shares,'archived')).toEqual([archived])
    expect(savedSharesForTripListTab(shares,'local-only')).toEqual([])
  })

  it('removes only the exact provider/file source',()=>{
    saveSavedShare(input,'2026-08-09T12:00:00.000Z')
    saveSavedShare({...input,fileId:'drive-file-2',tripId:'trip-2'},'2026-08-10T12:00:00.000Z')
    expect(removeSavedShare('google-drive','drive-file-1')).toBe(true)
    expect(listSavedShares().map(share=>share.fileId)).toEqual(['drive-file-2'])
    expect(removeSavedShare('google-drive','drive-file-1')).toBe(false)
  })

  it('deduplicates corrupt arrays by keeping the newest valid source record',()=>{
    const older={schemaVersion:1,...input,savedAt:'2026-08-08T12:00:00.000Z',lastSavedAt:'2026-08-09T12:00:00.000Z'}
    const newer={...older,tripName:'Newest',lastSavedAt:'2026-08-10T12:00:00.000Z'}
    storage.values.set(savedSharesStorageKey,JSON.stringify([newer,older]))
    expect(listSavedShares()).toEqual([newer])
  })
})
