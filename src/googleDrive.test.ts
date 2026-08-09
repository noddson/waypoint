import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Trip } from './types'

class MemoryStorage implements Storage {
  private values=new Map<string,string>()
  get length(){return this.values.size}
  clear(){this.values.clear()}
  getItem(key:string){return this.values.get(key)??null}
  key(index:number){return [...this.values.keys()][index]??null}
  removeItem(key:string){this.values.delete(key)}
  setItem(key:string,value:string){this.values.set(key,String(value))}
}

type Reply = {status?:number;body?:unknown;rawBody?:string;headers?:Record<string,string>}
const trip:Trip={id:'trip-1',name:'Restored trip',destination:'Dublin',createdAt:'2026-08-06T11:41:00.000Z',updatedAt:'2026-08-06T11:41:00.000Z',items:[]}
const canonicalBindingReply = (fileId:string,parentId?:string):Reply => ({body:{id:fileId,name:`${trip.name}.waypoint.json`,ownedByMe:true,parents:parentId?[parentId]:[],appProperties:{waypoint:'trip',tripId:trip.id},capabilities:{canEdit:true,canShare:true,canAddChildren:true}}})
const folderBindingReply = (fileId:string,waypoint:string,parentId?:string):Reply => ({body:{id:fileId,name:fileId,ownedByMe:true,parents:parentId?[parentId]:[],appProperties:{waypoint,tripId:trip.id},capabilities:{canEdit:true,canShare:true,canAddChildren:true}}})
const publicationBindingReply = (fileId:string,audience:'public'|'named'):Reply => ({body:{id:fileId,name:`${audience}.waypoint.json`,ownedByMe:true,appProperties:{waypoint:'published-trip',tripId:trip.id,audience},capabilities:{canEdit:true,canShare:true}}})
const shareableReply = (fileId:string):Reply => ({body:{id:fileId,ownedByMe:true,capabilities:{canEdit:true,canShare:true,canAddChildren:true}}})
const calendarBindingReply = (fileId:string,parentId='calendar-folder'):Reply => ({body:{id:fileId,name:`${trip.name}.ics`,ownedByMe:true,parents:[parentId],appProperties:{waypoint:'calendar',tripId:trip.id},capabilities:{canEdit:true,canShare:true}}})
const privateRoot = (id:string)=>({id,name:'Waypoint travel planner',ownedByMe:true,shared:false,writersCanShare:false,appProperties:{waypoint:'waypoint-root'},capabilities:{canShare:true},permissions:[{id:'owner',type:'user',role:'owner'}]})
const privateRootListReply = (id:string):Reply => ({body:{files:[privateRoot(id)]}})

describe.sequential('Google Drive bootstrap revision cleanup',()=>{
  let replies:Reply[]
  let fetchMock:ReturnType<typeof vi.fn>

  beforeEach(()=>{
    vi.resetModules()
    const sessionStorage=new MemoryStorage(),localStorage=new MemoryStorage()
    sessionStorage.setItem('waypoint-drive-session',JSON.stringify({accessToken:'test-token',expiresAt:Date.now()+60_000}))
    vi.stubGlobal('sessionStorage',sessionStorage)
    vi.stubGlobal('localStorage',localStorage)
    replies=[]
    fetchMock=vi.fn(async()=>{
      const reply=replies.shift()
      if(!reply)throw new Error('Unexpected Google Drive request')
      const status=reply.status??200
      const body=status===204?null:reply.rawBody??JSON.stringify(reply.body??{})
      return new Response(body,{status,headers:status===204?undefined:{'Content-Type':'application/json',...reply.headers}})
    })
    vi.stubGlobal('fetch',fetchMock)
  })

  afterEach(()=>vi.unstubAllGlobals())

  it('exposes the provider-neutral adapter with only the drive.file OAuth scope',async()=>{
    const {googleDriveProvider}=await import('./googleDrive')
    expect(googleDriveProvider).toMatchObject({id:'google-drive',label:'Google Drive',scope:'https://www.googleapis.com/auth/drive.file'})
    expect(googleDriveProvider.session()).toMatchObject({provider:'google-drive',connected:true})
  })

  it('refuses to write when the app-bound Waypoint root has ever been shared',async()=>{
    const profile={schemaVersion:1 as const,profileId:'profile-1',name:'Alex',email:'alex@example.com',homeBase:'Toronto, Canada',updatedAt:'2026-08-09T12:00:00.000Z'}
    replies.push(
      {body:{files:[{...privateRoot('unsafe-root'),shared:true,permissions:[{id:'owner',type:'user',role:'owner'},{id:'public',type:'anyone',role:'reader'}]}]}},
    )
    const {saveDriveProfile}=await import('./googleDrive')

    await expect(saveDriveProfile(profile)).rejects.toThrow('root has non-owner Google Drive access')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method&&call[1]?.method!=='GET')).toBe(false)
  })

  it('fails closed when Drive does not prove a newly created Waypoint root is private and owner-only',async()=>{
    const profile={schemaVersion:1 as const,profileId:'profile-1',name:'Alex',email:'alex@example.com',homeBase:'Toronto, Canada',updatedAt:'2026-08-09T12:00:00.000Z'}
    replies.push(
      {body:{files:[{...privateRoot('unrelated-shared-folder'),shared:true,appProperties:{},permissions:[{id:'owner',type:'user',role:'owner'},{id:'viewer',type:'user',role:'reader'}]}]}},
      {body:{id:'unverified-root',name:'Waypoint travel planner',ownedByMe:true}},
    )
    const {saveDriveProfile}=await import('./googleDrive')

    await expect(saveDriveProfile(profile)).rejects.toThrow('did not create a private owner-only Waypoint root')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.some(call=>call[1]?.body instanceof Blob)).toBe(false)
  })

  it('adopts and hardens an unmarked private legacy root before using it',async()=>{
    const profile={schemaVersion:1 as const,profileId:'profile-1',name:'Alex',email:'alex@example.com',homeBase:'Toronto, Canada',updatedAt:'2026-08-09T12:00:00.000Z'}
    replies.push(
      {body:{files:[{...privateRoot('legacy-root'),writersCanShare:true,appProperties:{}}]}},
      {body:privateRoot('legacy-root')},
      {body:{files:[]}},
      {body:{id:'profile-file'}},
    )
    const {saveDriveProfile}=await import('./googleDrive')

    await saveDriveProfile(profile)

    expect(fetchMock.mock.calls[1][1]).toMatchObject({method:'PATCH',body:JSON.stringify({appProperties:{waypoint:'waypoint-root'},writersCanShare:false})})
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='POST'&&typeof call[1]?.body==='string')).toHaveLength(0)
  })

  const creationReplies = (cleanup:Reply[]=[{body:{id:'rev-1',keepForever:true}},{status:204},{body:{id:'file-1'}}]):Reply[]=>[
    privateRootListReply('folder-1'),
    {body:{files:[{id:'trip-folder-1',resourceKey:'trip-folder-key'}]}},
    {body:{id:'file-1',resourceKey:'resource-key',headRevisionId:'rev-1'}},
    {body:{id:'file-1',name:'Restored trip.waypoint.json',version:'1',headRevisionId:'rev-1',modifiedTime:'2026-08-06T11:41:00.000Z',resourceKey:'resource-key',ownedByMe:true,capabilities:{canReadRevisions:true,canDownload:true}}},
    {body:{permissions:[{id:'owner-1',type:'user',role:'owner'}]}},
    {body:{id:'file-1'}},
    {body:{id:'file-1',version:'2',headRevisionId:'rev-2',modifiedTime:'2026-08-06T11:41:01.000Z',capabilities:{canReadRevisions:true,canDownload:true}}},
    ...cleanup,
  ]

  it('deletes only the captured bootstrap revision after the complete revision becomes head',async()=>{
    replies.push(...creationReplies())
    const {createDriveTrip,getDriveSyncRecord}=await import('./googleDrive')
    const record=await createDriveTrip(trip)

    expect(record).toMatchObject({fileId:'file-1',tripFolderId:'trip-folder-1',headRevisionId:'rev-2',bootstrapRevisionId:'rev-1'})
    expect(record.pendingBootstrapRevisionId).toBeUndefined()
    expect(getDriveSyncRecord(trip.id)?.pendingBootstrapRevisionId).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(String(fetchMock.mock.calls[2][0])).toContain('fields=id,resourceKey,headRevisionId')

    const completeBody=JSON.parse(String(fetchMock.mock.calls[5][1]?.body))
    expect(completeBody).toMatchObject({schemaVersion:2,trip:{id:trip.id}})
    expect(completeBody.collaboration).toBeUndefined()
    expect(completeBody.calendarSubscription).toBeUndefined()
    expect(JSON.stringify(completeBody)).not.toContain('resource-key')
    expect(JSON.stringify(completeBody)).not.toContain('trip-folder-1')
    expect(String(fetchMock.mock.calls[7][0])).toContain('/files/file-1/revisions/rev-1?fields=id,keepForever')
    expect(fetchMock.mock.calls[7][1]).toMatchObject({method:'PATCH',body:JSON.stringify({keepForever:true})})
    expect(new Headers(fetchMock.mock.calls[7][1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('file-1/resource-key')
    expect(String(fetchMock.mock.calls[8][0])).toContain('/files/file-1/revisions/rev-1')
    expect(fetchMock.mock.calls[8][1]).toMatchObject({method:'DELETE'})
    expect(fetchMock.mock.calls[9][1]).toMatchObject({method:'PATCH',body:JSON.stringify({appProperties:{waypointBootstrapRevision:null}})})
  })

  it('keeps a valid v2 record and retries a failed permanent deletion',async()=>{
    replies.push(...creationReplies([{body:{id:'rev-1',keepForever:true}},{status:503,body:{error:{message:'Temporary failure'}}}]))
    const {createDriveTrip,retryDriveBootstrapRevisionCleanup}=await import('./googleDrive')
    const pending=await createDriveTrip(trip)

    expect(pending).toMatchObject({headRevisionId:'rev-2',pendingBootstrapRevisionId:'rev-1',bootstrapCleanupAttempts:1})
    expect(pending.bootstrapCleanupRetryAt).toBeTruthy()

    replies.push({body:{id:'rev-1',keepForever:true}},{status:204},{body:{id:'file-1'}})
    const cleaned=await retryDriveBootstrapRevisionCleanup(pending,true)
    expect(cleaned.headRevisionId).toBe('rev-2')
    expect(cleaned.pendingBootstrapRevisionId).toBeUndefined()
    expect(cleaned.bootstrapCleanupAttempts).toBeUndefined()
    expect(cleaned.bootstrapCleanupRetryAt).toBeUndefined()
  })

  it('finishes cleanup when deletion succeeded but its metadata marker remained',async()=>{
    replies.push(...creationReplies([{body:{id:'rev-1',keepForever:true}},{status:204},{status:503,body:{error:{message:'Marker cleanup failed'}}}]))
    const {createDriveTrip,retryDriveBootstrapRevisionCleanup}=await import('./googleDrive')
    const pending=await createDriveTrip(trip)
    expect(pending.pendingBootstrapRevisionId).toBe('rev-1')

    replies.push(
      {status:404,body:{error:{message:'Revision already deleted'}}},
      {body:{id:'file-1',name:'Restored trip.waypoint.json',headRevisionId:'rev-2',ownedByMe:true,appProperties:{waypointBootstrapRevision:'rev-1'}}},
      {body:{id:'file-1'}},
    )
    const cleaned=await retryDriveBootstrapRevisionCleanup(pending,true)
    expect(cleaned.pendingBootstrapRevisionId).toBeUndefined()
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length-1]?.[1]).toMatchObject({method:'PATCH',body:JSON.stringify({appProperties:{waypointBootstrapRevision:null}})})
  })

  it('never attempts cleanup when the complete v2 upload fails',async()=>{
    replies.push(...creationReplies([]).slice(0,5),{status:500,body:{error:{message:'Upload failed'}}})
    const {createDriveTrip,getDriveSyncRecord}=await import('./googleDrive')

    await expect(createDriveTrip(trip)).rejects.toThrow('Upload failed')
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(getDriveSyncRecord(trip.id)).toBeUndefined()
  })

  it('does not retry pending cleanup before its throttled retry time',async()=>{
    const {retryDriveBootstrapRevisionCleanup}=await import('./googleDrive')
    const retryAt=new Date(Date.now()+60_000).toISOString()
    const pending={tripId:trip.id,fileId:'file-1',ownedByMe:true,headRevisionId:'rev-2',bootstrapRevisionId:'rev-1',pendingBootstrapRevisionId:'rev-1',bootstrapCleanupRetryAt:retryAt,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    const unchanged=await retryDriveBootstrapRevisionCleanup(pending)
    expect(unchanged).toBe(pending)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never deletes the current head or a bootstrap revision the account does not own',async()=>{
    const {retryDriveBootstrapRevisionCleanup}=await import('./googleDrive')
    const base={tripId:trip.id,fileId:'file-1',bootstrapRevisionId:'rev-1',pendingBootstrapRevisionId:'rev-1',lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    const current=await retryDriveBootstrapRevisionCleanup({...base,ownedByMe:true,headRevisionId:'rev-1'},true)
    const notOwned=await retryDriveBootstrapRevisionCleanup({...base,ownedByMe:false,headRevisionId:'rev-2'},true)
    expect(current.pendingBootstrapRevisionId).toBe('rev-1')
    expect(notOwned.pendingBootstrapRevisionId).toBe('rev-1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reconstructs cleanup from app-private Drive metadata after browser state is lost',async()=>{
    replies.push(
      {body:{id:'file-1',name:'Restored trip.waypoint.json',version:'2',headRevisionId:'rev-2',modifiedTime:'2026-08-06T11:41:01.000Z',ownedByMe:true,appProperties:{waypoint:'trip',tripId:trip.id,waypointBootstrapRevision:'rev-1'},capabilities:{canReadRevisions:true,canDownload:true,canEdit:true}}},
      {body:{id:'rev-1',keepForever:true}},
      {status:204},
      {body:{id:'file-1'}},
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
    )
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,accessModelMigrated:true,canonicalSchemaMigrated:true,ownedByMe:true,headRevisionId:'rev-2',lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt,baseTrip:trip}

    const result=await updateDriveTrip(record,trip)
    expect(result.record.bootstrapRevisionId).toBe('rev-1')
    expect(result.record.pendingBootstrapRevisionId).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/revisions/rev-1?fields=id,keepForever')
  })

  it('excludes a known non-head bootstrap revision from the visible history',async()=>{
    replies.push({body:{revisions:[{id:'rev-1',modifiedTime:'2026-08-06T11:41:00.000Z'},{id:'rev-2',modifiedTime:'2026-08-06T11:41:01.000Z'}]}})
    const {listDriveTripRevisions}=await import('./googleDrive')
    const history=await listDriveTripRevisions({fileId:'file-1',resourceKey:'resource-key',headRevisionId:'rev-2',bootstrapRevisionId:'rev-1',canReadRevisions:true,canDownload:true})

    expect(history.revisions.map(revision=>revision.id)).toEqual(['rev-2'])
    expect(history.headRevisionId).toBe('rev-2')
  })

  it('never filters the bootstrap ID when it is still the current head',async()=>{
    replies.push({body:{revisions:[{id:'rev-1',modifiedTime:'2026-08-06T11:41:00.000Z'}]}})
    const {listDriveTripRevisions}=await import('./googleDrive')
    const history=await listDriveTripRevisions({fileId:'file-1',headRevisionId:'rev-1',bootstrapRevisionId:'rev-1',canReadRevisions:true,canDownload:true})

    expect(history.revisions.map(revision=>revision.id)).toEqual(['rev-1'])
  })

  it('reads both cached travel bounds and infers a missing bound from itinerary entries',async()=>{
    replies.push(
      {body:{files:[
        {id:'cached',name:'Cached.waypoint.json',modifiedTime:'2026-08-06T12:00:00.000Z',appProperties:{travelStart:'2999-01-02',travelEnd:'2999-01-09'}},
        {id:'inferred',name:'Inferred.waypoint.json',modifiedTime:'2026-08-05T12:00:00.000Z',appProperties:{travelEnd:'2000-08-01'}},
      ]}},
      {body:{schemaVersion:2,exportedAt:trip.updatedAt,trip:{...trip,items:[{id:'outbound',type:'flight',title:'Outbound',start:'2000-07-18T20:00',end:'2000-07-19T08:00',timeZone:'UTC',status:'confirmed'},{id:'return',type:'flight',title:'Return',start:'2000-08-01T09:00',timeZone:'UTC',status:'confirmed'}]}}},
    )
    const {listDriveTrips}=await import('./googleDrive')
    const summaries=await listDriveTrips()

    expect(summaries.map(summary=>({id:summary.id,start:summary.travelStart,end:summary.travelEnd}))).toEqual([
      {id:'cached',start:'2999-01-02',end:'2999-01-09'},
      {id:'inferred',start:'2000-07-18',end:'2000-08-01'},
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses the trip folder as the permission and trash boundary',async()=>{
    replies.push(
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'},{id:'anyone',type:'anyone',role:'writer'}]}},
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{id:'trip-folder-1',trashed:true}},
    )
    const {listDrivePermissions,trashDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',resourceKey:'file-key',tripFolderId:'trip-folder-1',tripFolderResourceKey:'folder-key',lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    expect(await listDrivePermissions(record)).toHaveLength(2)
    await trashDriveTrip(record)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/files/trip-folder-1/permissions')
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('trip-folder-1/folder-key')
    expect(String(fetchMock.mock.calls[3][0])).toContain('/files/trip-folder-1?')
    expect(fetchMock.mock.calls[3][1]).toMatchObject({method:'PATCH',body:JSON.stringify({trashed:true})})
  })

  it('paginates permission reads so remove-all and audits see every principal',async()=>{
    replies.push(
      {body:{permissions:[{id:'owner',type:'user',role:'owner'}],nextPageToken:'next-page'}},
      {body:{permissions:[{id:'viewer',type:'user',role:'reader',emailAddress:'viewer@example.com'}]}},
    )
    const {listDriveFilePermissions}=await import('./googleDrive')
    const permissions=await listDriveFilePermissions({fileId:'shared-file',resourceKey:'shared-key'})

    expect(permissions.map(permission=>permission.id)).toEqual(['owner','viewer'])
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('pageToken')).toBe('next-page')
  })

  it('refuses direct ACL revocation unless Drive positively confirms current canShare capability',async()=>{
    replies.push({body:{id:'shared-file',capabilities:{canShare:false}}})
    const {revokeDriveTargetPermission}=await import('./googleDrive')

    await expect(revokeDriveTargetPermission({fileId:'shared-file'},'viewer')).rejects.toThrow('does not currently confirm permission')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='DELETE')).toBe(false)
  })

  it('refuses named-viewer grants when publication binding is valid but canShare is omitted',async()=>{
    replies.push({body:{id:'named-file',appProperties:{waypoint:'published-trip',tripId:trip.id,audience:'named'},capabilities:{canEdit:true}}})
    const {grantDriveNamedViewer}=await import('./googleDrive')

    await expect(grantDriveNamedViewer({tripId:trip.id,audience:'named',fileId:'named-file',publishedAt:trip.updatedAt},'viewer@example.com')).rejects.toThrow('does not currently confirm permission')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.every(call=>!call[1]?.method||call[1]?.method==='GET')).toBe(true)
  })

  it('refuses collaborator grants when the freshly fetched trip folder lacks canShare',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      {body:{id:'trip-folder',appProperties:{waypoint:'trip-folder',tripId:trip.id},capabilities:{canShare:false}}},
    )
    const {grantDriveCollaborator}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(grantDriveCollaborator(record,'writer@example.com')).rejects.toThrow('does not currently confirm permission')
    expect(fetchMock.mock.calls.every(call=>!call[1]?.method||call[1]?.method==='GET')).toBe(true)
  })

  it('removes direct named media access without trying to delete inherited collaborator access',async()=>{
    replies.push(
      {body:{files:[]}},
      shareableReply('photo-folder'),
      {body:{permissions:[
        {id:'owner',type:'user',role:'owner'},
        {id:'rogue-public-reader',type:'anyone',role:'reader'},
        {id:'named-reader',type:'user',role:'reader',emailAddress:'viewer@example.com',permissionDetails:[{inherited:false}]},
        {id:'inherited-writer',type:'user',role:'writer',emailAddress:'collaborator@example.com',permissionDetails:[{inherited:true,inheritedFrom:'trip-folder'}]},
      ]}},
      {status:204},
      {status:204},
    )
    const {removeAllNamedDriveAccess}=await import('./googleDrive')
    const removed=await removeAllNamedDriveAccess([{fileId:'photo-folder'}])

    expect(removed.map(permission=>permission.id)).toEqual(['rogue-public-reader','named-reader'])
    expect(fetchMock).toHaveBeenCalledTimes(5)
    const deletes=fetchMock.mock.calls.filter(call=>call[1]?.method==='DELETE')
    expect(String(deletes[0][0])).toContain('/permissions/rogue-public-reader')
    expect(String(deletes[1][0])).toContain('/permissions/named-reader')
  })

  it('removes direct named access from descendants while preserving inherited writers',async()=>{
    replies.push(
      {body:{files:[{id:'photo-file',resourceKey:'photo-key',mimeType:'image/jpeg'}]}},
      shareableReply('photo-folder'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'}]}},
      shareableReply('photo-file'),
      {body:{permissions:[
        {id:'direct-viewer',type:'user',role:'reader',emailAddress:'viewer@example.com',permissionDetails:[{inherited:false}]},
        {id:'inherited-writer',type:'user',role:'writer',emailAddress:'writer@example.com',permissionDetails:[{inherited:true,inheritedFrom:'photo-folder'}]},
      ]}},
      {status:204},
    )
    const {removeAllNamedDriveAccess}=await import('./googleDrive')
    const removed=await removeAllNamedDriveAccess([{fileId:'photo-folder',resourceKey:'folder-key'}])

    expect(removed.map(permission=>permission.id)).toEqual(['direct-viewer'])
    const deletion=fetchMock.mock.calls.find(call=>call[1]?.method==='DELETE')!
    expect(String(deletion[0])).toContain('/files/photo-file/permissions/direct-viewer')
    expect(new Headers(deletion[1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('photo-file/photo-key')
  })

  it('migrates a legacy itinerary into a private collaborator folder without changing its file id',async()=>{
    replies.push(
      privateRootListReply('waypoint-root'),
      {body:{files:[{id:'trip-folder-1',resourceKey:'folder-key'}]}},
      canonicalBindingReply('file-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'},{id:'anyone',type:'anyone',role:'writer',allowFileDiscovery:false}]}},
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'}]}},
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'}]}},
      {body:{id:'file-1',parents:['waypoint-root']}},
      {body:{id:'file-1',parents:['trip-folder-1']}},
      {body:{files:[]}},
      {body:{files:[{id:'old-published-folder'}]}},
      {body:{id:'old-published-folder',trashed:true}},
      {status:204},
      {body:{id:'trip-folder-1',writersCanShare:false}},
      {body:{id:'file-1',writersCanShare:false}},
    )
    const {ensureDriveTripStructure}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',resourceKey:'file-key',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const migrated=await ensureDriveTripStructure(record,trip)
    expect(migrated).toMatchObject({fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderResourceKey:'folder-key',shared:false})
    expect(fetchMock.mock.calls.some(call=>new URL(String(call[0])).searchParams.get('addParents')==='trip-folder-1')).toBe(true)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='PATCH'&&call[1]?.body===JSON.stringify({trashed:true}))).toBe(true)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='DELETE')).toBe(true)
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='PATCH'&&call[1]?.body===JSON.stringify({writersCanShare:false}))).toHaveLength(2)
    expect(fetchMock.mock.calls.some(call=>String(call[1]?.body).includes('"role":"writer"'))).toBe(false)
  })

  it('publishes only the calendar file while keeping the Published Calendars folder private',async()=>{
    replies.push(
      privateRootListReply('waypoint-root'),
      {body:{files:[]}},
      {body:{id:'calendar-folder',name:'Published Calendars',resourceKey:'folder-key'}},
      {body:{files:[]}},
      {body:{id:'calendar-file',resourceKey:'calendar-key'}},
      {body:{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed',modifiedTime:'2026-08-07T12:00:00.000Z'}},
      shareableReply('calendar-file'),
      {body:{permissions:[]}},
      {body:{id:'public-reader'}},
      {body:{files:[{id:'old-trip-calendar-folder',resourceKey:'old-folder-key'}]}},
      {body:{id:'old-trip-calendar-folder',trashed:true}},
      {body:{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed',modifiedTime:'2026-08-07T12:00:00.000Z'}},
    )
    const {publishDriveCalendarSubscription}=await import('./googleDrive')
    const subscription=await publishDriveCalendarSubscription(trip,'BEGIN:VCALENDAR\r\nEND:VCALENDAR',{tripFolderId:'trip-folder-1'})
    expect(subscription.fileId).toBe('calendar-file')
    expect(fetchMock.mock.calls[2][1]).toMatchObject({method:'POST',body:JSON.stringify({name:'Published Calendars',mimeType:'application/vnd.google-apps.folder',parents:['waypoint-root'],appProperties:{waypoint:'published-calendars'},writersCanShare:false})})
    const uploadBody=fetchMock.mock.calls[4][1]?.body as Blob
    expect(await uploadBody.text()).toContain('"parents":["calendar-folder"]')
    const publicGrant=fetchMock.mock.calls.find(call=>call[1]?.method==='POST'&&String(call[0]).includes('/files/calendar-file/permissions'))!
    expect(publicGrant[1]).toMatchObject({method:'POST',body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})})
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='PATCH'&&call[1]?.body===JSON.stringify({trashed:true}))).toBe(true)
  })

  it('suspends an existing public calendar ACL before publishing content and restores reader access last',async()=>{
    replies.push(
      privateRootListReply('waypoint-root'),
      {body:{files:[{id:'calendar-folder',name:'Published Calendars',resourceKey:'folder-key'}]}},
      {body:{files:[{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed'}]}},
      {body:{id:'calendar-file',parents:['calendar-folder'],resourceKey:'calendar-key'}},
      calendarBindingReply('calendar-file'),
      {body:{permissions:[{id:'old-public-reader',type:'anyone',role:'reader'}]}},
      {status:204},
      {body:{id:'calendar-file'}},
      {body:{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed',modifiedTime:'2026-08-09T12:00:00.000Z'}},
      calendarBindingReply('calendar-file'),
      {body:{permissions:[]}},
      {body:{id:'new-public-reader',type:'anyone',role:'reader'}},
      {body:{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed',modifiedTime:'2026-08-09T12:00:00.000Z'}},
    )
    const {publishDriveCalendarSubscription}=await import('./googleDrive')
    const subscription=await publishDriveCalendarSubscription(trip,'BEGIN:VCALENDAR\r\nEND:VCALENDAR')

    expect(subscription.fileId).toBe('calendar-file')
    const deleteIndex=fetchMock.mock.calls.findIndex(call=>call[1]?.method==='DELETE'),uploadIndex=fetchMock.mock.calls.findIndex(call=>String(call[0]).includes('uploadType=media')),grantIndex=fetchMock.mock.calls.findIndex(call=>call[1]?.method==='POST'&&String(call[0]).includes('/permissions'))
    expect(String(fetchMock.mock.calls[deleteIndex][0])).toContain('/permissions/old-public-reader')
    expect(fetchMock.mock.calls[uploadIndex][1]).toMatchObject({method:'PATCH'})
    expect(fetchMock.mock.calls[grantIndex][1]).toMatchObject({method:'POST',body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})})
    expect(deleteIndex).toBeLessThan(uploadIndex)
    expect(uploadIndex).toBeLessThan(grantIndex)
  })

  it('leaves public calendar access suspended when a refresh upload fails',async()=>{
    replies.push(
      privateRootListReply('waypoint-root'),
      {body:{files:[{id:'calendar-folder',name:'Published Calendars',resourceKey:'folder-key'}]}},
      {body:{id:'calendar-file',parents:['calendar-folder'],resourceKey:'calendar-key'}},
      calendarBindingReply('calendar-file'),
      {body:{permissions:[{id:'public-reader',type:'anyone',role:'reader'}]}},
      {status:204},
      {status:500,body:{error:{message:'Calendar upload failed'}}},
    )
    const {refreshDriveCalendarSubscription}=await import('./googleDrive')
    const known={fileId:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed'}

    await expect(refreshDriveCalendarSubscription(trip,'BEGIN:VCALENDAR\r\nEND:VCALENDAR',known)).rejects.toThrow('Calendar upload failed')
    const deleteIndex=fetchMock.mock.calls.findIndex(call=>call[1]?.method==='DELETE'),uploadIndex=fetchMock.mock.calls.findIndex(call=>String(call[0]).includes('uploadType=media'))
    expect(fetchMock.mock.calls[deleteIndex][1]).toMatchObject({method:'DELETE'})
    expect(String(fetchMock.mock.calls[uploadIndex][0])).toContain('uploadType=media')
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='POST'&&String(call[0]).includes('/permissions')).length).toBe(0)
  })

  it('removes a stale calendar reference locally without writing its URL into canonical JSON',async()=>{
    const calendarSubscription={provider:'google-drive',format:'ics',mimeType:'text/calendar',access:'public-read-only',fileId:'missing-calendar',publicUrl:'https://drive.google.com/missing-calendar',linkedAt:'2026-08-07T12:00:00.000Z'} as const
    replies.push(
      {body:{id:'file-1',name:'Ireland 2026.waypoint.json',version:'2',ownedByMe:true}},
      {body:{schemaVersion:1,exportedAt:trip.updatedAt,trip,calendarSubscription,collaboration:{revision:'revision-1'}}},
      {body:{id:'file-1',version:'3',modifiedTime:'2026-08-09T14:00:00.000Z'}},
    )
    const {unlinkMissingDriveCalendarSubscription,getDriveSyncRecord}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt,calendarSubscription}
    const unlinked=await unlinkMissingDriveCalendarSubscription(record)

    expect(unlinked.calendarSubscription).toBeUndefined()
    expect(getDriveSyncRecord(trip.id)?.calendarSubscription).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[2][0])).not.toContain('uploadType=media')
    expect(fetchMock.mock.calls[2][1]).toMatchObject({method:'PATCH',body:JSON.stringify({appProperties:{waypoint:'trip',tripId:trip.id,travelStart:'',travelEnd:'',archived:'false',shared:'false',hasCalendar:'false'}})})
  })

  it('moves an existing calendar out of a structured trip and removes its published folder on the next owner sync',async()=>{
    replies.push(
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{files:[{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed'}]}},
      privateRootListReply('waypoint-root'),
      {body:{files:[{id:'calendar-folder',name:'Published Calendars',resourceKey:'folder-key'}]}},
      {body:{id:'calendar-file',parents:['old-trip-calendar-folder'],resourceKey:'calendar-key'}},
      {body:{id:'calendar-file',parents:['calendar-folder'],resourceKey:'calendar-key'}},
      calendarBindingReply('calendar-file'),
      {body:{permissions:[]}},
      {body:{id:'public-reader'}},
      {body:{files:[{id:'old-trip-calendar-folder',resourceKey:'old-folder-key'}]}},
      {body:{id:'old-trip-calendar-folder',trashed:true}},
    )
    const {ensureDriveTripStructure}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const migrated=await ensureDriveTripStructure(record,trip)

    expect(migrated.calendarStorageMigrated).toBe(true)
    const moveCall=fetchMock.mock.calls.find(call=>new URL(String(call[0])).searchParams.get('addParents')==='calendar-folder')!
    expect(String(moveCall[0])).toContain('removeParents=old-trip-calendar-folder')
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='POST'&&call[1]?.body===JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false}))).toBe(true)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='PATCH'&&call[1]?.body===JSON.stringify({trashed:true}))).toBe(true)
  })

  it('uploads journal photos into the inherited trip media folder',async()=>{
    replies.push(
      canonicalBindingReply('file-1','trip-folder-1'),
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{files:[]}},
      {body:{id:'media-folder',resourceKey:'media-key'}},
      folderBindingReply('media-folder','journal-media','trip-folder-1'),
      {body:{files:[]}},
      {body:{id:'photo-folder',resourceKey:'photo-folder-key'}},
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      {body:{id:'photo-file',resourceKey:'photo-key',name:'arrival.jpg',mimeType:'image/jpeg',size:'4'}},
    )
    const {uploadDriveJournalPhoto}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const file=new File(['test'],'arrival.jpg',{type:'image/jpeg'})
    const result=await uploadDriveJournalPhoto(record,trip,'entry-1',file)
    expect(result.record.journalMediaFolderId).toBe('media-folder')
    expect(result.record.journalPhotoFolderId).toBe('photo-folder')
    expect(result.photo).toMatchObject({driveFileId:'photo-file',name:'arrival.jpg',mimeType:'image/jpeg',size:4})
    const uploadCall=fetchMock.mock.calls.find(call=>String(call[0]).includes('uploadType=multipart')&&call[1]?.body instanceof Blob)!,uploadText=await (uploadCall[1]?.body as Blob).text()
    expect(uploadText).toContain('"parents":["photo-folder"]')
    expect(uploadText).toContain('"writersCanShare":false')
    expect(uploadText).not.toContain('journalEntryId')
  })

  it('uploads journal audio into the inherited trip media folder',async()=>{
    replies.push(
      canonicalBindingReply('file-1','trip-folder-1'),
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{files:[]}},
      {body:{id:'media-folder',resourceKey:'media-key'}},
      folderBindingReply('media-folder','journal-media','trip-folder-1'),
      {body:{files:[]}},
      {body:{id:'audio-folder',resourceKey:'audio-folder-key'}},
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      {body:{id:'audio-file',resourceKey:'audio-key',name:'street-music.m4a',mimeType:'audio/mp4',size:'5'}},
    )
    const {uploadDriveJournalAudio}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const file=new File(['audio'],'street-music.m4a',{type:'audio/mp4'})
    const result=await uploadDriveJournalAudio(record,trip,'entry-1',file)
    expect(result.record.journalMediaFolderId).toBe('media-folder')
    expect(result.record.journalAudioFolderId).toBe('audio-folder')
    expect(result.audio).toMatchObject({driveFileId:'audio-file',name:'street-music.m4a',mimeType:'audio/mp4',size:5})
    const uploadBody=fetchMock.mock.calls.find(call=>String(call[0]).includes('uploadType=multipart')&&call[1]?.body instanceof Blob)![1]?.body as Blob
    expect(await uploadBody.text()).toContain('"waypoint":"journal-audio"')
  })

  it('uploads an iOS m4a file when its MIME type is missing',async()=>{
    replies.push(
      canonicalBindingReply('file-1','trip-folder-1'),
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{files:[]}},
      {body:{id:'media-folder',resourceKey:'media-key'}},
      folderBindingReply('media-folder','journal-media','trip-folder-1'),
      {body:{files:[]}},
      {body:{id:'audio-folder',resourceKey:'audio-folder-key'}},
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      {body:{id:'audio-file',resourceKey:'audio-key',name:'Voice Memo.m4a',mimeType:'audio/x-m4a',size:'5'}},
    )
    const {uploadDriveJournalAudio}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const file=new File(['audio'],'Voice Memo.m4a')
    const result=await uploadDriveJournalAudio(record,trip,'entry-1',file)

    expect(result.audio).toMatchObject({driveFileId:'audio-file',mimeType:'audio/x-m4a'})
    const uploadBody=fetchMock.mock.calls.find(call=>String(call[0]).includes('uploadType=multipart')&&call[1]?.body instanceof Blob)![1]?.body as Blob
    expect(await uploadBody.text()).toContain('Content-Type: audio/x-m4a')
  })

  it('refuses media upload unless the canonical trip freshly reports canEdit true',async()=>{
    replies.push({body:{id:'file-1',parents:['trip-folder-1'],appProperties:{waypoint:'trip',tripId:trip.id},capabilities:{canEdit:false,canShare:true}}})
    const {uploadDriveJournalPhoto}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',ownedByMe:false,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(uploadDriveJournalPhoto(record,trip,'entry-1',new File(['test'],'arrival.jpg',{type:'image/jpeg'}))).rejects.toThrow('does not currently confirm edit access')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.some(call=>String(call[0]).includes('uploadType'))).toBe(false)
  })

  it('refuses media upload unless the actual destination folder freshly reports canAddChildren true',async()=>{
    replies.push(
      canonicalBindingReply('file-1','trip-folder-1'),
      canonicalBindingReply('file-1','trip-folder-1'),
      folderBindingReply('trip-folder-1','trip-folder'),
      {body:{id:'photo-folder',parents:['media-folder'],appProperties:{waypoint:'journal-photo-folder',tripId:trip.id},capabilities:{canEdit:true,canShare:true,canAddChildren:false}}},
    )
    const {uploadDriveJournalPhoto}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,journalMediaFolderId:'media-folder',journalPhotoFolderId:'photo-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(uploadDriveJournalPhoto(record,trip,'entry-1',new File(['test'],'arrival.jpg',{type:'image/jpeg'}))).rejects.toThrow('does not currently confirm permission to add photo files')
    expect(fetchMock.mock.calls.some(call=>String(call[0]).includes('uploadType'))).toBe(false)
  })

  it('loads available EXIF photo details without downloading the image again',async()=>{
    replies.push({body:{id:'photo-file',name:'arrival.jpg',mimeType:'image/jpeg',size:'4',imageMediaMetadata:{time:'2026:07:18 14:35:12',width:4032,height:3024,cameraMake:'Canon',cameraModel:'EOS R6',location:{latitude:53.3498,longitude:-6.2603,altitude:17}}}})
    const {loadDriveJournalPhotoMetadata}=await import('./googleDrive')
    const result=await loadDriveJournalPhotoMetadata({driveFileId:'photo-file',resourceKey:'photo-key'})

    expect(result.imageMediaMetadata).toMatchObject({time:'2026:07:18 14:35:12',width:4032,height:3024,location:{latitude:53.3498,longitude:-6.2603,altitude:17}})
    const url=new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toContain('/files/photo-file')
    expect(url.searchParams.get('fields')).toContain('imageMediaMetadata')
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('photo-file/photo-key')
  })

  it('trashes journal media only after verifying its trip-bound media folder and kind',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      {body:{id:'photo-file',name:'arrival.jpg',parents:['photo-folder'],appProperties:{waypoint:'journal-photo'}}},
      {body:{id:'photo-file',trashed:true}},
    )
    const {trashDriveJournalPhoto}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',journalMediaFolderId:'media-folder',journalPhotoFolderId:'photo-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await trashDriveJournalPhoto(record,trip,{driveFileId:'photo-file',resourceKey:'photo-key'})

    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls[5][1]).toMatchObject({method:'PATCH',body:JSON.stringify({trashed:true})})
    expect(new Headers(fetchMock.mock.calls[5][1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('photo-file/photo-key')
  })

  it('refuses to trash a media file outside the expected trip folder',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      {body:{id:'audio-file',name:'foreign.m4a',parents:['different-audio-folder'],appProperties:{waypoint:'journal-audio'}}},
    )
    const {trashDriveJournalAudio}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',journalMediaFolderId:'media-folder',journalAudioFolderId:'audio-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(trashDriveJournalAudio(record,trip,{driveFileId:'audio-file'})).rejects.toThrow("does not belong to this trip's verified Waypoint media folder")
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='PATCH')).toBe(false)
  })

  it('refuses a cross-trip media record before making a Drive request',async()=>{
    const {trashDriveJournalPhoto}=await import('./googleDrive')
    const record={tripId:'different-trip',fileId:'canonical-file',tripFolderId:'trip-folder',journalMediaFolderId:'media-folder',journalPhotoFolderId:'photo-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(trashDriveJournalPhoto(record,trip,{driveFileId:'photo-file'})).rejects.toThrow('different Waypoint trip')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires positively confirmed edit capability for non-owner media deletion',async()=>{
    const {trashDriveJournalAudio}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',journalMediaFolderId:'media-folder',journalAudioFolderId:'audio-folder',ownedByMe:false,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(trashDriveJournalAudio(record,trip,{driveFileId:'audio-file'})).rejects.toThrow('read-only')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('disconnects only the browser session and preserves linked-trip records',async()=>{
    const {disconnectGoogleDrive,getDriveSyncRecord,isGoogleDriveConnected,saveDriveSyncRecord}=await import('./googleDrive')
    saveDriveSyncRecord({tripId:trip.id,fileId:'file-1',lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt})

    expect(isGoogleDriveConnected()).toBe(true)
    disconnectGoogleDrive()

    expect(isGoogleDriveConnected()).toBe(false)
    expect(sessionStorage.getItem('waypoint-drive-session')).toBeNull()
    expect(getDriveSyncRecord(trip.id)?.fileId).toBe('file-1')
  })

  it('loads an anonymous public projection with only the API key and resource-key header',async()=>{
    replies.push({body:{schemaVersion:1,trip:{id:trip.id}}})
    const {loadPublicDriveJson}=await import('./googleDrive')
    const result=await loadPublicDriveJson<{trip:{id:string}}>('public-file','public-key','browser-api-key')

    expect(result.trip.id).toBe(trip.id)
    const url=new URL(String(fetchMock.mock.calls[0][0])),headers=new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(url.searchParams.get('alt')).toBe('media')
    expect(url.searchParams.get('key')).toBe('browser-api-key')
    expect(headers.get('Authorization')).toBeNull()
    expect(headers.get('X-Goog-Drive-Resource-Keys')).toBe('public-file/public-key')
  })

  it('exposes the exact app-not-authorized reason for the Picker fallback',async()=>{
    replies.push({status:403,body:{error:{message:'Open this file with the app',errors:[{reason:'appNotAuthorizedToFile'}]}}})
    const {isDriveAppNotAuthorizedError,listDriveTrips}=await import('./googleDrive')

    const error=await listDriveTrips().catch(value=>value)
    expect(isDriveAppNotAuthorizedError(error)).toBe(true)
    expect(error).toMatchObject({status:403,reason:'appNotAuthorizedToFile'})
  })

  it('opens Picker only for JSON and resolves only for the exact shared file ID',async()=>{
    const state:{mimeTypes?:string;token?:string;apiKey?:string;appId?:string;origin?:string;callback?:(data:{action:string;docs?:Array<{id:string}>})=>void;visible?:boolean}={}
    class DocsView {setMimeTypes(value:string){state.mimeTypes=value;return this}}
    class PickerBuilder {
      addView(){return this}
      setOAuthToken(value:string){state.token=value;return this}
      setDeveloperKey(value:string){state.apiKey=value;return this}
      setAppId(value:string){state.appId=value;return this}
      setOrigin(value:string){state.origin=value;return this}
      setCallback(value:(data:{action:string;docs?:Array<{id:string}>})=>void){state.callback=value;return this}
      build(){return {setVisible:(value:boolean)=>{state.visible=value}}}
    }
    vi.stubGlobal('window',{gapi:{},google:{picker:{Action:{PICKED:'picked',CANCEL:'cancel'},ViewId:{DOCS:'docs'},DocsView,PickerBuilder}}})
    vi.stubGlobal('location',{origin:'https://waypoint.example'})
    const {authorizeDriveFileWithPicker}=await import('./googleDrive')

    const authorized=authorizeDriveFileWithPicker('shared-file',{apiKey:'picker-key',appId:'project-number'})
    await Promise.resolve()
    expect(state).toMatchObject({mimeTypes:'application/json',token:'test-token',apiKey:'picker-key',appId:'project-number',origin:'https://waypoint.example',visible:true})
    state.callback?.({action:'picked',docs:[{id:'shared-file'}]})
    await expect(authorized).resolves.toBeUndefined()

    const rejected=authorizeDriveFileWithPicker('shared-file',{apiKey:'picker-key',appId:'project-number'})
    await Promise.resolve()
    state.callback?.({action:'picked',docs:[{id:'different-file'}]})
    await expect(rejected).rejects.toThrow('exact Waypoint file')

    const cancelled=authorizeDriveFileWithPicker('shared-file',{apiKey:'picker-key',appId:'project-number'})
    await Promise.resolve()
    state.callback?.({action:'cancel'})
    await expect(cancelled).rejects.toThrow('cancelled')
  })

  it('recovers an app-not-authorized media load with exact-file Picker and the media MIME type',async()=>{
    const state:{mimeTypes?:string;callback?:(data:{action:string;docs?:Array<{id:string}>})=>void}={}
    class DocsView {setMimeTypes(value:string){state.mimeTypes=value;return this}}
    class PickerBuilder {
      addView(){return this}
      setOAuthToken(){return this}
      setDeveloperKey(){return this}
      setAppId(){return this}
      setOrigin(){return this}
      setCallback(value:(data:{action:string;docs?:Array<{id:string}>})=>void){state.callback=value;return this}
      build(){return {setVisible:()=>undefined}}
    }
    vi.stubGlobal('window',{gapi:{},google:{picker:{Action:{PICKED:'picked',CANCEL:'cancel'},ViewId:{DOCS:'docs'},DocsView,PickerBuilder}}})
    vi.stubGlobal('location',{origin:'https://waypoint.example'})
    replies.push(
      {status:403,body:{error:{message:'Open this file with the app',errors:[{reason:'appNotAuthorizedToFile'}]}}},
      {rawBody:'photo-bytes'},
    )
    const {loadDriveJournalPhoto}=await import('./googleDrive')

    const loading=loadDriveJournalPhoto({driveFileId:'photo-file',resourceKey:'photo-key',mimeType:'image/jpeg'},{apiKey:'picker-key',appId:'project-number'})
    for(let index=0;index<10&&!state.callback;index+=1)await Promise.resolve()
    expect(state.mimeTypes).toBe('image/jpeg')
    state.callback?.({action:'picked',docs:[{id:'photo-file'}]})
    await expect(loading).resolves.toBeInstanceOf(Blob)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for(const call of fetchMock.mock.calls)expect(new Headers(call[1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('photo-file/photo-key')
  })

  it('creates a public projection file with reader-only link access',async()=>{
    replies.push(
      privateRootListReply('waypoint-root'),
      {body:{files:[]}},
      {body:{id:'published-trips',name:'Published Trips'}},
      {body:{files:[]}},
      {body:{id:'published-trip-folder'}},
      {body:{files:[]}},
      {body:{id:'public-file',resourceKey:'public-key',modifiedTime:'2026-08-09T12:00:00.000Z'}},
      publicationBindingReply('public-file','public'),
      {body:{permissions:[]}},
      {body:{id:'anyone-reader',type:'anyone',role:'reader'}},
    )
    const {publishDriveTripProjection}=await import('./googleDrive')
    const projection={kind:'waypoint-share-projection' as const,schemaVersion:1 as const,accessMode:'public-viewer' as const,publishedAt:'2026-08-09T12:00:00.000Z',trip:{name:trip.name,destination:trip.destination,items:[]}}
    const publication=await publishDriveTripProjection(trip.id,trip.name,'public',projection,{publicEnabled:true})

    expect(publication).toMatchObject({tripId:trip.id,audience:'public',fileId:'public-file',resourceKey:'public-key'})
    const parentBody=JSON.parse(String(fetchMock.mock.calls[2][1]?.body))
    expect(parentBody).toMatchObject({name:'Published Trips',writersCanShare:false})
    const projectionBody=await (fetchMock.mock.calls[6][1]?.body as Blob).text()
    expect(projectionBody).toContain('"name":"public.waypoint.json"')
    expect(projectionBody).toContain('"writersCanShare":false')
    expect(fetchMock.mock.calls.find(call=>call[1]?.method==='POST'&&String(call[0]).includes('/files/public-file/permissions'))?.[1]).toMatchObject({method:'POST',body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})})
    expect(fetchMock.mock.calls.some(call=>String(call[1]?.body).includes('"role":"writer"'))).toBe(false)
  })

  it('leaves projection readers suspended when replacing an existing artifact fails',async()=>{
    replies.push(
      publicationBindingReply('public-file','public'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'public-reader',type:'anyone',role:'reader'}]}},
      {status:204},
      {status:503,body:{error:{message:'Projection upload failed'}}},
    )
    const {publishDriveTripProjection}=await import('./googleDrive')
    const projection={kind:'waypoint-share-projection' as const,schemaVersion:1 as const,accessMode:'public-viewer' as const,publishedAt:'2026-08-09T12:00:00.000Z',trip:{name:trip.name,destination:trip.destination,items:[]}}

    await expect(publishDriveTripProjection(trip.id,trip.name,'public',projection,{publicEnabled:true,known:{tripId:trip.id,audience:'public',fileId:'public-file',publishedAt:trip.updatedAt}})).rejects.toThrow('Projection upload failed')

    expect(fetchMock.mock.calls[2][1]).toMatchObject({method:'DELETE'})
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false)
  })

  it('suspends named projection and media readers, then restores only newly enabled media before viewers',async()=>{
    const record={tripId:trip.id,fileId:'canonical-file',resourceKey:'canonical-key',tripFolderId:'trip-folder',journalMediaFolderId:'media-folder',journalPhotoFolderId:'photo-folder',journalAudioFolderId:'audio-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const publication={tripId:trip.id,audience:'named' as const,fileId:'named-file',resourceKey:'named-key',publishedAt:trip.updatedAt}
    replies.push(
      publicationBindingReply('named-file','named'),
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'named-reader',type:'user',role:'reader',emailAddress:'viewer@example.com'}]}},
      {status:204},
      {body:{permissions:[{id:'photo-reader',type:'user',role:'reader',emailAddress:'viewer@example.com',permissionDetails:[{inherited:false}]},{id:'inherited-writer',type:'user',role:'writer',emailAddress:'writer@example.com',permissionDetails:[{inherited:true,inheritedFrom:'trip-folder'}]}]}},
      {status:204},
      {body:{permissions:[{id:'audio-reader',type:'user',role:'reader',emailAddress:'viewer@example.com',permissionDetails:[{inherited:false}]}]}},
      {status:204},
    )
    const {publishDriveTripProjection,suspendDrivePublicationReaders}=await import('./googleDrive')
    const suspended=await suspendDrivePublicationReaders({kind:'trip',publication,namedMedia:{record,kinds:['photo','audio']}})

    expect(suspended.namedMedia?.map(item=>item.kind)).toEqual(['photo','audio'])
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='DELETE')).toHaveLength(3)
    expect(fetchMock.mock.calls.some(call=>String(call[0]).includes('permissions/inherited-writer'))).toBe(false)

    replies.push(
      publicationBindingReply('named-file','named'),
      {body:{permissions:[]}},
      {body:{id:'named-file'}},
      {body:{id:'named-file',resourceKey:'named-key',modifiedTime:'2026-08-09T15:00:00.000Z'}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      {body:{id:'restored-photo-reader'}},
      publicationBindingReply('named-file','named'),
      {body:{id:'restored-projection-reader'}},
    )
    const projection={kind:'waypoint-share-projection' as const,schemaVersion:1 as const,accessMode:'named-viewer' as const,publishedAt:'2026-08-09T15:00:00.000Z',trip:{name:trip.name,destination:trip.destination,items:[]}}
    await publishDriveTripProjection(trip.id,trip.name,'named',projection,{known:publication,suspendedReaders:suspended,namedMediaPolicy:{record,includePhotos:true,includeAudio:false}})

    const permissionPosts=fetchMock.mock.calls.filter(call=>call[1]?.method==='POST'&&String(call[0]).includes('/permissions'))
    expect(permissionPosts.map(call=>String(call[0]))).toEqual(expect.arrayContaining([expect.stringContaining('/files/photo-folder/permissions'),expect.stringContaining('/files/named-file/permissions')]))
    expect(permissionPosts.some(call=>String(call[0]).includes('/files/audio-folder/permissions'))).toBe(false)
    expect(fetchMock.mock.calls.indexOf(permissionPosts[0])).toBeLessThan(fetchMock.mock.calls.indexOf(permissionPosts[1]))
  })

  it('verifies every named-media binding before suspending any reader',async()=>{
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',journalMediaFolderId:'media-folder',journalPhotoFolderId:'photo-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    replies.push(
      publicationBindingReply('named-file','named'),
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      {body:{id:'photo-folder',parents:['media-folder'],appProperties:{waypoint:'journal-photo-folder',tripId:'different-trip'},capabilities:{canShare:true}}},
    )
    const {suspendDrivePublicationReaders}=await import('./googleDrive')

    await expect(suspendDrivePublicationReaders({kind:'trip',publication:{tripId:trip.id,audience:'named',fileId:'named-file',publishedAt:trip.updatedAt},namedMedia:{record,kinds:['photo','audio']}})).rejects.toThrow('no longer matches this Waypoint trip')
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='DELETE')).toBe(false)
  })

  it('suspends a binding-verified public calendar reader and rejects a mismatched calendar before ACL reads',async()=>{
    replies.push(
      calendarBindingReply('calendar-file'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'public-reader',type:'anyone',role:'reader'}]}},
      {status:204},
      {body:{id:'wrong-calendar',appProperties:{waypoint:'calendar',tripId:'different-trip'},capabilities:{canShare:true}}},
    )
    const {suspendDrivePublicationReaders}=await import('./googleDrive')
    const suspended=await suspendDrivePublicationReaders({kind:'calendar',tripId:trip.id,fileId:'calendar-file'})

    expect(suspended).toMatchObject({tripId:trip.id,audience:'calendar',permissions:[{id:'public-reader'}]})
    await expect(suspendDrivePublicationReaders({kind:'calendar',tripId:trip.id,fileId:'wrong-calendar'})).rejects.toThrow('different Google Drive object')
    expect(fetchMock.mock.calls.filter(call=>String(call[0]).includes('/wrong-calendar/permissions'))).toHaveLength(0)
  })

  it('rejects malformed or audience-mismatched projections before touching Drive',async()=>{
    const {publishDriveTripProjection}=await import('./googleDrive')
    const namedProjection={kind:'waypoint-share-projection' as const,schemaVersion:1 as const,accessMode:'named-viewer' as const,publishedAt:'2026-08-09T12:00:00.000Z',trip:{name:trip.name,destination:trip.destination,items:[]}}

    await expect(publishDriveTripProjection(trip.id,trip.name,'public',namedProjection)).rejects.toThrow('invalid or mismatched')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a tampered published-file binding before changing its ACL',async()=>{
    replies.push(publicationBindingReply('named-file','public'))
    const {grantDriveNamedViewer}=await import('./googleDrive')

    await expect(grantDriveNamedViewer({tripId:trip.id,audience:'named',fileId:'named-file',publishedAt:trip.updatedAt},'viewer@example.com')).rejects.toThrow('different Google Drive object')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined()
  })

  it('rejects a tampered trip-folder binding before granting collaborator access',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file','trip-folder'),
      {body:{id:'trip-folder',name:'Unrelated folder',appProperties:{waypoint:'trip-folder',tripId:'different-trip'}}},
    )
    const {grantDriveCollaborator}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(grantDriveCollaborator(record,'writer@example.com')).rejects.toThrow('no longer matches this Waypoint trip')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(call=>!call[1]?.method||call[1]?.method==='GET')).toBe(true)
  })

  it('downgrades a direct writer to the exact reader role for a named projection',async()=>{
    replies.push(
      publicationBindingReply('named-file','named'),
      {body:{permissions:[{id:'direct-writer',type:'user',role:'writer',emailAddress:'viewer@example.com',permissionDetails:[{inherited:false}]}]}},
      {body:{id:'direct-writer',type:'user',role:'reader',emailAddress:'viewer@example.com'}},
    )
    const {grantDriveNamedViewer}=await import('./googleDrive')
    const [permission]=await grantDriveNamedViewer({tripId:trip.id,audience:'named',fileId:'named-file',publishedAt:trip.updatedAt},'viewer@example.com')

    expect(permission.role).toBe('reader')
    expect(fetchMock.mock.calls[2][1]).toMatchObject({method:'PATCH',body:JSON.stringify({role:'reader'})})
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false)
  })

  it('grants named viewers reader access and collaborators writer access without public ACLs',async()=>{
    replies.push(
      publicationBindingReply('named-file','named'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'}]}},
      {body:{id:'named-reader',type:'user',role:'reader',emailAddress:'viewer@example.com'}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      {body:{id:'trip-folder',writersCanShare:false}},
      {body:{permissions:[{id:'owner',type:'user',role:'owner'}]}},
      {body:{id:'collaborator',type:'user',role:'writer',emailAddress:'writer@example.com'}},
    )
    const {grantDriveCollaborator,grantDriveNamedViewer}=await import('./googleDrive')
    await grantDriveNamedViewer({tripId:trip.id,audience:'named',fileId:'named-file',publishedAt:trip.updatedAt},' Viewer@Example.com ')
    await grantDriveCollaborator({tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt},'Writer@Example.com')

    expect(fetchMock.mock.calls[2][1]).toMatchObject({method:'POST',body:JSON.stringify({type:'user',role:'reader',emailAddress:'viewer@example.com'})})
    expect(fetchMock.mock.calls.find(call=>call[1]?.method==='PATCH'&&call[1]?.body===JSON.stringify({writersCanShare:false}))?.[1]).toMatchObject({method:'PATCH'})
    expect(fetchMock.mock.calls.find(call=>call[1]?.method==='POST'&&String(call[1]?.body).includes('writer@example.com'))?.[1]).toMatchObject({method:'POST',body:JSON.stringify({type:'user',role:'writer',emailAddress:'writer@example.com'})})
  })

  it('revokes legacy anonymous canonical access and never recreates anyone-writer',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'legacy-public',type:'anyone',role:'writer'}]}},
      {status:204},
      canonicalBindingReply('canonical-file','trip-folder'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'direct-leak',type:'anyone',role:'writer'}]}},
      {status:204},
      {body:{id:'trip-folder',writersCanShare:false}},
      {body:{id:'canonical-file',writersCanShare:false}},
      {body:{permissions:[{id:'owner',type:'user',role:'owner'}]}},
    )
    const {enableDriveTripSharing}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(enableDriveTripSharing(record)).rejects.toThrow('read-only published projection')
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='DELETE')).toHaveLength(2)
    expect(fetchMock.mock.calls.some(call=>String(call[1]?.body).includes('"type":"anyone","role":"writer"'))).toBe(false)
  })

  it('revokes legacy anonymous-writer access automatically on the first upgraded owner sync',async()=>{
    replies.push(
      {body:{id:'canonical-file',name:'Trip.waypoint.json',parents:['trip-folder'],version:'4',headRevisionId:'revision-4',ownedByMe:true,appProperties:{waypoint:'trip',tripId:trip.id,shared:'true'},capabilities:{canEdit:true,canShare:true}}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'legacy-public',type:'anyone',role:'writer'}]}},
      {status:204},
      canonicalBindingReply('canonical-file','trip-folder'),
      {body:{permissions:[{id:'owner',type:'user',role:'owner'},{id:'collaborator',type:'user',role:'writer',permissionDetails:[{inherited:true,inheritedFrom:'trip-folder'}]}]}},
      {body:{id:'trip-folder',writersCanShare:false}},
      {body:{id:'canonical-file',writersCanShare:false}},
      {body:{permissions:[{id:'owner',type:'user',role:'owner'}]}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
    )
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',tripFolderName:trip.name,calendarStorageMigrated:true,canonicalSchemaMigrated:true,ownedByMe:true,headRevisionId:'revision-4',baseTrip:trip,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const result=await updateDriveTrip(record,trip)

    expect(result.record).toMatchObject({accessModelMigrated:true,shared:false})
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='DELETE')).toHaveLength(1)
    expect(fetchMock.mock.calls.some(call=>String(call[1]?.body).includes('"type":"anyone","role":"writer"'))).toBe(false)
  })

  it('rewrites an unchanged owner canonical from v1 to v2 exactly once',async()=>{
    replies.push(
      {body:{id:'canonical-file',name:'Trip.waypoint.json',parents:['trip-folder'],version:'4',headRevisionId:'revision-4',ownedByMe:true,appProperties:{waypoint:'trip',tripId:trip.id},capabilities:{canEdit:true,canShare:true}}},
      {body:{schemaVersion:1,exportedAt:trip.updatedAt,trip}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      {body:{id:'canonical-file'}},
      {body:{id:'canonical-file',version:'5',headRevisionId:'revision-5',modifiedTime:'2026-08-09T14:00:00.000Z',capabilities:{canEdit:true,canShare:true}}},
    )
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',tripFolderName:trip.name,calendarStorageMigrated:true,accessModelMigrated:true,journalMediaStorageMigrated:true,ownedByMe:true,version:'4',headRevisionId:'revision-4',baseTrip:trip,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const migrated=await updateDriveTrip(record,trip)

    expect(migrated.record).toMatchObject({canonicalSchemaMigrated:true,version:'5',headRevisionId:'revision-5'})
    expect(migrated.changed).toBe(true)
    const canonicalWrite=fetchMock.mock.calls.find(call=>String(call[0]).includes('uploadType=media'))
    expect(canonicalWrite).toBeTruthy()
    expect(JSON.parse(String(canonicalWrite![1]?.body))).toEqual(expect.objectContaining({schemaVersion:2,trip:expect.objectContaining({id:trip.id})}))

    const callsAfterMigration=fetchMock.mock.calls.length
    replies.push(
      {body:{id:'canonical-file',name:'Trip.waypoint.json',parents:['trip-folder'],version:'5',headRevisionId:'revision-5',ownedByMe:true,appProperties:{waypoint:'trip',tripId:trip.id},capabilities:{canEdit:true,canShare:true}}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
    )
    const noOp=await updateDriveTrip(migrated.record,migrated.trip)
    expect(noOp.changed).toBe(false)
    expect(fetchMock.mock.calls.slice(callsAfterMigration).every(call=>!call[1]?.method||call[1]?.method==='GET')).toBe(true)
    expect(fetchMock.mock.calls.filter(call=>String(call[0]).includes('uploadType=media'))).toHaveLength(1)
  })

  it('runs journal-media subfolder migration during the first ordinary owner sync',async()=>{
    const journalTrip:Trip={...trip,items:[{id:'journal-1',type:'journal',title:'Arrival',start:'2026-08-09T12:00',timeZone:'Europe/Dublin',status:'planned',photos:[{id:'photo-ref',driveFileId:'photo-file',name:'arrival.jpg',mimeType:'image/jpeg',size:4,createdAt:'2026-08-09T12:00:00.000Z'}]}]}
    replies.push(
      {body:{id:'canonical-file',name:'Trip.waypoint.json',parents:['trip-folder'],version:'4',headRevisionId:'revision-4',ownedByMe:true,appProperties:{waypoint:'trip',tripId:trip.id},capabilities:{canEdit:true,canShare:true}}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      {body:{id:'media-folder',writersCanShare:false}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      {body:{id:'photo-folder',writersCanShare:false}},
      {body:{files:[]}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      {body:{id:'audio-folder',writersCanShare:false}},
      {body:{files:[]}},
    )
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',tripFolderName:trip.name,calendarStorageMigrated:true,accessModelMigrated:true,canonicalSchemaMigrated:true,journalMediaFolderId:'media-folder',journalPhotoFolderId:'photo-folder',journalAudioFolderId:'audio-folder',ownedByMe:true,version:'4',headRevisionId:'revision-4',baseTrip:journalTrip,lastSyncedUpdatedAt:journalTrip.updatedAt,lastSynchronizedAt:journalTrip.updatedAt}
    const result=await updateDriveTrip(record,journalTrip)

    expect(result.record.journalMediaStorageMigrated).toBe(true)
    expect(result.changed).toBe(false)
    const legacyQueries=fetchMock.mock.calls.map(call=>new URL(String(call[0])).searchParams.get('q')||'')
    expect(legacyQueries.some(query=>query.includes("value='journal-photo'"))).toBe(true)
    expect(legacyQueries.some(query=>query.includes("value='journal-audio'"))).toBe(true)
    expect(fetchMock.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false)
    expect(fetchMock.mock.calls.some(call=>String(call[0]).includes('uploadType=media'))).toBe(false)
  })

  it('freezes a downgraded canonical collaborator instead of exposing full JSON as a reader',async()=>{
    replies.push(
      {body:{id:'canonical-file',name:'Trip.waypoint.json',version:'4',headRevisionId:'revision-4',ownedByMe:false,capabilities:{canDownload:true}}},
    )
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',ownedByMe:false,baseTrip:trip,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(updateDriveTrip(record,{...trip,name:'Hand-edited local copy'})).rejects.toMatchObject({status:403,reason:'insufficientFilePermissions'})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.every(call=>!call[1]?.method||call[1]?.method==='GET')).toBe(true)
  })

  it('rejects unbounded oversized and invalid canonical responses without issuing a write',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file'),
      {rawBody:'x'.repeat(5_000_001)},
      canonicalBindingReply('canonical-file'),
      {rawBody:'not valid JSON'},
    )
    const {loadDriveTrip}=await import('./googleDrive')

    await expect(loadDriveTrip('canonical-file')).rejects.toThrow('too large to load safely')
    await expect(loadDriveTrip('canonical-file')).rejects.toThrow('does not contain valid JSON')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls.every(call=>!call[1]?.method||call[1]?.method==='GET')).toBe(true)
  })

  it('never uploads when a hand-edited sync record points at a different Drive trip',async()=>{
    replies.push({body:{id:'different-file',name:'Different.waypoint.json',version:'4',ownedByMe:true,appProperties:{waypoint:'trip',tripId:'different-trip'},capabilities:{canEdit:true}}})
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'different-file',ownedByMe:true,baseTrip:trip,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}

    await expect(updateDriveTrip(record,{...trip,name:'Local edit'})).rejects.toThrow('belongs to a different trip')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined()
  })

  it('round-trips validated private PROFILE.JSON data at the Waypoint root',async()=>{
    const profile={schemaVersion:1 as const,profileId:'profile-1',name:'Alex',email:'alex@example.com',homeBase:'Toronto, Canada',updatedAt:'2026-08-09T12:00:00.000Z'}
    replies.push(
      privateRootListReply('waypoint-root'),
      {body:{files:[]}},
      {body:{id:'profile-file'}},
      privateRootListReply('waypoint-root'),
      {body:{files:[{id:'profile-file',name:'PROFILE.JSON'}]}},
      {body:profile},
    )
    const {loadDriveProfile,saveDriveProfile}=await import('./googleDrive')

    await expect(saveDriveProfile(profile)).resolves.toEqual(profile)
    await expect(loadDriveProfile()).resolves.toEqual(profile)
    const createBody=await (fetchMock.mock.calls[2][1]?.body as Blob).text()
    expect(createBody).toContain('"name":"PROFILE.JSON"')
    expect(createBody).toContain('"waypoint":"profile"')
    expect(createBody).toContain('"writersCanShare":false')
  })

  it('validates LINKS.JSON policies against their audience and fails closed on unknown fields',async()=>{
    const {isLinksManifestV1,saveDriveLinksManifest}=await import('./googleDrive')
    const publicPolicy={version:1 as const,audience:'public-trip' as const,preset:'simplified' as const,itemTypes:['flight' as const,'stay' as const],fields:['type' as const,'title' as const],includePhotos:false,includeAudio:false}
    const valid={schemaVersion:1 as const,updatedAt:'2026-08-09T12:00:00.000Z',trips:{[trip.id]:{publicTrip:{enabled:true,policy:publicPolicy,fileId:'public-file'}}}}

    expect(isLinksManifestV1(valid)).toBe(true)
    expect(isLinksManifestV1({...valid,trips:{[trip.id]:{namedTrip:{enabled:true,policy:publicPolicy}}}})).toBe(false)
    expect(isLinksManifestV1({...valid,accessToken:'must-never-be-stored'})).toBe(false)
    await expect(saveDriveLinksManifest({...valid,accessToken:'must-never-be-stored'} as never)).rejects.toThrow('manifest is malformed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('moves legacy media into kind-specific folders without copying binary data',async()=>{
    replies.push(
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      {body:{id:'media-folder',writersCanShare:false}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      {body:{files:[]}},
      {body:{id:'photo-folder',resourceKey:'photo-folder-key'}},
      folderBindingReply('photo-folder','journal-photo-folder','media-folder'),
      {body:{id:'photo-folder',writersCanShare:false}},
      {body:{files:[{id:'legacy-photo',resourceKey:'legacy-photo-key'}]}},
      {body:{id:'legacy-photo',parents:['media-folder'],resourceKey:'legacy-photo-key'}},
      {body:{id:'legacy-photo',parents:['photo-folder'],resourceKey:'legacy-photo-key'}},
      {body:{id:'legacy-photo',writersCanShare:false}},
      canonicalBindingReply('canonical-file','trip-folder'),
      folderBindingReply('trip-folder','trip-folder'),
      folderBindingReply('media-folder','journal-media','trip-folder'),
      {body:{files:[]}},
      {body:{id:'audio-folder',resourceKey:'audio-folder-key'}},
      folderBindingReply('audio-folder','journal-audio-folder','media-folder'),
      {body:{id:'audio-folder',writersCanShare:false}},
      {body:{files:[]}},
    )
    const {migrateDriveJournalMediaFolders}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'canonical-file',tripFolderId:'trip-folder',tripFolderName:trip.name,calendarStorageMigrated:true,journalMediaFolderId:'media-folder',journalMediaFolderResourceKey:'media-key',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const migrated=await migrateDriveJournalMediaFolders(record,trip)

    expect(migrated).toMatchObject({journalPhotoFolderId:'photo-folder',journalAudioFolderId:'audio-folder',journalMediaStorageMigrated:true})
    const moveCall=fetchMock.mock.calls.find(call=>new URL(String(call[0])).searchParams.get('addParents')==='photo-folder')
    expect(moveCall).toBeTruthy()
    const moveUrl=new URL(String(moveCall![0]))
    expect(moveUrl.searchParams.get('addParents')).toBe('photo-folder')
    expect(moveUrl.searchParams.get('removeParents')).toBe('media-folder')
    expect(fetchMock.mock.calls.filter(call=>call[1]?.method==='POST'&&String(call[0]).includes('uploadType')).length).toBe(0)
  })
})
