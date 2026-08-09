import { beforeEach,describe,expect,it,vi } from 'vitest'
import { authorRefFromProfile,loadLocalProfile,profileStorageKey,removeLocalProfile,saveLocalProfile,selectNewestProfile,stampCreatedBy,stampUpdatedBy,storeLocalProfile,validProfileV1 } from './profile'

class MemoryStorage {
  values=new Map<string,string>()
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
  removeItem(key:string){this.values.delete(key)}
}

describe('local Waypoint profile',()=>{
  let storage:MemoryStorage

  beforeEach(()=>{
    storage=new MemoryStorage()
    vi.stubGlobal('localStorage',storage)
  })

  it('round-trips normalized details and keeps a stable profile id',()=>{
    const first=saveLocalProfile({name:'  A. Traveller  ',email:' traveller@example.com ',homeBase:' Toronto, Canada '},{now:'2026-08-09T12:00:00.000Z',createId:()=> 'profile-1'})
    expect(first).toEqual({schemaVersion:1,profileId:'profile-1',name:'A. Traveller',email:'traveller@example.com',homeBase:'Toronto, Canada',updatedAt:'2026-08-09T12:00:00.000Z'})
    expect(loadLocalProfile()).toEqual(first)

    const updated=saveLocalProfile({name:'Alex Traveller',email:'',homeBase:'Montréal, Canada'},{now:'2026-08-10T12:00:00.000Z',createId:()=> 'must-not-replace-id'})
    expect(updated.profileId).toBe('profile-1')
    expect(updated.updatedAt).toBe('2026-08-10T12:00:00.000Z')
    expect(loadLocalProfile()).toEqual(updated)
  })

  it('strictly rejects malformed, oversized, and extended profile records',()=>{
    const valid={schemaVersion:1,profileId:'profile-1',name:'Alex',email:'alex@example.com',homeBase:'Toronto',updatedAt:'2026-08-09T12:00:00.000Z'}
    expect(validProfileV1(valid)).toBe(true)
    expect(validProfileV1({...valid,schemaVersion:2})).toBe(false)
    expect(validProfileV1({...valid,name:' '})).toBe(false)
    expect(validProfileV1({...valid,email:'not-an-email'})).toBe(false)
    expect(validProfileV1({...valid,homeBase:'x'.repeat(501)})).toBe(false)
    expect(validProfileV1({...valid,updatedAt:'yesterday'})).toBe(false)
    expect(validProfileV1({...valid,updatedAt:'2026-02-31T12:00:00.000Z'})).toBe(false)
    expect(validProfileV1({...valid,privateToken:'secret'})).toBe(false)
    expect(()=>storeLocalProfile({...valid,email:'invalid'})).toThrow('profile is invalid')
  })

  it('ignores corrupt browser data and can remove a saved profile',()=>{
    storage.values.set(profileStorageKey,'{broken')
    expect(loadLocalProfile()).toBeUndefined()
    storage.values.set(profileStorageKey,JSON.stringify({schemaVersion:1}))
    expect(loadLocalProfile()).toBeUndefined()
    saveLocalProfile({name:'Alex',email:'',homeBase:''},{now:'2026-08-09T12:00:00.000Z',createId:()=> 'profile-1'})
    removeLocalProfile()
    expect(loadLocalProfile()).toBeUndefined()
  })

  it('selects the newest valid local or Drive profile without mutating it',()=>{
    const local={schemaVersion:1 as const,profileId:'profile-1',name:'Local',email:'',homeBase:'Toronto',updatedAt:'2026-08-09T12:00:00.000Z'}
    const drive={...local,name:'Drive',updatedAt:'2026-08-10T12:00:00.000Z'}
    expect(selectNewestProfile(local,drive)?.name).toBe('Drive')
    expect(selectNewestProfile({bad:true},local)?.name).toBe('Local')
    expect(selectNewestProfile({bad:true})).toBeUndefined()
  })

  it('stamps advisory author references without copying private profile fields',()=>{
    const profile={schemaVersion:1 as const,profileId:'profile-1',name:'Alex',email:'alex@example.com',homeBase:'Toronto',updatedAt:'2026-08-09T12:00:00.000Z'}
    expect(authorRefFromProfile(profile)).toEqual({profileId:'profile-1',displayName:'Alex'})
    const created=stampCreatedBy({id:'item-1',title:'Flight'},profile)
    expect(created).toEqual({id:'item-1',title:'Flight',createdBy:{profileId:'profile-1',displayName:'Alex'},updatedBy:{profileId:'profile-1',displayName:'Alex'}})
    expect(JSON.stringify(created)).not.toContain('alex@example.com')
    expect(JSON.stringify(created)).not.toContain('Toronto')

    const updated=stampUpdatedBy({...created,title:'New flight'},profile)
    expect(updated.createdBy).toEqual(created.createdBy)
    expect(updated.updatedBy).toEqual({profileId:'profile-1',displayName:'Alex'})
    expect(stampUpdatedBy({id:'item-1'},undefined)).toEqual({id:'item-1'})
  })
})
