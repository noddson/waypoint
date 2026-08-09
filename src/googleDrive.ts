import { CalendarSubscriptionMetadata, DrivePermissionSnapshot, JournalAudio, JournalPhoto, SCHEMA_VERSION, Trip, TripExport, sortTripItems } from './types'
import { migrateLegacyJournalEntries } from './journalItems'
import { mergeTripVersions } from './tripMerge'
import { compareTripDateSummaries, tripFirstTravelDate, tripLastTravelDate } from './tripOrder'
import { tripCalendarFilename } from './calendarExport'
import { hasIncomingDriveUpdates } from './driveSync'
import { audioMimeType } from './audioFiles'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'Waypoint travel planner'
const PUBLISHED_CALENDARS_FOLDER_NAME = 'Published Calendars'
const JOURNAL_MEDIA_FOLDER_NAME = 'journal-media'
const SYNC_STORAGE_KEY = 'waypoint-drive-sync'
const TOKEN_STORAGE_KEY = 'waypoint-drive-session'
const BOOTSTRAP_REVISION_PROPERTY = 'waypointBootstrapRevision'
const BOOTSTRAP_CLEANUP_RETRY_BASE_MS = 5*60*1000
const BOOTSTRAP_CLEANUP_RETRY_MAX_MS = 24*60*60*1000

type TokenResponse = {access_token?:string;expires_in?:number;error?:string;error_description?:string}
type TokenClient = {requestAccessToken:(options?:{prompt?:string})=>void}
type GoogleIdentity = {accounts:{oauth2:{initTokenClient:(options:{client_id:string;scope:string;callback:(response:TokenResponse)=>void;error_callback?:(error:unknown)=>void})=>TokenClient}}}
class DriveRequestError extends Error { constructor(message:string,readonly status:number){super(message)} }

declare global { interface Window { google?:GoogleIdentity } }

export interface DriveSyncRecord {
  tripId: string
  fileId: string
  ownedByMe?: boolean
  resourceKey?: string
  tripFolderId?: string
  tripFolderResourceKey?: string
  tripFolderName?: string
  calendarStorageMigrated?: boolean
  journalMediaFolderId?: string
  journalMediaFolderResourceKey?: string
  version?: string
  headRevisionId?: string
  canReadRevisions?: boolean
  canDownload?: boolean
  bootstrapRevisionId?: string
  pendingBootstrapRevisionId?: string
  bootstrapCleanupAttempts?: number
  bootstrapCleanupRetryAt?: string
  lastSyncedUpdatedAt: string
  lastSynchronizedAt: string
  driveModifiedTime?: string
  shared?: boolean
  revision?: string
  baseTrip?: Trip
  permissions?: DrivePermissionSnapshot[]
  calendarSubscription?: CalendarSubscriptionMetadata
}

export interface DriveTripSummary {
  id: string
  name: string
  modifiedTime?: string
  travelStart?: string
  travelEnd?: string
  archived?: boolean
  shared?: boolean
  hasCalendar?: boolean
  resourceKey?: string
  tripId?: string
}

export interface DriveCalendarSubscription {
  fileId:string
  resourceKey?:string
  webContentLink:string
  modifiedTime?:string
}

export interface DriveRevisionSummary {
  id:string
  modifiedTime?:string
  keepForever?:boolean
}

export interface DriveJournalPhotoMetadata {
  id:string
  name?:string
  mimeType?:string
  size?:string
  imageMediaMetadata?:{
    width?:number
    height?:number
    rotation?:number
    time?:string
    cameraMake?:string
    cameraModel?:string
    lens?:string
    exposureTime?:number
    aperture?:number
    focalLength?:number
    isoSpeed?:number
    exposureBias?:number
    location?:{
      latitude?:number
      longitude?:number
      altitude?:number
    }
  }
}

const storedToken=(()=>{try{return JSON.parse(sessionStorage.getItem(TOKEN_STORAGE_KEY)||'{}') as {accessToken?:string;expiresAt?:number}}catch{return {}}})()
let accessToken = storedToken.accessToken||''
let accessTokenExpiresAt = storedToken.expiresAt||0
let googleScriptPromise: Promise<void> | null = null

const driveMetadata = (record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'tripFolderId'|'tripFolderResourceKey'|'journalMediaFolderId'|'journalMediaFolderResourceKey'|'permissions'|'bootstrapRevisionId'>) => ({fileId:record.fileId,resourceKey:record.resourceKey,tripFolderId:record.tripFolderId,tripFolderResourceKey:record.tripFolderResourceKey,journalMediaFolderId:record.journalMediaFolderId,journalMediaFolderResourceKey:record.journalMediaFolderResourceKey,permissions:record.permissions||[],capturedAt:new Date().toISOString(),bootstrapRevisionId:record.bootstrapRevisionId})
const tripExport = (source:Trip,revision=crypto.randomUUID(),parentRevision?:string,record?:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'tripFolderId'|'tripFolderResourceKey'|'journalMediaFolderId'|'journalMediaFolderResourceKey'|'permissions'|'bootstrapRevisionId'>,calendarSubscription?:CalendarSubscriptionMetadata):TripExport => {const trip=migrateLegacyJournalEntries(source);return {schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),trip:{...trip,items:sortTripItems(trip.items)},calendarSubscription,collaboration:{revision,parentRevision,drive:record?driveMetadata(record):undefined}}}
const resourceKeyHeaders = (fileId:string,resourceKey?:string):Record<string,string> => resourceKey?{'X-Goog-Drive-Resource-Keys':`${fileId}/${resourceKey}`}:{ }
type DriveFileCheckpoint = {version?:string;modifiedTime?:string;headRevisionId?:string;capabilities?:{canReadRevisions?:boolean;canDownload?:boolean}}
type DriveFileDetails = DriveFileCheckpoint&{id:string;name:string;resourceKey?:string;ownedByMe?:boolean;parents?:string[];bootstrapRevisionId?:string}
const synchronizedRecord = <T extends DriveSyncRecord>(record:T,details:DriveFileCheckpoint):T => ({...record,version:details.version||record.version,headRevisionId:details.headRevisionId||record.headRevisionId,canReadRevisions:details.capabilities?.canReadRevisions??record.canReadRevisions,canDownload:details.capabilities?.canDownload??record.canDownload,driveModifiedTime:details.modifiedTime||record.driveModifiedTime,lastSynchronizedAt:new Date().toISOString()})

function loadGoogleIdentity() {
  if(window.google?.accounts.oauth2)return Promise.resolve()
  if(googleScriptPromise)return googleScriptPromise
  googleScriptPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-waypoint-google-identity]')
    if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Google sign-in could not be loaded.')),{once:true});return}
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.waypointGoogleIdentity='';script.onload=()=>resolve();script.onerror=()=>reject(new Error('Google sign-in could not be loaded.'));document.head.append(script)
  })
  return googleScriptPromise
}

export function prepareGoogleDrive(){return loadGoogleIdentity()}

export function isGoogleDriveConnected(){return !!accessToken&&Date.now()<accessTokenExpiresAt}

export async function listDriveTrips():Promise<DriveTripSummary[]> {
  const query=new URLSearchParams({
    q:"appProperties has { key='waypoint' and value='trip' } and trashed=false",
    spaces:'drive',
    pageSize:'1000',
    fields:'files(id,name,modifiedTime,resourceKey,appProperties)',
  })
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:Array<{id:string;name:string;modifiedTime?:string;resourceKey?:string;appProperties?:{tripId?:string;travelStart?:string;travelEnd?:string;archived?:string;shared?:string;hasCalendar?:string}}>}
  const trips=(result.files||[]).map(file=>({id:file.id,name:file.name.replace(/\.waypoint\.json$/i,''),modifiedTime:file.modifiedTime,travelStart:file.appProperties?.travelStart,travelEnd:file.appProperties?.travelEnd,archived:file.appProperties?.archived==='true',shared:file.appProperties?.shared==='true',hasCalendar:file.appProperties?.hasCalendar==='true',resourceKey:file.resourceKey,tripId:file.appProperties?.tripId}))
  await Promise.all(trips.filter(trip=>!trip.travelStart||!trip.travelEnd).map(async trip=>{
    try{
      const data=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(trip.id)}?alt=media`,{headers:resourceKeyHeaders(trip.id,trip.resourceKey)}).then(response=>response.json()) as {trip?:Trip}
      if(data.trip?.items){trip.travelStart=tripFirstTravelDate(data.trip);trip.travelEnd=tripLastTravelDate(data.trip)}
    }catch{/* Leave unreadable or undated trips in the undated group. */}
  }))
  return trips.sort((left,right)=>compareTripDateSummaries(left,right))
}

export async function connectGoogleDrive(clientId:string) {
  if(!clientId)throw new Error('Google Drive is not configured for this deployment.')
  await loadGoogleIdentity()
  return new Promise<void>((resolve,reject)=>{
    const client=window.google!.accounts.oauth2.initTokenClient({
      client_id:clientId,
      scope:DRIVE_SCOPE,
      callback:response=>{
        if(response.error||!response.access_token){reject(new Error(response.error_description||response.error||'Google Drive authorization was not completed.'));return}
        accessToken=response.access_token
        accessTokenExpiresAt=Date.now()+Math.max((response.expires_in||3600)-60,60)*1000
        try{sessionStorage.setItem(TOKEN_STORAGE_KEY,JSON.stringify({accessToken,expiresAt:accessTokenExpiresAt}))}catch{/* Private browsing may prevent session storage. */}
        resolve()
      },
      error_callback:()=>reject(new Error('Google Drive authorization was cancelled.')),
    })
    client.requestAccessToken({prompt:''})
  })
}

async function driveFetch(url:string,init:RequestInit={}) {
  if(!isGoogleDriveConnected())throw new Error('Reconnect Google Drive to continue syncing.')
  const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${accessToken}`)
  const response=await fetch(url,{...init,headers})
  if(response.status===401){accessToken='';accessTokenExpiresAt=0;try{sessionStorage.removeItem(TOKEN_STORAGE_KEY)}catch{/* Ignore unavailable storage. */}throw new DriveRequestError('Google Drive access expired. Reconnect to continue syncing.',response.status)}
  if(response.status===403||response.status===429)throw new DriveRequestError('Google Drive temporarily refused the sync. Your changes remain saved on this device.',response.status)
  if(!response.ok){const detail=await response.json().catch(()=>null) as {error?:{message?:string}}|null;throw new DriveRequestError(detail?.error?.message||`Google Drive request failed (${response.status}).`,response.status)}
  return response
}

function readSyncRecords():Record<string,DriveSyncRecord>{try{return JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)||'{}')}catch{return {}}}
export function getDriveSyncRecord(tripId:string){return readSyncRecords()[tripId]}
export function getDriveSyncRecordByFileId(fileId:string){return Object.values(readSyncRecords()).find(record=>record.fileId===fileId)}
export function saveDriveSyncRecord(record:DriveSyncRecord){const records=readSyncRecords();records[record.tripId]=record;localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(records));return record}
export function removeDriveSyncRecord(tripId:string){const records=readSyncRecords();delete records[tripId];localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(records))}

export async function trashDriveTrip(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'tripFolderId'|'tripFolderResourceKey'>) {
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(targetId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(targetId,targetResourceKey)},body:JSON.stringify({trashed:true})})
}

async function findOrCreateFolder() {
  const escaped=FOLDER_NAME.replace(/'/g,"\\'")
  const query=new URLSearchParams({q:`mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,spaces:'drive',pageSize:'10',fields:'files(id,name)'})
  const found=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:{id:string}[]}
  if(found.files?.[0])return found.files[0].id
  const created=await driveFetch(`${DRIVE_API}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})}).then(response=>response.json()) as {id:string}
  return created.id
}

type DriveFolder = {id:string;name?:string;resourceKey?:string}
const driveSafeName = (value:string,fallback:string) => value.replace(/[\\/:*?"<>|]+/g,'-').trim()||fallback
const appPropertyQuery = (key:string,value:string) => `appProperties has { key='${key.replace(/'/g,"\\'")}' and value='${value.replace(/'/g,"\\'")}' }`

async function findAppFolders(parentId:string,waypoint:string,tripId?:string):Promise<DriveFolder[]> {
  const clauses=[`'${parentId.replace(/'/g,"\\'")}' in parents`,`mimeType='application/vnd.google-apps.folder'`,appPropertyQuery('waypoint',waypoint),'trashed=false']
  if(tripId)clauses.push(appPropertyQuery('tripId',tripId))
  const query=new URLSearchParams({q:clauses.join(' and '),spaces:'drive',pageSize:'10',fields:'files(id,name,resourceKey)'})
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:DriveFolder[]}
  return result.files||[]
}

async function findAppFolder(parentId:string,waypoint:string,tripId?:string):Promise<DriveFolder|undefined> {
  return (await findAppFolders(parentId,waypoint,tripId))[0]
}

async function createAppFolder(parentId:string,name:string,waypoint:string,tripId?:string):Promise<DriveFolder> {
  const appProperties:Record<string,string>={waypoint}
  if(tripId)appProperties.tripId=tripId
  return driveFetch(`${DRIVE_API}/files?fields=id,name,resourceKey`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parentId],appProperties})}).then(response=>response.json()) as Promise<DriveFolder>
}

async function findOrCreateTripFolder(trip:Trip):Promise<DriveFolder> {
  const rootId=await findOrCreateFolder()
  return await findAppFolder(rootId,'trip-folder',trip.id)||await createAppFolder(rootId,driveSafeName(trip.name,'Trip'),'trip-folder',trip.id)
}

async function findOrCreatePublishedCalendarsFolder():Promise<DriveFolder> {
  const rootId=await findOrCreateFolder()
  let folder=await findAppFolder(rootId,'published-calendars')
  if(!folder)folder=await createAppFolder(rootId,PUBLISHED_CALENDARS_FOLDER_NAME,'published-calendars')
  else if(folder.name!==PUBLISHED_CALENDARS_FOLDER_NAME){
    folder=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}?fields=id,name,resourceKey`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(folder.id,folder.resourceKey)},body:JSON.stringify({name:PUBLISHED_CALENDARS_FOLDER_NAME})}).then(response=>response.json()) as DriveFolder
  }
  return folder
}

type PublicDrivePermission = {id:string;type:string;role:string}

async function listPublicDrivePermissions(fileId:string,resourceKey?:string) {
  const query=new URLSearchParams({fields:'permissions(id,type,role)'})
  const result=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as {permissions?:PublicDrivePermission[]}
  return (result.permissions||[]).filter(permission=>permission.type==='anyone')
}

async function ensureFilePublicReadOnly(file:Pick<DriveCalendarSubscription,'fileId'|'resourceKey'>) {
  const publicPermission=(await listPublicDrivePermissions(file.fileId,file.resourceKey))[0]
  if(!publicPermission){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.fileId)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(file.fileId,file.resourceKey)},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})})
  }else if(publicPermission.role!=='reader'){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.fileId)}/permissions/${encodeURIComponent(publicPermission.id)}?fields=id,role`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(file.fileId,file.resourceKey)},body:JSON.stringify({role:'reader'})})
  }
}

async function moveDriveFile(fileId:string,parentId:string,resourceKey?:string) {
  const query=new URLSearchParams({fields:'id,parents,resourceKey'})
  const details=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as {id:string;parents?:string[];resourceKey?:string}
  if(details.parents?.includes(parentId))return details
  const moveQuery=new URLSearchParams({addParents:parentId,fields:'id,parents,resourceKey'})
  if(details.parents?.length)moveQuery.set('removeParents',details.parents.join(','))
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${moveQuery}`,{method:'PATCH',headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as Promise<{id:string;parents?:string[];resourceKey?:string}>
}

export async function findDriveCalendarSubscription(tripId:string):Promise<DriveCalendarSubscription|undefined> {
  const escapedTripId=tripId.replace(/'/g,"\\'")
  const query=new URLSearchParams({
    q:`appProperties has { key='waypoint' and value='calendar' } and appProperties has { key='tripId' and value='${escapedTripId}' } and trashed=false`,
    spaces:'drive',pageSize:'10',fields:'files(id,name,modifiedTime,resourceKey,webContentLink)',
  })
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:Array<{id:string;resourceKey?:string;webContentLink?:string;modifiedTime?:string}>}
  const file=result.files?.[0]
  return file?.webContentLink?{fileId:file.id,resourceKey:file.resourceKey,webContentLink:file.webContentLink,modifiedTime:file.modifiedTime}:undefined
}

async function calendarFileDetails(fileId:string,resourceKey?:string):Promise<DriveCalendarSubscription> {
  const query=new URLSearchParams({fields:'id,resourceKey,webContentLink,modifiedTime'})
  const file=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as {id:string;resourceKey?:string;webContentLink?:string;modifiedTime?:string}
  if(!file.webContentLink)throw new Error('Google Drive did not provide a public calendar download link.')
  return {fileId:file.id,resourceKey:file.resourceKey||resourceKey,webContentLink:file.webContentLink,modifiedTime:file.modifiedTime}
}

async function removeTripPublishedCalendarFolders(tripFolderId:string,tripId:string) {
  const folders=await findAppFolders(tripFolderId,'published-calendar',tripId)
  for(const folder of folders){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(folder.id,folder.resourceKey)},body:JSON.stringify({trashed:true})})
  }
}

async function migratePublishedCalendarStorage(trip:Trip,tripFolderId:string) {
  const subscription=await findDriveCalendarSubscription(trip.id)
  if(subscription){
    const folder=await findOrCreatePublishedCalendarsFolder()
    await moveDriveFile(subscription.fileId,folder.id,subscription.resourceKey)
    await ensureFilePublicReadOnly(subscription)
  }
  await removeTripPublishedCalendarFolders(tripFolderId,trip.id)
}

async function uploadCalendarFile(subscription:Pick<DriveCalendarSubscription,'fileId'|'resourceKey'>,trip:Trip,calendar:string) {
  await driveFetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(subscription.fileId)}?uploadType=media&fields=id`,{method:'PATCH',headers:{'Content-Type':'text/calendar; charset=utf-8',...resourceKeyHeaders(subscription.fileId,subscription.resourceKey)},body:calendar})
  const query=new URLSearchParams({fields:'id,resourceKey,webContentLink,modifiedTime'})
  const file=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(subscription.fileId)}?${query}`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(subscription.fileId,subscription.resourceKey)},body:JSON.stringify({name:tripCalendarFilename(trip),appProperties:{waypoint:'calendar',tripId:trip.id}})}).then(response=>response.json()) as {id:string;resourceKey?:string;webContentLink?:string;modifiedTime?:string}
  if(!file.webContentLink)throw new Error('Google Drive did not provide a calendar subscription URL.')
  return {fileId:file.id,resourceKey:file.resourceKey||subscription.resourceKey,webContentLink:file.webContentLink,modifiedTime:file.modifiedTime}
}

export async function publishDriveCalendarSubscription(trip:Trip,calendar:string,record?:Pick<DriveSyncRecord,'tripFolderId'>):Promise<DriveCalendarSubscription> {
  const structured=record||getDriveSyncRecord(trip.id),folder=await findOrCreatePublishedCalendarsFolder()
  let subscription=await findDriveCalendarSubscription(trip.id)
  if(!subscription){
    const boundary=`waypoint-calendar-${crypto.randomUUID()}`
    const metadata={name:tripCalendarFilename(trip),mimeType:'text/calendar',parents:[folder.id],appProperties:{waypoint:'calendar',tripId:trip.id}}
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/calendar; charset=UTF-8\r\n\r\n${calendar}\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
    const file=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as {id:string;resourceKey?:string}
    subscription=await calendarFileDetails(file.id,file.resourceKey)
  }else{
    await moveDriveFile(subscription.fileId,folder.id,subscription.resourceKey)
    subscription=await uploadCalendarFile(subscription,trip,calendar)
  }
  await ensureFilePublicReadOnly(subscription)
  if(structured?.tripFolderId)await removeTripPublishedCalendarFolders(structured.tripFolderId,trip.id)
  return calendarFileDetails(subscription.fileId,subscription.resourceKey)
}

export async function refreshDriveCalendarSubscription(trip:Trip,calendar:string,knownSubscription?:DriveCalendarSubscription) {
  const subscription=knownSubscription||await findDriveCalendarSubscription(trip.id)
  if(!subscription)return undefined
  const folder=await findOrCreatePublishedCalendarsFolder()
  await moveDriveFile(subscription.fileId,folder.id,subscription.resourceKey)
  const refreshed=await uploadCalendarFile(subscription,trip,calendar)
  await ensureFilePublicReadOnly(refreshed)
  const record=getDriveSyncRecord(trip.id)
  if(record?.tripFolderId)await removeTripPublishedCalendarFolders(record.tripFolderId,trip.id)
  return refreshed
}

async function ensureJournalMediaFolder(record:DriveSyncRecord,trip:Trip) {
  let structured=await ensureDriveTripStructure(record,trip)
  if(!structured.tripFolderId)throw new Error('The Drive owner must open and synchronize this trip before collaborators can add media.')
  if(structured.journalMediaFolderId)return {record:structured,folder:{id:structured.journalMediaFolderId,resourceKey:structured.journalMediaFolderResourceKey} as DriveFolder}
  const folder=await findAppFolder(structured.tripFolderId,'journal-media',trip.id)||await createAppFolder(structured.tripFolderId,JOURNAL_MEDIA_FOLDER_NAME,'journal-media',trip.id)
  structured=saveDriveSyncRecord({...structured,journalMediaFolderId:folder.id,journalMediaFolderResourceKey:folder.resourceKey})
  return {record:structured,folder}
}

type JournalMediaKind='photo'|'audio'
type UploadedJournalMedia={id:string;resourceKey?:string;name?:string;mimeType?:string;size?:string|number}
const journalMediaMetadata = (kind:JournalMediaKind,trip:Trip,entryId:string,attachmentId:string,file:File,mimeType:string,parentId:string) => ({name:driveSafeName(file.name,kind),mimeType,parents:[parentId],appProperties:{waypoint:`journal-${kind}`,tripId:trip.id,journalEntryId:entryId,attachmentId}})
const journalMediaFromDrive = (attachmentId:string,file:File,mimeType:string,createdAt:string,uploaded:UploadedJournalMedia):JournalPhoto|JournalAudio => ({id:attachmentId,driveFileId:uploaded.id,resourceKey:uploaded.resourceKey,name:uploaded.name||file.name,mimeType:uploaded.mimeType||mimeType,size:Number(uploaded.size??file.size),createdAt})

async function uploadDriveJournalMedia(record:DriveSyncRecord,trip:Trip,entryId:string,file:File,kind:JournalMediaKind):Promise<{record:DriveSyncRecord;media:JournalPhoto|JournalAudio}> {
  const mimeType=kind==='photo'&&file.type.startsWith('image/')?file.type:kind==='audio'?audioMimeType(file):undefined
  if(!mimeType)throw new Error(kind==='photo'?'Choose an image file to add to the journal.':'Choose an audio file to add to the journal.')
  const {record:structured,folder}=await ensureJournalMediaFolder(record,trip),attachmentId=crypto.randomUUID(),createdAt=new Date().toISOString(),metadata=journalMediaMetadata(kind,trip,entryId,attachmentId,file,mimeType,folder.id)
  let uploaded:{id:string;resourceKey?:string;name?:string;mimeType?:string;size?:string|number}
  if(file.size<=5*1024*1024){
    const boundary=`waypoint-${kind}-${crypto.randomUUID()}`
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,file,`\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
    uploaded=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey,name,mimeType,size`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as typeof uploaded
  }else{
    const session=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,resourceKey,name,mimeType,size`,{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':mimeType,'X-Upload-Content-Length':String(file.size)},body:JSON.stringify(metadata)})
    const location=session.headers.get('Location')
    if(!location)throw new Error(`Google Drive did not provide a resumable ${kind}-upload URL.`)
    uploaded=await driveFetch(location,{method:'PUT',headers:{'Content-Type':mimeType},body:file}).then(response=>response.json()) as typeof uploaded
  }
  return {record:structured,media:journalMediaFromDrive(attachmentId,file,mimeType,createdAt,uploaded)}
}

export async function uploadDriveJournalPhoto(record:DriveSyncRecord,trip:Trip,entryId:string,file:File):Promise<{record:DriveSyncRecord;photo:JournalPhoto}> {
  const result=await uploadDriveJournalMedia(record,trip,entryId,file,'photo')
  return {record:result.record,photo:result.media}
}

export async function uploadDriveJournalAudio(record:DriveSyncRecord,trip:Trip,entryId:string,file:File):Promise<{record:DriveSyncRecord;audio:JournalAudio}> {
  const result=await uploadDriveJournalMedia(record,trip,entryId,file,'audio')
  return {record:result.record,audio:result.media}
}

async function loadDriveJournalMedia(media:Pick<JournalPhoto|JournalAudio,'driveFileId'|'resourceKey'>) {
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(media.driveFileId)}?alt=media`,{headers:resourceKeyHeaders(media.driveFileId,media.resourceKey)}).then(response=>response.blob())
}

export const loadDriveJournalPhoto = loadDriveJournalMedia
export const loadDriveJournalAudio = loadDriveJournalMedia

export async function loadDriveJournalPhotoMetadata(photo:Pick<JournalPhoto,'driveFileId'|'resourceKey'>):Promise<DriveJournalPhotoMetadata> {
  const fields='id,name,mimeType,size,imageMediaMetadata(width,height,rotation,time,cameraMake,cameraModel,lens,exposureTime,aperture,focalLength,isoSpeed,exposureBias,location(latitude,longitude,altitude))'
  const query=new URLSearchParams({fields})
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(photo.driveFileId)}?${query}`,{headers:resourceKeyHeaders(photo.driveFileId,photo.resourceKey)}).then(response=>response.json()) as Promise<DriveJournalPhotoMetadata>
}

async function trashDriveJournalMedia(media:Pick<JournalPhoto|JournalAudio,'driveFileId'|'resourceKey'>) {
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(media.driveFileId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(media.driveFileId,media.resourceKey)},body:JSON.stringify({trashed:true})})
}

export const trashDriveJournalPhoto = trashDriveJournalMedia
export const trashDriveJournalAudio = trashDriveJournalMedia

const calendarSubscriptionMetadata = (subscription:DriveCalendarSubscription,linkedAt=new Date().toISOString()):CalendarSubscriptionMetadata => ({provider:'google-drive',format:'ics',mimeType:'text/calendar',access:'public-read-only',fileId:subscription.fileId,resourceKey:subscription.resourceKey,publicUrl:subscription.webContentLink,linkedAt})

export async function linkDriveCalendarSubscription(record:DriveSyncRecord,subscription:DriveCalendarSubscription) {
  const {data,details}=await loadDriveTrip(record.fileId,record.resourceKey),current=data as TripExport
  if(!current?.trip||!current.collaboration?.revision)throw new Error('The Google Drive itinerary JSON could not be linked to its calendar feed.')
  const existing=current.calendarSubscription,calendarSubscription=calendarSubscriptionMetadata(subscription,existing?.fileId===subscription.fileId&&existing.publicUrl===subscription.webContentLink?existing.linkedAt:undefined)
  if(JSON.stringify(existing)===JSON.stringify(calendarSubscription))return saveDriveSyncRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,version:details.version||record.version,calendarSubscription})
  const updated=await uploadDriveExport(record,{...current,exportedAt:new Date().toISOString(),calendarSubscription})
  return saveDriveSyncRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,version:updated.version||details.version||record.version,calendarSubscription})
}

export async function unlinkMissingDriveCalendarSubscription(record:DriveSyncRecord) {
  const {data,details}=await loadDriveTrip(record.fileId,record.resourceKey),current=data as TripExport
  if(!current?.trip||!current.collaboration?.revision)throw new Error('The Google Drive itinerary JSON could not be unlinked from its missing calendar feed.')
  const unlinked:DriveSyncRecord={...record,ownedByMe:details.ownedByMe??record.ownedByMe,version:details.version||record.version}
  delete unlinked.calendarSubscription
  if(!current.calendarSubscription)return saveDriveSyncRecord(unlinked)
  const updated=await uploadDriveExport(record,{...current,exportedAt:new Date().toISOString(),calendarSubscription:undefined})
  unlinked.version=updated.version||details.version||record.version
  return saveDriveSyncRecord(unlinked)
}

export async function trashDriveCalendarSubscription(tripId:string) {
  const subscription=await findDriveCalendarSubscription(tripId)
  if(subscription)await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(subscription.fileId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(subscription.fileId,subscription.resourceKey)},body:JSON.stringify({trashed:true})})
}

export async function createDriveTrip(trip:Trip) {
  const folder=await findOrCreateTripFolder(trip)
  const revision=crypto.randomUUID()
  const boundary=`waypoint-${crypto.randomUUID()}`
  const metadata={name:`${driveSafeName(trip.name,'Trip')}.waypoint.json`,mimeType:'application/json',parents:[folder.id],appProperties:{waypoint:'trip',tripId:trip.id,travelStart:tripFirstTravelDate(trip),travelEnd:tripLastTravelDate(trip),archived:String(!!trip.archivedAt),shared:'false',hasCalendar:'false'}}
  const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(tripExport(trip,revision))}\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
  const file=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey,headRevisionId`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as {id:string;resourceKey?:string;headRevisionId?:string}
  const details=await getDriveFileDetails(file.id,file.resourceKey)
  let record:DriveSyncRecord={tripId:trip.id,fileId:file.id,ownedByMe:details.ownedByMe??true,resourceKey:details.resourceKey||file.resourceKey,tripFolderId:folder.id,tripFolderResourceKey:folder.resourceKey,tripFolderName:driveSafeName(trip.name,'Trip'),calendarStorageMigrated:true,version:details.version,headRevisionId:details.headRevisionId,canReadRevisions:details.capabilities?.canReadRevisions,canDownload:details.capabilities?.canDownload,bootstrapRevisionId:file.headRevisionId||details.headRevisionId,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:new Date().toISOString(),driveModifiedTime:details.modifiedTime,revision,baseTrip:trip}
  record.permissions=await listDrivePermissions(record)
  const updated=await uploadDriveExport(record,tripExport(trip,revision,undefined,record),record.bootstrapRevisionId)
  record=synchronizedRecord(record,updated)
  if(record.ownedByMe===true&&record.bootstrapRevisionId&&updated.headRevisionId&&record.bootstrapRevisionId!==updated.headRevisionId)record.pendingBootstrapRevisionId=record.bootstrapRevisionId
  record=saveDriveSyncRecord(record)
  return retryDriveBootstrapRevisionCleanup(record,true)
}

const permissionKey = (permission:DrivePermissionSnapshot) => `${permission.type}\0${permission.emailAddress||permission.domain||''}\0${permission.role}`
const permissionBody = (permission:DrivePermissionSnapshot) => {
  const body:Record<string,unknown>={type:permission.type,role:permission.role}
  if(permission.type==='user'||permission.type==='group'){
    if(!permission.emailAddress)return undefined
    body.emailAddress=permission.emailAddress
  }
  if(permission.type==='domain'){
    if(!permission.domain)return undefined
    body.domain=permission.domain
  }
  if(permission.allowFileDiscovery!==undefined)body.allowFileDiscovery=permission.allowFileDiscovery
  return body
}

async function copyDrivePermissionsToFolder(record:DriveSyncRecord,folder:DriveFolder) {
  const source=await listDrivePermissions({...record,tripFolderId:undefined,tripFolderResourceKey:undefined})
  const folderRecord={...record,tripFolderId:folder.id,tripFolderResourceKey:folder.resourceKey}
  const existing=await listDrivePermissions(folderRecord),keys=new Set(existing.map(permissionKey))
  for(const permission of source){
    if(permission.role==='owner'||keys.has(permissionKey(permission)))continue
    const body=permissionBody(permission)
    if(!body)continue
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(folder.id,folder.resourceKey)},body:JSON.stringify(body)})
  }
  return {source,permissions:await listDrivePermissions(folderRecord)}
}

export async function ensureDriveTripStructure(record:DriveSyncRecord,trip:Trip):Promise<DriveSyncRecord> {
  const folderName=driveSafeName(trip.name,'Trip')
  if(record.tripFolderId){
    let structured=record
    if(record.ownedByMe===true&&record.tripFolderName!==folderName){
      try{await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.tripFolderId)}?fields=id,name`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.tripFolderId,record.tripFolderResourceKey)},body:JSON.stringify({name:folderName})});structured={...structured,tripFolderName:folderName}}catch{/* Renaming organization must not block itinerary synchronization. */}
    }
    if(structured.ownedByMe===true&&structured.calendarStorageMigrated!==true){
      await migratePublishedCalendarStorage(trip,record.tripFolderId)
      structured={...structured,calendarStorageMigrated:true}
    }
    return structured===record?record:saveDriveSyncRecord(structured)
  }
  if(record.ownedByMe!==true)return record
  const folder=await findOrCreateTripFolder(trip)
  const {source,permissions}=await copyDrivePermissionsToFolder(record,folder)
  await moveDriveFile(record.fileId,folder.id,record.resourceKey)
  await migratePublishedCalendarStorage(trip,folder.id)
  for(const permission of source){
    if(permission.role==='owner')continue
    try{await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/permissions/${encodeURIComponent(permission.id)}`,{method:'DELETE',headers:resourceKeyHeaders(record.fileId,record.resourceKey)})}catch{/* Folder access is authoritative; a redundant direct permission can be cleaned up on a later migration pass. */}
  }
  return saveDriveSyncRecord({...record,tripFolderId:folder.id,tripFolderResourceKey:folder.resourceKey,tripFolderName:folderName,calendarStorageMigrated:true,permissions,shared:permissions.some(permission=>permission.role!=='owner')})
}

export async function enableDriveTripSharing(record:DriveSyncRecord) {
  const existing=record.permissions||await listDrivePermissions(record)
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  if(!existing.some(permission=>permission.type==='anyone'&&permission.role==='writer')){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(targetId)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(targetId,targetResourceKey)},body:JSON.stringify({type:'anyone',role:'writer',allowFileDiscovery:false})})
  }
  return refreshDriveAccess(record)
}

async function getDriveFileDetails(fileId:string,resourceKey?:string){
  const query=new URLSearchParams({fields:'id,name,parents,version,headRevisionId,modifiedTime,resourceKey,ownedByMe,appProperties,capabilities(canReadRevisions,canDownload)'})
  const file=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as DriveFileCheckpoint&{id:string;name:string;resourceKey?:string;ownedByMe?:boolean;appProperties?:Record<string,string>}
  return {...file,bootstrapRevisionId:file.appProperties?.[BOOTSTRAP_REVISION_PROPERTY]} satisfies DriveFileDetails
}

function withoutPendingBootstrapCleanup(record:DriveSyncRecord) {
  const next={...record}
  delete next.pendingBootstrapRevisionId
  delete next.bootstrapCleanupAttempts
  delete next.bootstrapCleanupRetryAt
  return next
}

const bootstrapCleanupDelay = (attempt:number) => Math.min(BOOTSTRAP_CLEANUP_RETRY_MAX_MS,BOOTSTRAP_CLEANUP_RETRY_BASE_MS*2**Math.min(Math.max(attempt-1,0),8))

async function clearBootstrapRevisionProperty(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'>) {
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}?fields=id`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({appProperties:{[BOOTSTRAP_REVISION_PROPERTY]:null}})})
}

function withDriveBootstrapCleanupMarker(record:DriveSyncRecord,details:DriveFileDetails) {
  const ownedByMe=details.ownedByMe??record.ownedByMe,bootstrapRevisionId=details.bootstrapRevisionId||record.bootstrapRevisionId
  const next:DriveSyncRecord={...record,ownedByMe,bootstrapRevisionId}
  if(!next.pendingBootstrapRevisionId&&ownedByMe===true&&details.bootstrapRevisionId&&details.headRevisionId&&details.bootstrapRevisionId!==details.headRevisionId)next.pendingBootstrapRevisionId=details.bootstrapRevisionId
  return next
}

export async function retryDriveBootstrapRevisionCleanup(record:DriveSyncRecord,force=false) {
  const revisionId=record.pendingBootstrapRevisionId
  if(!revisionId||record.bootstrapRevisionId!==revisionId||record.ownedByMe!==true||!record.headRevisionId||record.headRevisionId===revisionId)return record
  const retryAt=Date.parse(record.bootstrapCleanupRetryAt||'')
  if(!force&&!Number.isNaN(retryAt)&&retryAt>Date.now())return record
  const attempts=(record.bootstrapCleanupAttempts||0)+1
  const pending=saveDriveSyncRecord({...record,bootstrapCleanupAttempts:attempts,bootstrapCleanupRetryAt:new Date(Date.now()+bootstrapCleanupDelay(attempts)).toISOString()})
  const revisionUrl=`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/revisions/${encodeURIComponent(revisionId)}`
  try{
    await driveFetch(`${revisionUrl}?fields=id,keepForever`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({keepForever:true})})
    await driveFetch(revisionUrl,{method:'DELETE',headers:resourceKeyHeaders(record.fileId,record.resourceKey)})
    await clearBootstrapRevisionProperty(record)
    return saveDriveSyncRecord(withoutPendingBootstrapCleanup(pending))
  }catch(error){
    if(error instanceof DriveRequestError&&error.status===404){
      try{const details=await getDriveFileDetails(record.fileId,record.resourceKey);if(details.headRevisionId&&details.headRevisionId!==revisionId){if(details.bootstrapRevisionId===revisionId)await clearBootstrapRevisionProperty(record);return saveDriveSyncRecord(withoutPendingBootstrapCleanup(pending))}}catch{/* Keep the cleanup pending until the file is accessible again. */}
    }
    return pending
  }
}

async function uploadDriveExport(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'>,value:TripExport,bootstrapRevisionId?:string){
  await driveFetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(record.fileId)}?uploadType=media&fields=id`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify(value)})
  const shared=!!value.collaboration?.drive?.permissions.some(permission=>permission.role!=='owner')
  const appProperties:Record<string,string>={waypoint:'trip',tripId:value.trip.id,travelStart:tripFirstTravelDate(value.trip),travelEnd:tripLastTravelDate(value.trip),archived:String(!!value.trip.archivedAt),shared:String(shared),hasCalendar:String(!!value.calendarSubscription)}
  if(bootstrapRevisionId)appProperties[BOOTSTRAP_REVISION_PROPERTY]=bootstrapRevisionId
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}?fields=id,version,headRevisionId,modifiedTime,capabilities(canReadRevisions,canDownload)`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({appProperties})}).then(response=>response.json()) as Promise<DriveFileCheckpoint>
}

export async function listDrivePermissions(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'tripFolderId'|'tripFolderResourceKey'>) {
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  const fields='permissions(id,type,role,displayName,emailAddress,photoLink,domain,allowFileDiscovery)'
  const query=new URLSearchParams({fields})
  const result=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(targetId)}/permissions?${query}`,{headers:resourceKeyHeaders(targetId,targetResourceKey)}).then(response=>response.json()) as {permissions?:DrivePermissionSnapshot[]}
  return (result.permissions||[]).sort((a,b)=>(a.role==='owner'?-1:b.role==='owner'?1:0)||(a.displayName||a.emailAddress||a.type).localeCompare(b.displayName||b.emailAddress||b.type))
}

async function persistDriveAccessMetadata(record:DriveSyncRecord) {
  const {data,details}=await loadDriveTrip(record.fileId,record.resourceKey)
  const current=data as TripExport
  const identified={...record,ownedByMe:details.ownedByMe??record.ownedByMe}
  if(!current?.trip||!current.collaboration?.revision)return {...identified,version:details.version||record.version}
  const value:TripExport={...current,exportedAt:new Date().toISOString(),collaboration:{...current.collaboration,drive:driveMetadata(record)}}
  const updated=await uploadDriveExport(record,value)
  return {...identified,version:updated.version||record.version}
}

export async function refreshDriveAccess(record:DriveSyncRecord) {
  const permissions=await listDrivePermissions(record)
  const local={...record,permissions,shared:permissions.some(permission=>permission.role!=='owner')}
  try{return saveDriveSyncRecord(await persistDriveAccessMetadata(local))}
  catch{return saveDriveSyncRecord(local)}
}

export async function revokeDrivePermission(record:DriveSyncRecord,permissionId:string) {
  const permission=(record.permissions||[]).find(value=>value.id===permissionId)
  if(permission?.role==='owner')throw new Error('The file owner cannot be removed from the itinerary.')
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(targetId)}/permissions/${encodeURIComponent(permissionId)}`,{method:'DELETE',headers:resourceKeyHeaders(targetId,targetResourceKey)})
  return refreshDriveAccess(record)
}

export async function loadDriveTrip(fileId:string,resourceKey?:string) {
  const [details,data]=await Promise.all([
    getDriveFileDetails(fileId,resourceKey),
    driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()),
  ])
  return {details,data}
}

export async function listDriveTripRevisions(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'headRevisionId'|'canReadRevisions'|'canDownload'|'bootstrapRevisionId'>,refreshFileDetails=false) {
  const needsFreshCapabilities=refreshFileDetails||!record.headRevisionId||record.canReadRevisions!==true||record.canDownload!==true
  const details=needsFreshCapabilities?await getDriveFileDetails(record.fileId,record.resourceKey):undefined
  const canReadRevisions=details?.capabilities?.canReadRevisions??record.canReadRevisions
  if(canReadRevisions===false)throw new Error('Google Drive does not allow this account to read version history for the trip.')
  const revisions:DriveRevisionSummary[]=[]
  let pageToken:string|undefined
  do{
    const query=new URLSearchParams({pageSize:'1000',fields:'nextPageToken,revisions(id,modifiedTime,keepForever)'})
    if(pageToken)query.set('pageToken',pageToken)
    const page=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/revisions?${query}`,{headers:resourceKeyHeaders(record.fileId,record.resourceKey)}).then(response=>response.json()) as {revisions?:DriveRevisionSummary[];nextPageToken?:string}
    revisions.push(...(page.revisions||[]))
    pageToken=page.nextPageToken
  }while(pageToken)
  const headRevisionId=details?.headRevisionId||record.headRevisionId
  const visibleRevisions=record.bootstrapRevisionId&&record.bootstrapRevisionId!==headRevisionId?revisions.filter(revision=>revision.id!==record.bootstrapRevisionId):revisions
  return {revisions:visibleRevisions,headRevisionId,canDownload:details?.capabilities?.canDownload??record.canDownload}
}

export async function loadDriveTripRevision(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'canDownload'>,revision:DriveRevisionSummary) {
  if(record.canDownload===false)throw new Error('Google Drive does not allow this account to download trip versions.')
  let kept=revision
  if(!revision.keepForever){
    kept=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/revisions/${encodeURIComponent(revision.id)}?fields=id,modifiedTime,keepForever`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({keepForever:true})}).then(response=>response.json()) as DriveRevisionSummary
  }
  const data=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/revisions/${encodeURIComponent(revision.id)}?alt=media`,{headers:resourceKeyHeaders(record.fileId,record.resourceKey)}).then(response=>response.json())
  return {data,revision:{...revision,keepForever:kept.keepForever===true}}
}

function downloadDriveTrip(fileId:string,resourceKey?:string) {
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json())
}

export async function updateDriveTrip(record:DriveSyncRecord,trip:Trip) {
  if(record.tripId!==trip.id)throw new Error('Sync stopped because the selected trip does not match this Google Drive file.')
  trip=migrateLegacyJournalEntries(trip)
  const cleanupWasPending=!!record.pendingBootstrapRevisionId
  record=await retryDriveBootstrapRevisionCleanup(record)
  const cleanupCompleted=cleanupWasPending&&!record.pendingBootstrapRevisionId
  const details=await getDriveFileDetails(record.fileId,record.resourceKey)
  const discoveredCleanup=!cleanupCompleted&&!record.pendingBootstrapRevisionId&&!!details.bootstrapRevisionId&&details.bootstrapRevisionId!==details.headRevisionId
  record=withDriveBootstrapCleanupMarker(record,details)
  if(discoveredCleanup&&record.pendingBootstrapRevisionId)record=await retryDriveBootstrapRevisionCleanup(record,true)
  const structureWasMissing=!record.tripFolderId
  record=await ensureDriveTripStructure({...record,ownedByMe:details.ownedByMe??record.ownedByMe},trip)
  const structureChanged=structureWasMissing&&!!record.tripFolderId
  if(!record.tripFolderId&&record.ownedByMe===false){
    try{
      const current=await downloadDriveTrip(record.fileId,record.resourceKey) as TripExport,drive=current.collaboration?.drive
      if(drive?.tripFolderId)record=saveDriveSyncRecord({...record,tripFolderId:drive.tripFolderId,tripFolderResourceKey:drive.tripFolderResourceKey,journalMediaFolderId:drive.journalMediaFolderId,journalMediaFolderResourceKey:drive.journalMediaFolderResourceKey})
    }catch{/* Legacy shared files remain usable without folder-backed journal photos. */}
  }
  const base=record.baseTrip?migrateLegacyJournalEntries(record.baseTrip):undefined
  const localChanged=!base||JSON.stringify(trip)!==JSON.stringify(base)||structureChanged
  if(base&&!hasIncomingDriveUpdates(record,details)){
    if(!localChanged){
      const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe},details))
      return {record:nextRecord,trip,conflicts:0,changed:false}
    }
    const revision=crypto.randomUUID()
    const updated=await uploadDriveExport(record,tripExport(trip,revision,record.revision,record,record.calendarSubscription))
    const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,lastSyncedUpdatedAt:trip.updatedAt,revision,baseTrip:trip},updated))
    return {record:nextRecord,trip,conflicts:0,changed:true}
  }
  const data=await downloadDriveTrip(record.fileId,record.resourceKey)
  const downloaded=data as TripExport
  if(!downloaded?.trip||!Array.isArray(downloaded.trip.items))throw new Error('The Drive file no longer contains a supported Waypoint trip.')
  const remote={...downloaded,trip:migrateLegacyJournalEntries(downloaded.trip)}
  if(remote.trip.id!==trip.id)throw new Error('Sync stopped because this Google Drive file belongs to a different trip.')
  record={...record,bootstrapRevisionId:record.bootstrapRevisionId||remote.collaboration?.drive?.bootstrapRevisionId,tripFolderId:record.tripFolderId||remote.collaboration?.drive?.tripFolderId,tripFolderResourceKey:record.tripFolderResourceKey||remote.collaboration?.drive?.tripFolderResourceKey,journalMediaFolderId:record.journalMediaFolderId||remote.collaboration?.drive?.journalMediaFolderId,journalMediaFolderResourceKey:record.journalMediaFolderResourceKey||remote.collaboration?.drive?.journalMediaFolderResourceKey}
  const mergeBase=base||remote.trip
  const hasLocalUpdates=JSON.stringify(trip)!==JSON.stringify(mergeBase)
  const remoteChanged=JSON.stringify(remote.trip)!==JSON.stringify(mergeBase)
  if(!hasLocalUpdates){
    const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,lastSyncedUpdatedAt:remote.trip.updatedAt,revision:remote.collaboration?.revision||record.revision,permissions:record.permissions||remote.collaboration?.drive?.permissions,calendarSubscription:remote.calendarSubscription,baseTrip:remote.trip},details))
    return {record:nextRecord,trip:remote.trip,conflicts:0,changed:remoteChanged}
  }
  const {trip:merged,conflicts}=remoteChanged?mergeTripVersions(mergeBase,trip,remote.trip):{trip,conflicts:0}
  const revision=crypto.randomUUID()
  const parentRevision=remote.collaboration?.revision||record.revision
  const updated=await uploadDriveExport(record,tripExport(merged,revision,parentRevision,record,remote.calendarSubscription||record.calendarSubscription))
  const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,lastSyncedUpdatedAt:merged.updatedAt,revision,calendarSubscription:remote.calendarSubscription||record.calendarSubscription,baseTrip:merged},updated))
  return {record:nextRecord,trip:merged,conflicts,changed:true}
}

export function driveShareUrl(record:DriveSyncRecord) {
  const url=new URL(location.href);url.hash='';url.searchParams.set('driveTrip',record.fileId);if(record.resourceKey)url.searchParams.set('resourceKey',record.resourceKey);return url.toString()
}

export function driveTripFromLocation(){const params=new URLSearchParams(location.search);const fileId=params.get('driveTrip');return fileId?{fileId,resourceKey:params.get('resourceKey')||undefined}:null}
