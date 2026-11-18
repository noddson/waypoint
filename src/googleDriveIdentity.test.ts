import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from './types'

class MemoryStorage {
  private values=new Map<string,string>()
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
  removeItem(key:string){this.values.delete(key)}
}
const local:Trip={id:'same-trip',name:'Workshop',destination:'Philadelphia',createdAt:'2026-09-22T01:52:00.000Z',updatedAt:'2026-09-22T02:31:00.000Z',items:[]}
const remote:Trip={...local,updatedAt:'2026-11-18T22:41:00.000Z',items:[{id:'class',type:'event',title:'Hard CORE Staff',start:'2026-11-21T09:40',timeZone:'America/New_York',status:'planned'}]}
const file=(id:string,canonical=false)=>({id,name:'Workshop.waypoint.json',modifiedTime:'2026-11-18T23:08:00.000Z',appProperties:{waypoint:'trip',tripId:local.id,...(canonical?{waypointCanonicalTrip:'true'}:{})}})
const json=(body:unknown)=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}})

describe('Drive trip identity across devices',()=>{
  let files:ReturnType<typeof file>[],requests:Array<{url:URL;init:RequestInit}>
  let fetchMock:ReturnType<typeof vi.fn>
  beforeEach(()=>{
    vi.resetModules()
    vi.stubGlobal('localStorage',new MemoryStorage())
    const session=new MemoryStorage()
    session.setItem('waypoint-drive-session',JSON.stringify({accessToken:'test-token',expiresAt:Date.now()+60_000}))
    vi.stubGlobal('sessionStorage',session)
    files=[file('phone-file')];requests=[]
    fetchMock=vi.fn(async(input:string,init:RequestInit={})=>{
      const url=new URL(String(input));requests.push({url,init})
      if(url.pathname==='/drive/v3/files'&&url.searchParams.has('q'))return json({files})
      const id=url.pathname.split('/').pop(),found=files.find(value=>value.id===id)
      if(!found)throw new Error(`Unexpected Drive request: ${url.pathname}`)
      if(init.method==='PATCH'){
        const update=JSON.parse(String(init.body))
        for(const [key,value] of Object.entries(update.appProperties||{})){
          if(value===null)delete (found.appProperties as Record<string,string>)[key]
          else (found.appProperties as Record<string,string>)[key]=String(value)
        }
        return json({id})
      }
      if(url.searchParams.get('alt')==='media')return json({schemaVersion:3,exportedAt:'2026-11-18T23:08:00.000Z',trip:remote})
      return json({...found,ownedByMe:true,headRevisionId:'head-current',version:'7',parents:['trip-folder'],capabilities:{canEdit:true,canShare:true,canDownload:true}})
    })
    vi.stubGlobal('fetch',fetchMock)
  })
  afterEach(()=>vi.unstubAllGlobals())

  it('recovers the same trip from another device without creating or overwriting a file',async()=>{
    const {createDriveTrip,getDriveSyncRecord}=await import('./googleDrive')
    const record=await createDriveTrip(local)
    expect(record.fileId).toBe('phone-file')
    expect(record.baseTrip).toEqual(remote)
    expect(record.lastSyncedUpdatedAt).toBe(remote.updatedAt)
    expect(getDriveSyncRecord(local.id)?.fileId).toBe('phone-file')
    expect(requests.every(({init})=>!init.method||init.method==='GET')).toBe(true)
    const q=requests[0].url.searchParams.get('q')!
    expect(q).toContain("key='tripId' and value='same-trip'")
    expect(q).toContain("'me' in owners")
    expect(q).toContain("mimeType='application/json'")
    expect(q).not.toContain(' in parents')
  })

  it('blocks duplicate copies instead of choosing the newest modification timestamp',async()=>{
    files=[file('phone-file'),{...file('desktop-file'),modifiedTime:'2026-11-18T23:10:00.000Z'}]
    const {createDriveTrip,DriveTripIdentityError,getDriveSyncRecord}=await import('./googleDrive')
    await expect(createDriveTrip(local)).rejects.toBeInstanceOf(DriveTripIdentityError)
    expect(getDriveSyncRecord(local.id)).toBeUndefined()
    expect(requests).toHaveLength(1)
    expect(requests.some(({init})=>init.method==='POST'||init.method==='PATCH')).toBe(false)
  })

  it('blocks an existing linked duplicate before any content or metadata write',async()=>{
    files=[file('phone-file'),file('desktop-file')]
    const {updateDriveTrip,DriveTripIdentityError}=await import('./googleDrive')
    await expect(updateDriveTrip({tripId:local.id,fileId:'desktop-file',ownedByMe:true,lastSyncedUpdatedAt:local.updatedAt,lastSynchronizedAt:local.updatedAt,baseTrip:local},local)).rejects.toBeInstanceOf(DriveTripIdentityError)
    expect(requests.every(({init})=>!init.method||init.method==='GET')).toBe(true)
  })

  it('records an explicit account-wide choice while keeping both JSON copies unchanged',async()=>{
    files=[file('phone-file'),file('desktop-file',true)]
    const {selectCurrentDriveTripFile,createDriveTrip}=await import('./googleDrive')
    await selectCurrentDriveTripFile(local.id,'phone-file')
    expect(files).toHaveLength(2)
    expect(files[0].appProperties.waypointCanonicalTrip).toBe('true')
    expect(files[1].appProperties.waypointCanonicalTrip).toBeUndefined()
    const writes=requests.filter(({init})=>init.method==='PATCH')
    expect(writes).toHaveLength(2)
    expect(writes.every(({init})=>Object.keys(JSON.parse(String(init.body))).join()==='appProperties')).toBe(true)
    expect((await createDriveTrip(local)).fileId).toBe('phone-file')
  })

  it('asks an old device to open the chosen file rather than upload stale data over it',async()=>{
    files=[file('phone-file',true),file('desktop-file')]
    const {updateDriveTrip}=await import('./googleDrive')
    await expect(updateDriveTrip({tripId:local.id,fileId:'desktop-file',ownedByMe:true,lastSyncedUpdatedAt:local.updatedAt,lastSynchronizedAt:local.updatedAt,baseTrip:local},local)).rejects.toMatchObject({preferredFileId:'phone-file'})
    expect(requests.some(({init})=>init.method==='PATCH')).toBe(false)
  })

  it('fails closed when two devices concurrently select different current copies',async()=>{
    files=[file('phone-file',true),file('desktop-file',true)]
    const {createDriveTrip}=await import('./googleDrive')
    await expect(createDriveTrip(local)).rejects.toMatchObject({name:'DriveTripIdentityError',preferredFileId:undefined})
  })

  it('searches every page before deciding that a trip is unique',async()=>{
    fetchMock.mockImplementationOnce(async(input:string)=>{requests.push({url:new URL(input),init:{}});return json({files:[file('one')],nextPageToken:'page-2'})})
    const {findOwnedDriveTripFiles}=await import('./googleDrive')
    expect((await findOwnedDriveTripFiles(local.id)).map(value=>value.id)).toEqual(['one','phone-file'])
    expect(requests[1].url.searchParams.get('pageToken')).toBe('page-2')
  })

  it('does not create anything when Drive cannot complete the identity search',async()=>{
    fetchMock.mockResolvedValueOnce(json({files:[],incompleteSearch:true}))
    const {createDriveTrip}=await import('./googleDrive')
    await expect(createDriveTrip(local)).rejects.toThrow('could not finish checking')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((await createDriveTrip(local)).fileId).toBe('phone-file')
  })

  it('rechecks the browser link after waiting for another tab to finish creation',async()=>{
    const {createDriveTrip,saveDriveSyncRecord}=await import('./googleDrive')
    const linked={tripId:local.id,fileId:'phone-file',lastSyncedUpdatedAt:remote.updatedAt,lastSynchronizedAt:remote.updatedAt,baseTrip:remote}
    const request=vi.fn(async(_name:string,create:()=>Promise<unknown>)=>{saveDriveSyncRecord(linked);return create()})
    vi.stubGlobal('navigator',{locks:{request}})
    expect(await createDriveTrip(local)).toMatchObject({fileId:'phone-file'})
    expect(request).toHaveBeenCalledWith('waypoint-create-trip:same-trip',expect.any(Function))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not reuse a file whose embedded trip identity disagrees with its metadata',async()=>{
    fetchMock.mockImplementationOnce(async()=>json({files}))
    fetchMock.mockImplementationOnce(async()=>json({...file('phone-file'),ownedByMe:true}))
    fetchMock.mockImplementationOnce(async()=>json({schemaVersion:3,exportedAt:'2026-11-18T23:08:00.000Z',trip:{...remote,id:'different-trip'}}))
    const {createDriveTrip,getDriveSyncRecord}=await import('./googleDrive')
    await expect(createDriveTrip(local)).rejects.toThrow('could not be verified')
    expect(getDriveSyncRecord(local.id)).toBeUndefined()
  })

  it('stops a stale tab after another tab relinks the same trip',async()=>{
    const {saveDriveSyncRecord,updateDriveTrip}=await import('./googleDrive')
    saveDriveSyncRecord({tripId:local.id,fileId:'phone-file',lastSyncedUpdatedAt:remote.updatedAt,lastSynchronizedAt:remote.updatedAt})
    await expect(updateDriveTrip({tripId:local.id,fileId:'desktop-file',lastSyncedUpdatedAt:local.updatedAt,lastSynchronizedAt:local.updatedAt},local)).rejects.toThrow('another tab')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
