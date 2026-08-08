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

type Reply = {status?:number;body?:unknown}
const trip:Trip={id:'trip-1',name:'Restored trip',destination:'Dublin',createdAt:'2026-08-06T11:41:00.000Z',updatedAt:'2026-08-06T11:41:00.000Z',items:[]}

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
      return new Response(status===204?null:JSON.stringify(reply.body??{}),{status,headers:status===204?undefined:{'Content-Type':'application/json'}})
    })
    vi.stubGlobal('fetch',fetchMock)
  })

  afterEach(()=>vi.unstubAllGlobals())

  const creationReplies = (cleanup:Reply[]=[{body:{id:'rev-1',keepForever:true}},{status:204},{body:{id:'file-1'}}]):Reply[]=>[
    {body:{files:[{id:'folder-1'}]}},
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
    expect(completeBody.collaboration.drive.tripFolderId).toBe('trip-folder-1')
    expect(completeBody.collaboration.drive.bootstrapRevisionId).toBe('rev-1')
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
      {body:{id:'file-1',name:'Restored trip.waypoint.json',version:'2',headRevisionId:'rev-2',modifiedTime:'2026-08-06T11:41:01.000Z',ownedByMe:true,appProperties:{waypointBootstrapRevision:'rev-1'},capabilities:{canReadRevisions:true,canDownload:true}}},
      {body:{id:'rev-1',keepForever:true}},
      {status:204},
      {body:{id:'file-1'}},
    )
    const {updateDriveTrip}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,ownedByMe:true,headRevisionId:'rev-2',lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt,baseTrip:trip}

    const result=await updateDriveTrip(record,trip)
    expect(result.record.bootstrapRevisionId).toBe('rev-1')
    expect(result.record.pendingBootstrapRevisionId).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(4)
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
      {body:{trip:{items:[{id:'outbound',type:'flight',title:'Outbound',start:'2000-07-18T20:00',end:'2000-07-19T08:00',timeZone:'UTC',status:'confirmed'},{id:'return',type:'flight',title:'Return',start:'2000-08-01T09:00',timeZone:'UTC',status:'confirmed'}]}}},
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
    replies.push({body:{permissions:[{id:'owner-1',type:'user',role:'owner'},{id:'anyone',type:'anyone',role:'writer'}]}},{body:{id:'trip-folder-1',trashed:true}})
    const {listDrivePermissions,trashDriveTrip}=await import('./googleDrive')
    const record={fileId:'file-1',resourceKey:'file-key',tripFolderId:'trip-folder-1',tripFolderResourceKey:'folder-key'}
    expect(await listDrivePermissions(record)).toHaveLength(2)
    await trashDriveTrip(record)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/files/trip-folder-1/permissions')
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-Goog-Drive-Resource-Keys')).toBe('trip-folder-1/folder-key')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/files/trip-folder-1?')
  })

  it('migrates a legacy itinerary into a shared trip folder without changing its file id',async()=>{
    replies.push(
      {body:{files:[{id:'waypoint-root'}]}},
      {body:{files:[{id:'trip-folder-1',resourceKey:'folder-key'}]}},
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'},{id:'anyone',type:'anyone',role:'writer',allowFileDiscovery:false}]}},
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'}]}},
      {body:{id:'anyone'}},
      {body:{permissions:[{id:'owner-1',type:'user',role:'owner'},{id:'anyone',type:'anyone',role:'writer',allowFileDiscovery:false}]}},
      {body:{id:'file-1',parents:['waypoint-root']}},
      {body:{id:'file-1',parents:['trip-folder-1']}},
      {body:{files:[]}},
      {body:{files:[{id:'old-published-folder'}]}},
      {body:{id:'old-published-folder',trashed:true}},
      {status:204},
    )
    const {ensureDriveTripStructure}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',resourceKey:'file-key',ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const migrated=await ensureDriveTripStructure(record,trip)
    expect(migrated).toMatchObject({fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderResourceKey:'folder-key',shared:true})
    expect(String(fetchMock.mock.calls[7][0])).toContain('addParents=trip-folder-1')
    expect(fetchMock.mock.calls[10][1]).toMatchObject({method:'PATCH',body:JSON.stringify({trashed:true})})
    expect(fetchMock.mock.calls[11][1]).toMatchObject({method:'DELETE'})
  })

  it('publishes a calendar in the public read-only Published Calendars folder and removes the trip subfolder',async()=>{
    replies.push(
      {body:{files:[{id:'waypoint-root'}]}},
      {body:{files:[]}},
      {body:{id:'calendar-folder',name:'Published Calendars',resourceKey:'folder-key'}},
      {body:{permissions:[]}},
      {body:{id:'public-reader'}},
      {body:{files:[]}},
      {body:{id:'calendar-file',resourceKey:'calendar-key'}},
      {body:{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed',modifiedTime:'2026-08-07T12:00:00.000Z'}},
      {body:{files:[{id:'old-trip-calendar-folder',resourceKey:'old-folder-key'}]}},
      {body:{id:'old-trip-calendar-folder',trashed:true}},
      {body:{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed',modifiedTime:'2026-08-07T12:00:00.000Z'}},
    )
    const {publishDriveCalendarSubscription}=await import('./googleDrive')
    const subscription=await publishDriveCalendarSubscription(trip,'BEGIN:VCALENDAR\r\nEND:VCALENDAR',{tripFolderId:'trip-folder-1'})
    expect(subscription.fileId).toBe('calendar-file')
    expect(fetchMock.mock.calls[2][1]).toMatchObject({method:'POST',body:JSON.stringify({name:'Published Calendars',mimeType:'application/vnd.google-apps.folder',parents:['waypoint-root'],appProperties:{waypoint:'published-calendars'}})})
    expect(fetchMock.mock.calls[4][1]).toMatchObject({method:'POST',body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})})
    const uploadBody=fetchMock.mock.calls[6][1]?.body as Blob
    expect(await uploadBody.text()).toContain('"parents":["calendar-folder"]')
    expect(fetchMock.mock.calls[9][1]).toMatchObject({method:'PATCH',body:JSON.stringify({trashed:true})})
  })

  it('moves an existing calendar out of a structured trip and removes its published folder on the next owner sync',async()=>{
    replies.push(
      {body:{files:[{id:'calendar-file',resourceKey:'calendar-key',webContentLink:'https://drive.google.com/calendar-feed'}]}},
      {body:{files:[{id:'waypoint-root'}]}},
      {body:{files:[{id:'calendar-folder',name:'Published Calendars',resourceKey:'folder-key'}]}},
      {body:{permissions:[{id:'public-reader',type:'anyone',role:'reader'}]}},
      {body:{id:'calendar-file',parents:['old-trip-calendar-folder'],resourceKey:'calendar-key'}},
      {body:{id:'calendar-file',parents:['calendar-folder'],resourceKey:'calendar-key'}},
      {body:{files:[{id:'old-trip-calendar-folder',resourceKey:'old-folder-key'}]}},
      {body:{id:'old-trip-calendar-folder',trashed:true}},
    )
    const {ensureDriveTripStructure}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const migrated=await ensureDriveTripStructure(record,trip)

    expect(migrated.calendarStorageMigrated).toBe(true)
    expect(String(fetchMock.mock.calls[5][0])).toContain('addParents=calendar-folder')
    expect(String(fetchMock.mock.calls[5][0])).toContain('removeParents=old-trip-calendar-folder')
    expect(fetchMock.mock.calls[7][1]).toMatchObject({method:'PATCH',body:JSON.stringify({trashed:true})})
  })

  it('uploads journal photos into the inherited trip media folder',async()=>{
    replies.push(
      {body:{files:[]}},
      {body:{id:'media-folder',resourceKey:'media-key'}},
      {body:{id:'photo-file',resourceKey:'photo-key',name:'arrival.jpg',mimeType:'image/jpeg',size:'4'}},
    )
    const {uploadDriveJournalPhoto}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const file=new File(['test'],'arrival.jpg',{type:'image/jpeg'})
    const result=await uploadDriveJournalPhoto(record,trip,'entry-1',file)
    expect(result.record.journalMediaFolderId).toBe('media-folder')
    expect(result.photo).toMatchObject({driveFileId:'photo-file',name:'arrival.jpg',mimeType:'image/jpeg',size:4})
    const uploadBody=fetchMock.mock.calls[2][1]?.body as Blob
    expect(await uploadBody.text()).toContain('"journalEntryId":"entry-1"')
  })

  it('uploads journal audio into the inherited trip media folder',async()=>{
    replies.push(
      {body:{files:[]}},
      {body:{id:'media-folder',resourceKey:'media-key'}},
      {body:{id:'audio-file',resourceKey:'audio-key',name:'street-music.m4a',mimeType:'audio/mp4',size:'5'}},
    )
    const {uploadDriveJournalAudio}=await import('./googleDrive')
    const record={tripId:trip.id,fileId:'file-1',tripFolderId:'trip-folder-1',tripFolderName:trip.name,calendarStorageMigrated:true,ownedByMe:true,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}
    const file=new File(['audio'],'street-music.m4a',{type:'audio/mp4'})
    const result=await uploadDriveJournalAudio(record,trip,'entry-1',file)
    expect(result.record.journalMediaFolderId).toBe('media-folder')
    expect(result.audio).toMatchObject({driveFileId:'audio-file',name:'street-music.m4a',mimeType:'audio/mp4',size:5})
    const uploadBody=fetchMock.mock.calls[2][1]?.body as Blob
    expect(await uploadBody.text()).toContain('"waypoint":"journal-audio"')
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
})
