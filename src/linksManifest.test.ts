import { beforeEach,describe,expect,it,vi } from 'vitest'
import { loadLocalLinksManifest, linksManifestStorageKey, updateTripLinksManifest, validLinksManifestV1 } from './linksManifest'
import { DEFAULT_PUBLIC_SHARE_POLICY } from './sharePolicy'

describe('private sharing manifest persistence',()=>{
  let values:Map<string,string>
  beforeEach(()=>{values=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)})})
  it('stores trip policies without permission snapshots or media references',()=>{const manifest=updateTripLinksManifest(undefined,'trip-1',{publicTrip:{enabled:false,policy:DEFAULT_PUBLIC_SHARE_POLICY,policyHash:'abc'}} ,'2026-08-09T12:00:00.000Z');expect(loadLocalLinksManifest()).toEqual(manifest);expect(values.get(linksManifestStorageKey)).not.toContain('permissions');expect(values.get(linksManifestStorageKey)).not.toContain('driveFileId')})
  it('fails closed for malformed entries and impossible timestamps',()=>{
    expect(validLinksManifestV1({schemaVersion:1,updatedAt:'x',trips:{trip:{publicTrip:{enabled:true,permissions:[]}}}})).toBe(false)
    expect(validLinksManifestV1({schemaVersion:1,updatedAt:'2026-02-31T12:00:00.000Z',trips:{}})).toBe(false)
    expect(validLinksManifestV1({schemaVersion:1,updatedAt:'2026-08-09T12:00:00.000Z',trips:{trip:{publicTrip:{enabled:true,reviewRequired:'yes'}}}})).toBe(false)
  })
  it('persists the durable sensitive-review gate for a pending broader policy',()=>{const manifest=updateTripLinksManifest(undefined,'trip-1',{publicTrip:{enabled:true,policy:DEFAULT_PUBLIC_SHARE_POLICY,reviewRequired:true,stale:true}},'2026-08-09T12:00:00.000Z');expect(loadLocalLinksManifest()?.trips['trip-1'].publicTrip).toMatchObject({reviewRequired:true,stale:true})})
})
