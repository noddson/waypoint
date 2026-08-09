import { CalendarSubscriptionMetadata, CanonicalTripExportV2, DrivePermissionSnapshot, JournalAudio, JournalPhoto, SharePolicyV1, Trip, TripExport, sortTripItems } from './types'
import { migrateLegacyJournalEntries } from './journalItems'
import { createTripExportV2, validTripExport } from './tripImport'
import { isSharePolicyV1, isShareProjectionV1 } from './sharePolicy'
import type { ShareProjectionV1 } from './types'
import { mergeTripVersions } from './tripMerge'
import { compareTripDateSummaries, tripFirstTravelDate, tripLastTravelDate } from './tripOrder'
import { tripCalendarFilename } from './calendarExport'
import { hasIncomingDriveUpdates } from './driveSync'
import { audioMimeType } from './audioFiles'
import { validProfileV1 } from './profile'
import type { ProfileV1 } from './profile'
import { isIsoInstant } from './schemaValidation'
import type { ProviderSession, SyncProvider, SyncPublicationAudience } from './syncProvider'
export type { ProfileV1 } from './profile'
export type { ProviderSession, ProviderSyncResult, SyncProvider } from './syncProvider'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'Waypoint travel planner'
const PUBLISHED_TRIPS_FOLDER_NAME = 'Published Trips'
const PUBLISHED_CALENDARS_FOLDER_NAME = 'Published Calendars'
const JOURNAL_MEDIA_FOLDER_NAME = 'journal-media'
const JOURNAL_PHOTOS_FOLDER_NAME = 'photos'
const JOURNAL_AUDIO_FOLDER_NAME = 'audio'
const PROFILE_FILE_NAME = 'PROFILE.JSON'
const LINKS_FILE_NAME = 'LINKS.JSON'
const ROOT_FOLDER_KIND = 'waypoint-root'
const SYNC_STORAGE_KEY = 'waypoint-drive-sync'
const TOKEN_STORAGE_KEY = 'waypoint-drive-session'
const BOOTSTRAP_REVISION_PROPERTY = 'waypointBootstrapRevision'
const BOOTSTRAP_CLEANUP_RETRY_BASE_MS = 5*60*1000
const BOOTSTRAP_CLEANUP_RETRY_MAX_MS = 24*60*60*1000

type TokenResponse = {access_token?:string;expires_in?:number;error?:string;error_description?:string}
type TokenClient = {requestAccessToken:(options?:{prompt?:string})=>void}
type PickerDocument={id?:string}
type PickerData={action?:string;docs?:PickerDocument[]}
type PickerView={setMimeTypes:(mimeTypes:string)=>PickerView}
type PickerBuilder={addView:(view:PickerView)=>PickerBuilder;setOAuthToken:(token:string)=>PickerBuilder;setDeveloperKey:(key:string)=>PickerBuilder;setAppId:(id:string)=>PickerBuilder;setOrigin:(origin:string)=>PickerBuilder;setCallback:(callback:(data:PickerData)=>void)=>PickerBuilder;build:()=>{setVisible:(visible:boolean)=>void}}
type GoogleIdentity = {
  accounts?:{oauth2:{initTokenClient:(options:{client_id:string;scope:string;callback:(response:TokenResponse)=>void;error_callback?:(error:unknown)=>void})=>TokenClient}}
  picker?:{Action:{PICKED:string;CANCEL:string};ViewId:{DOCS:string};DocsView:new(viewId:string)=>PickerView;PickerBuilder:new()=>PickerBuilder}
}
type GoogleApiLoader={load:(name:string,options:(()=>void)|{callback:()=>void;onerror?:()=>void;timeout?:number;ontimeout?:()=>void})=>void}
export class DriveRequestError extends Error {
  constructor(message:string,readonly status:number,readonly reason?:string){super(message);this.name='DriveRequestError'}
}

declare global { interface Window { google?:GoogleIdentity;gapi?:GoogleApiLoader } }

export interface DriveSyncRecord {
  tripId: string
  fileId: string
  ownedByMe?: boolean
  resourceKey?: string
  tripFolderId?: string
  tripFolderResourceKey?: string
  tripFolderName?: string
  calendarStorageMigrated?: boolean
  accessModelMigrated?: boolean
  journalMediaFolderId?: string
  journalMediaFolderResourceKey?: string
  journalPhotoFolderId?: string
  journalPhotoFolderResourceKey?: string
  journalAudioFolderId?: string
  journalAudioFolderResourceKey?: string
  journalMediaStorageMigrated?: boolean
  canonicalSchemaMigrated?: boolean
  version?: string
  headRevisionId?: string
  canReadRevisions?: boolean
  canDownload?: boolean
  canEdit?: boolean
  canShare?: boolean
  canAddChildren?: boolean
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

export type DrivePublicationAudience = SyncPublicationAudience

export interface DrivePublishedTrip {
  tripId: string
  audience: DrivePublicationAudience
  fileId: string
  resourceKey?: string
  modifiedTime?: string
  publishedAt: string
}

export type DriveJournalMediaKind='photo'|'audio'

export type DrivePublicationReaderTarget =
  | {kind:'trip';publication:DrivePublishedTrip;namedMedia?:{record:DriveSyncRecord;kinds:DriveJournalMediaKind[]}}
  | {kind:'calendar';tripId:string;fileId:string;resourceKey?:string}

export interface DriveSuspendedMediaReaders {
  kind: DriveJournalMediaKind
  target: DriveAclTarget
  permissions: DrivePermissionSnapshot[]
}

export interface DriveSuspendedReaders {
  target: DriveAclTarget
  tripId: string
  audience: DrivePublicationAudience|'calendar'
  permissions: DrivePermissionSnapshot[]
  namedMediaKinds?: DriveJournalMediaKind[]
  namedMedia?: DriveSuspendedMediaReaders[]
}

export interface DriveShareManifestEntry {
  enabled: boolean
  policy?: SharePolicyV1
  policyHash?: string
  fileId?: string
  resourceKey?: string
  publicUrl?: string
  publishedCanonicalRevision?: string
  publishedAt?: string
  stale?: boolean
  /** A broader policy is saved but must not publish until its review action. */
  reviewRequired?: boolean
  error?: string
}

export interface DriveTripLinksManifest {
  publicTrip?: DriveShareManifestEntry
  namedTrip?: DriveShareManifestEntry
  publicCalendar?: DriveShareManifestEntry
}

export interface LinksManifestV1 {
  schemaVersion: 1
  updatedAt: string
  trips: Record<string,DriveTripLinksManifest>
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
  ownedByMe?: boolean
  canEdit?: boolean
  canShare?: boolean
  canAddChildren?: boolean
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
let googlePickerPromise: Promise<void> | null = null

const tripExport = (source:Trip):CanonicalTripExportV2 => {const trip=migrateLegacyJournalEntries(source);return createTripExportV2({...trip,items:sortTripItems(trip.items)},new Date().toISOString())}
const resourceKeyHeaders = (fileId:string,resourceKey?:string):Record<string,string> => resourceKey?{'X-Goog-Drive-Resource-Keys':`${fileId}/${resourceKey}`}:{ }
type DriveFileCapabilities = {canReadRevisions?:boolean;canDownload?:boolean;canEdit?:boolean;canShare?:boolean;canAddChildren?:boolean}
type DriveFileCheckpoint = {version?:string;modifiedTime?:string;headRevisionId?:string;capabilities?:DriveFileCapabilities}
type DriveFileDetails = DriveFileCheckpoint&{id:string;name:string;resourceKey?:string;ownedByMe?:boolean;parents?:string[];bootstrapRevisionId?:string;waypointKind?:string;tripId?:string;audience?:string;legacyShared?:boolean}
const synchronizedRecord = <T extends DriveSyncRecord>(record:T,details:DriveFileCheckpoint):T => ({...record,version:details.version||record.version,headRevisionId:details.headRevisionId||record.headRevisionId,canReadRevisions:details.capabilities?.canReadRevisions??record.canReadRevisions,canDownload:details.capabilities?.canDownload??record.canDownload,canEdit:details.capabilities?.canEdit??record.canEdit,canShare:details.capabilities?.canShare??record.canShare,canAddChildren:details.capabilities?.canAddChildren??record.canAddChildren,driveModifiedTime:details.modifiedTime||record.driveModifiedTime,lastSynchronizedAt:new Date().toISOString()})

function loadGoogleIdentity() {
  if(window.google?.accounts?.oauth2)return Promise.resolve()
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

export function disconnectGoogleDrive() {
  accessToken=''
  accessTokenExpiresAt=0
  try{sessionStorage.removeItem(TOKEN_STORAGE_KEY)}catch{/* Ignore unavailable storage. */}
}

export function googleDriveSession():ProviderSession {
  return {provider:'google-drive',connected:isGoogleDriveConnected(),expiresAt:accessTokenExpiresAt||undefined}
}

export const googleDriveProvider:SyncProvider<DriveSyncRecord,DrivePublishedTrip,DriveAclTarget,DrivePermissionSnapshot>={
  id:'google-drive',
  label:'Google Drive',
  scope:DRIVE_SCOPE,
  session:googleDriveSession,
  connect:connectGoogleDrive,
  disconnect:disconnectGoogleDrive,
  createTrip:createDriveTrip,
  syncTrip:updateDriveTrip,
  publishTrip:publishDriveTripProjection,
  setPublicTripEnabled:setDrivePublicTripEnabled,
  addNamedViewer:grantDriveNamedViewer,
  addCollaborator:grantDriveCollaborator,
  revokePermission:revokeDriveTargetPermission,
}

export async function listDriveTrips():Promise<DriveTripSummary[]> {
  const query=new URLSearchParams({
    q:"appProperties has { key='waypoint' and value='trip' } and trashed=false",
    spaces:'drive',
    pageSize:'1000',
    fields:'files(id,name,modifiedTime,resourceKey,ownedByMe,capabilities(canEdit,canShare,canAddChildren),appProperties)',
  })
  type ListedDriveFile={id:string;name:string;modifiedTime?:string;resourceKey?:string;ownedByMe?:boolean;capabilities?:DriveFileCapabilities;appProperties?:{tripId?:string;travelStart?:string;travelEnd?:string;archived?:string;shared?:string;hasCalendar?:string}}
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:ListedDriveFile[]}
  const trips=(result.files||[]).map(file=>({id:file.id,name:file.name.replace(/\.waypoint\.json$/i,''),modifiedTime:file.modifiedTime,travelStart:file.appProperties?.travelStart,travelEnd:file.appProperties?.travelEnd,archived:file.appProperties?.archived==='true',shared:file.appProperties?.shared==='true',hasCalendar:file.appProperties?.hasCalendar==='true',resourceKey:file.resourceKey,tripId:file.appProperties?.tripId,ownedByMe:file.ownedByMe,canEdit:file.capabilities?.canEdit,canShare:file.capabilities?.canShare,canAddChildren:file.capabilities?.canAddChildren}))
  await Promise.all(trips.filter(trip=>!trip.travelStart||!trip.travelEnd).map(async trip=>{
    try{
      const data=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(trip.id)}?alt=media`,{headers:resourceKeyHeaders(trip.id,trip.resourceKey)}).then(response=>readDriveTripExport(response,'The Google Drive trip summary'))
      if(data.trip?.items){trip.travelStart=tripFirstTravelDate(data.trip);trip.travelEnd=tripLastTravelDate(data.trip)}
    }catch{/* Leave unreadable or undated trips in the undated group. */}
  }))
  return trips.sort((left,right)=>compareTripDateSummaries(left,right))
}

export async function connectGoogleDrive(clientId:string) {
  if(!clientId)throw new Error('Google Drive is not configured for this deployment.')
  await loadGoogleIdentity()
  return new Promise<void>((resolve,reject)=>{
    const client=window.google!.accounts!.oauth2.initTokenClient({
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
  if(response.status===401){disconnectGoogleDrive();throw new DriveRequestError('Google Drive access expired. Reconnect to continue syncing.',response.status,'authError')}
  if(!response.ok){
    const detail=await response.json().catch(()=>null) as {error?:{message?:string;status?:string;errors?:Array<{reason?:string}>}}|null
    const reason=detail?.error?.errors?.find(error=>error.reason)?.reason||detail?.error?.status
    if(reason==='appNotAuthorizedToFile')throw new DriveRequestError('Waypoint needs you to open this newly shared file with the app before it can be loaded.',response.status,reason)
    if(response.status===403||response.status===429)throw new DriveRequestError(detail?.error?.message||'Google Drive temporarily refused the sync. Your changes remain saved on this device.',response.status,reason)
    throw new DriveRequestError(detail?.error?.message||`Google Drive request failed (${response.status}).`,response.status,reason)
  }
  return response
}

export function isDriveAppNotAuthorizedError(error:unknown):error is DriveRequestError {
  return error instanceof DriveRequestError&&error.reason==='appNotAuthorizedToFile'
}

async function readBoundedJson<T>(response:Response,maxBytes:number,label:string):Promise<T> {
  const contentLength=Number(response.headers.get('Content-Length')||0)
  if(contentLength>maxBytes)throw new Error(`${label} is too large to load safely.`)
  const text=await response.text()
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error(`${label} is too large to load safely.`)
  try{return JSON.parse(text) as T}catch{throw new Error(`${label} does not contain valid JSON.`)}
}

async function readDriveTripExport(response:Response,label='The Google Drive trip'):Promise<TripExport> {
  const value=await readBoundedJson<unknown>(response,5_000_000,label)
  if(!validTripExport(value))throw new Error(`${label} is not a supported Waypoint trip.`)
  return value
}

export async function loadPublicDriveJson<T=unknown>(fileId:string,resourceKey?:string,apiKey=import.meta.env.VITE_GOOGLE_API_KEY,validator?:(value:unknown)=>value is T):Promise<T> {
  if(!fileId)throw new Error('The public trip link is missing its Google Drive file ID.')
  if(!apiKey)throw new Error('Anonymous live-trip loading is not configured for this deployment.')
  const query=new URLSearchParams({alt:'media',key:apiKey})
  const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)})
  if(!response.ok){
    const detail=await response.json().catch(()=>null) as {error?:{message?:string;errors?:Array<{reason?:string}>}}|null
    const reason=detail?.error?.errors?.find(error=>error.reason)?.reason
    throw new DriveRequestError(detail?.error?.message||'This public trip is unavailable or is no longer shared.',response.status,reason)
  }
  const value=await readBoundedJson<T>(response,5_000_000,'The public trip')
  if(validator&&!validator(value))throw new Error('The public file is not a supported Waypoint trip projection.')
  return value
}

export const loadPublicDriveTripProjection=(fileId:string,resourceKey?:string,apiKey?:string)=>loadPublicDriveJson<ShareProjectionV1>(fileId,resourceKey,apiKey,isShareProjectionV1)

export async function loadDriveTripProjection(fileId:string,resourceKey?:string):Promise<ShareProjectionV1> {
  const response=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:resourceKeyHeaders(fileId,resourceKey)})
  const value=await readBoundedJson<ShareProjectionV1>(response,5_000_000,'The shared trip')
  if(!isShareProjectionV1(value))throw new Error('The shared file is not a supported Waypoint trip projection.')
  return value
}

async function loadGooglePicker() {
  if(window.google?.picker&&window.gapi)return
  if(googlePickerPromise)return googlePickerPromise
  googlePickerPromise=new Promise((resolve,reject)=>{
    const loadModule=()=>{if(!window.gapi){reject(new Error('Google Picker could not be loaded.'));return}window.gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker could not be loaded.')),timeout:15_000,ontimeout:()=>reject(new Error('Google Picker took too long to load.'))})}
    if(window.gapi){loadModule();return}
    const existing=document.querySelector<HTMLScriptElement>('script[data-waypoint-google-picker]')
    if(existing){existing.addEventListener('load',loadModule,{once:true});existing.addEventListener('error',()=>reject(new Error('Google Picker could not be loaded.')),{once:true});return}
    const script=document.createElement('script');script.src='https://apis.google.com/js/api.js';script.async=true;script.defer=true;script.dataset.waypointGooglePicker='';script.onload=loadModule;script.onerror=()=>reject(new Error('Google Picker could not be loaded.'));document.head.append(script)
  })
  return googlePickerPromise
}

export interface DrivePickerOptions {apiKey?:string;appId?:string;mimeTypes?:string}

export async function authorizeSharedDriveFileWithPicker(expectedFileId:string,options:DrivePickerOptions={}):Promise<void> {
  if(!isGoogleDriveConnected())throw new Error('Reconnect Google Drive before opening a newly shared trip.')
  const apiKey=options.apiKey||import.meta.env.VITE_GOOGLE_API_KEY,appId=options.appId||import.meta.env.VITE_GOOGLE_APP_ID
  if(!apiKey||!appId)throw new Error('Google Picker recovery is not configured for this deployment.')
  await loadGooglePicker()
  const picker=window.google?.picker
  if(!picker)throw new Error('Google Picker could not be initialized.')
  return new Promise<void>((resolve,reject)=>{
    const view=new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(options.mimeTypes||'application/json')
    new picker.PickerBuilder().addView(view).setOAuthToken(accessToken).setDeveloperKey(apiKey).setAppId(appId).setOrigin(location.origin).setCallback(data=>{
      if(data.action===picker.Action.CANCEL){reject(new Error('Google Picker was cancelled.'));return}
      if(data.action!==picker.Action.PICKED)return
      if(data.docs?.[0]?.id!==expectedFileId){reject(new Error('Choose the exact Waypoint file from the shared link.'));return}
      resolve()
    }).build().setVisible(true)
  })
}

export const authorizeDriveFileWithPicker=authorizeSharedDriveFileWithPicker

export async function loadDriveTripProjectionWithPickerFallback(fileId:string,resourceKey?:string,options:DrivePickerOptions={}) {
  try{return await loadDriveTripProjection(fileId,resourceKey)}
  catch(error){
    if(!isDriveAppNotAuthorizedError(error))throw error
    await authorizeSharedDriveFileWithPicker(fileId,options)
    return loadDriveTripProjection(fileId,resourceKey)
  }
}

/** Canonical collaborator links use the same exact-file Picker recovery as named projections. */
export async function loadDriveTripWithPickerFallback(fileId:string,resourceKey?:string,options:DrivePickerOptions={}) {
  try{return await loadDriveTrip(fileId,resourceKey)}
  catch(error){
    if(!isDriveAppNotAuthorizedError(error))throw error
    await authorizeSharedDriveFileWithPicker(fileId,options)
    return loadDriveTrip(fileId,resourceKey)
  }
}

function readSyncRecords():Record<string,DriveSyncRecord>{try{return JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)||'{}')}catch{return {}}}
export function getDriveSyncRecord(tripId:string){return readSyncRecords()[tripId]}
export function getDriveSyncRecordByFileId(fileId:string){return Object.values(readSyncRecords()).find(record=>record.fileId===fileId)}
export function saveDriveSyncRecord(record:DriveSyncRecord){const records=readSyncRecords();records[record.tripId]=record;localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(records));return record}
export function removeDriveSyncRecord(tripId:string){const records=readSyncRecords();delete records[tripId];localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(records))}

export async function trashDriveTrip(record:DriveSyncRecord) {
  await verifyDriveSyncRecordBindings(record,false)
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(targetId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(targetId,targetResourceKey)},body:JSON.stringify({trashed:true})})
}

export async function trashDriveTripPublication(publication:DrivePublishedTrip) {
  await verifyDriveTripPublication(publication)
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(publication.fileId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(publication.fileId,publication.resourceKey)},body:JSON.stringify({trashed:true})})
}

type DriveRootFolder = DriveFolder&{
  ownedByMe?:boolean
  shared?:boolean
  writersCanShare?:boolean
  appProperties?:Record<string,string>
  capabilities?:DriveFileCapabilities
  permissions?:DrivePermissionWithDetails[]
}

const privateRootFields='id,name,resourceKey,ownedByMe,shared,writersCanShare,appProperties,capabilities(canShare),permissions(id,type,role,permissionDetails(inherited,inheritedFrom,permissionType,role))'
const ownerOnlyRootPermissions=(permissions:DrivePermissionWithDetails[]|undefined)=>!!permissions?.length&&permissions.every(permission=>permission.role==='owner'&&permission.type==='user'&&!inheritedDrivePermission(permission))
const isPrivateWaypointRoot=(folder:DriveRootFolder,allowUnmarked=false)=>folder.ownedByMe===true&&folder.shared===false&&folder.capabilities?.canShare===true&&ownerOnlyRootPermissions(folder.permissions)&&(folder.appProperties?.waypoint===ROOT_FOLDER_KIND||(allowUnmarked&&!folder.appProperties?.waypoint))

async function adoptPrivateWaypointRoot(folder:DriveRootFolder) {
  if(!isPrivateWaypointRoot(folder,true))return undefined
  if(folder.appProperties?.waypoint===ROOT_FOLDER_KIND&&folder.writersCanShare===false)return folder.id
  const hardened=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}?fields=${encodeURIComponent(privateRootFields)}`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(folder.id,folder.resourceKey)},body:JSON.stringify({appProperties:{waypoint:ROOT_FOLDER_KIND},writersCanShare:false})}).then(response=>response.json()) as DriveRootFolder
  if(!isPrivateWaypointRoot(hardened)||hardened.writersCanShare!==false)throw new Error('Google Drive did not preserve a private owner-only Waypoint root. No private metadata was written.')
  return hardened.id
}

async function findOrCreateFolder() {
  const escaped=FOLDER_NAME.replace(/'/g,"\\'")
  const query=new URLSearchParams({q:`mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,spaces:'drive',pageSize:'100',fields:`files(${privateRootFields})`})
  const found=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:DriveRootFolder[]}
  const candidates=found.files||[],marked=candidates.filter(folder=>folder.appProperties?.waypoint===ROOT_FOLDER_KIND),legacy=candidates.filter(folder=>!folder.appProperties?.waypoint)
  if(marked.some(folder=>!isPrivateWaypointRoot(folder,true)))throw new Error('The Waypoint root has non-owner Google Drive access. Remove all sharing from that root before Waypoint writes or synchronizes private data.')
  for(const folder of [...marked,...legacy]){const adopted=await adoptPrivateWaypointRoot(folder);if(adopted)return adopted}
  const created=await driveFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(privateRootFields)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder',appProperties:{waypoint:ROOT_FOLDER_KIND},writersCanShare:false})}).then(response=>response.json()) as DriveRootFolder
  if(!isPrivateWaypointRoot(created)||created.writersCanShare!==false)throw new Error('Google Drive did not create a private owner-only Waypoint root. No private metadata was written.')
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
  return driveFetch(`${DRIVE_API}/files?fields=id,name,resourceKey`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parentId],appProperties,writersCanShare:false})}).then(response=>response.json()) as Promise<DriveFolder>
}

async function setDriveWritersCanShareUnchecked(fileId:string,resourceKey:string|undefined,writersCanShare=false) {
  const updated=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,writersCanShare`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(fileId,resourceKey)},body:JSON.stringify({writersCanShare})}).then(response=>response.json()) as {id:string;writersCanShare?:boolean}
  if(updated.writersCanShare!==undefined&&updated.writersCanShare!==writersCanShare)throw new Error('Google Drive did not apply the requested collaborator-sharing restriction.')
  return updated
}

export async function setDriveWritersCanShare(fileId:string,resourceKey:string|undefined,writersCanShare=false) {
  await requireDriveCanShare({fileId,resourceKey})
  return setDriveWritersCanShareUnchecked(fileId,resourceKey,writersCanShare)
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

async function findOrCreatePublishedTripsFolder():Promise<DriveFolder> {
  const rootId=await findOrCreateFolder()
  let folder=await findAppFolder(rootId,'published-trips')
  if(!folder)folder=await createAppFolder(rootId,PUBLISHED_TRIPS_FOLDER_NAME,'published-trips')
  else if(folder.name!==PUBLISHED_TRIPS_FOLDER_NAME){
    folder=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}?fields=id,name,resourceKey`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(folder.id,folder.resourceKey)},body:JSON.stringify({name:PUBLISHED_TRIPS_FOLDER_NAME,writersCanShare:false})}).then(response=>response.json()) as DriveFolder
  }
  return folder
}

async function findOrCreatePublishedTripFolder(tripId:string,tripName:string):Promise<DriveFolder> {
  const parent=await findOrCreatePublishedTripsFolder()
  return await findAppFolder(parent.id,'published-trip-folder',tripId)||await createAppFolder(parent.id,driveSafeName(tripName,'Trip'),'published-trip-folder',tripId)
}

type DriveJsonFile={id:string;resourceKey?:string;modifiedTime?:string;name?:string}

async function findAppJsonFile(parentId:string,waypoint:string,tripId?:string,audience?:DrivePublicationAudience):Promise<DriveJsonFile|undefined> {
  const clauses=[`'${parentId.replace(/'/g,"\\'")}' in parents`,appPropertyQuery('waypoint',waypoint),'trashed=false']
  if(tripId)clauses.push(appPropertyQuery('tripId',tripId))
  if(audience)clauses.push(appPropertyQuery('audience',audience))
  const query=new URLSearchParams({q:clauses.join(' and '),spaces:'drive',pageSize:'10',fields:'files(id,name,resourceKey,modifiedTime)'})
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:DriveJsonFile[]}
  return result.files?.[0]
}

async function createJsonFile(parentId:string,name:string,waypoint:string,value:unknown,appProperties:Record<string,string>={}):Promise<DriveJsonFile> {
  const boundary=`waypoint-json-${crypto.randomUUID()}`
  const metadata={name,mimeType:'application/json',parents:[parentId],appProperties:{waypoint,...appProperties},writersCanShare:false}
  const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(value)}\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
  return driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey,modifiedTime,name`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as Promise<DriveJsonFile>
}

async function updateJsonFile(file:DriveJsonFile,value:unknown):Promise<DriveJsonFile> {
  await driveFetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(file.id)}?uploadType=media&fields=id`,{method:'PATCH',headers:{'Content-Type':'application/json; charset=UTF-8',...resourceKeyHeaders(file.id,file.resourceKey)},body:JSON.stringify(value)})
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?fields=id,resourceKey,modifiedTime,name,writersCanShare`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(file.id,file.resourceKey)},body:JSON.stringify({writersCanShare:false})}).then(response=>response.json()) as Promise<DriveJsonFile>
}

async function upsertRootJsonFile(name:string,waypoint:string,value:unknown):Promise<DriveJsonFile> {
  const rootId=await findOrCreateFolder(),existing=await findAppJsonFile(rootId,waypoint)
  return existing?updateJsonFile(existing,value):createJsonFile(rootId,name,waypoint,value)
}

async function loadRootJsonFile<T>(waypoint:string,validator:(value:unknown)=>value is T):Promise<T|undefined> {
  const rootId=await findOrCreateFolder(),file=await findAppJsonFile(rootId,waypoint)
  if(!file)return undefined
  const response=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`,{headers:resourceKeyHeaders(file.id,file.resourceKey)})
  const value=await readBoundedJson<unknown>(response,1_000_000,file.name||'The Waypoint settings file')
  if(!validator(value))throw new Error(`${file.name||'The Waypoint settings file'} is malformed and was not loaded.`)
  return value
}

export function isProfileV1(value:unknown):value is ProfileV1 {
  return validProfileV1(value)
}

export function isLinksManifestV1(value:unknown):value is LinksManifestV1 {
  if(!value||typeof value!=='object')return false
  const manifest=value as Partial<LinksManifestV1>
  if(manifest.schemaVersion!==1||!isIsoInstant(manifest.updatedAt)||!manifest.trips||typeof manifest.trips!=='object'||Array.isArray(manifest.trips)||Object.keys(value).some(key=>key!=='schemaVersion'&&key!=='updatedAt'&&key!=='trips'))return false
  const tripEntries=Object.entries(manifest.trips)
  if(tripEntries.length>1_000)return false
  const allowedEntryKeys=new Set(['enabled','policy','policyHash','fileId','resourceKey','publicUrl','publishedCanonicalRevision','publishedAt','stale','error'])
  const validEntry=(entry:unknown,audience:'public-trip'|'named-trip'|'public-calendar')=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))return false
    const candidate=entry as DriveShareManifestEntry
    if(typeof candidate.enabled!=='boolean'||Object.keys(candidate).some(key=>!allowedEntryKeys.has(key)))return false
    if(candidate.policy!==undefined&&(!isShareProjectionPolicy(candidate.policy,audience)))return false
    for(const field of ['policyHash','fileId','resourceKey','publicUrl','publishedCanonicalRevision','publishedAt','error'] as const){
      const fieldValue=candidate[field],max=field==='error'?2_000:field==='publicUrl'?4_000:field==='policyHash'?200:500
      if(fieldValue!==undefined&&(typeof fieldValue!=='string'||fieldValue.length>max))return false
    }
    if(candidate.publishedAt!==undefined&&!isIsoInstant(candidate.publishedAt))return false
    return candidate.stale===undefined||typeof candidate.stale==='boolean'
  }
  return tripEntries.every(([tripId,entry])=>{
    if(!tripId||tripId.length>200||!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>key!=='publicTrip'&&key!=='namedTrip'&&key!=='publicCalendar'))return false
    const links=entry as DriveTripLinksManifest
    return (links.publicTrip===undefined||validEntry(links.publicTrip,'public-trip'))&&(links.namedTrip===undefined||validEntry(links.namedTrip,'named-trip'))&&(links.publicCalendar===undefined||validEntry(links.publicCalendar,'public-calendar'))
  })
}

const isShareProjectionPolicy=(value:unknown,audience:SharePolicyV1['audience']):value is SharePolicyV1 => isSharePolicyV1(value)&&value.audience===audience

export const loadDriveProfile=()=>loadRootJsonFile('profile',isProfileV1)
export async function saveDriveProfile(profile:ProfileV1){if(!isProfileV1(profile))throw new Error('The Waypoint profile is incomplete or malformed.');await upsertRootJsonFile(PROFILE_FILE_NAME,'profile',profile);return profile}
export const loadDriveLinksManifest=()=>loadRootJsonFile('links',isLinksManifestV1)
export async function saveDriveLinksManifest(manifest:LinksManifestV1){if(!isLinksManifestV1(manifest))throw new Error('The Waypoint sharing manifest is malformed.');await upsertRootJsonFile(LINKS_FILE_NAME,'links',manifest);return manifest}

type PublicDrivePermission = {id:string;type:string;role:string}

export interface DriveAclTarget {fileId:string;resourceKey?:string}
export interface DrivePermissionWithDetails extends DrivePermissionSnapshot {permissionDetails?:Array<{inherited?:boolean;inheritedFrom?:string;permissionType?:string;role?:string}>}
const inheritedDrivePermission=(permission:DrivePermissionWithDetails)=>permission.permissionDetails?.some(detail=>detail.inherited===true)===true

export async function listDriveFilePermissions(target:DriveAclTarget) {
  const fields='permissions(id,type,role,displayName,emailAddress,photoLink,domain,allowFileDiscovery,permissionDetails(inherited,inheritedFrom,permissionType,role))'
  const permissions:DrivePermissionWithDetails[]=[]
  let pageToken:string|undefined
  do{
    const query=new URLSearchParams({pageSize:'100',fields:`nextPageToken,${fields}`})
    if(pageToken)query.set('pageToken',pageToken)
    const page=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(target.fileId)}/permissions?${query}`,{headers:resourceKeyHeaders(target.fileId,target.resourceKey)}).then(response=>response.json()) as {permissions?:DrivePermissionWithDetails[];nextPageToken?:string}
    permissions.push(...(page.permissions||[]));pageToken=page.nextPageToken
  }while(pageToken)
  return permissions.sort((a,b)=>(a.role==='owner'?-1:b.role==='owner'?1:0)||(a.displayName||a.emailAddress||a.type).localeCompare(b.displayName||b.emailAddress||b.type))
}

async function listPublicDrivePermissions(fileId:string,resourceKey?:string) {
  return (await listDriveFilePermissions({fileId,resourceKey}) as PublicDrivePermission[]).filter(permission=>permission.type==='anyone')
}

async function ensureFilePublicReadOnly(file:Pick<DriveCalendarSubscription,'fileId'|'resourceKey'>,canShareVerified=false) {
  if(!canShareVerified)await requireDriveCanShare(file)
  const permissions=await listPublicDrivePermissions(file.fileId,file.resourceKey),publicPermission=permissions[0]
  if(!publicPermission){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.fileId)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(file.fileId,file.resourceKey)},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})})
  }else if(publicPermission.role!=='reader'){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.fileId)}/permissions/${encodeURIComponent(publicPermission.id)}?fields=id,role`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(file.fileId,file.resourceKey)},body:JSON.stringify({role:'reader'})})
  }
  for(const permission of permissions.slice(1))await revokeDriveTargetPermissionUnchecked(file,permission.id)
}

async function revokeDriveTargetPermissionUnchecked(target:DriveAclTarget,permissionId:string) {
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(target.fileId)}/permissions/${encodeURIComponent(permissionId)}`,{method:'DELETE',headers:resourceKeyHeaders(target.fileId,target.resourceKey)})
}

export async function revokeDriveTargetPermission(target:DriveAclTarget,permissionId:string) {
  await requireDriveCanShare(target)
  await revokeDriveTargetPermissionUnchecked(target,permissionId)
}

export async function disablePublicDriveAccess(target:DriveAclTarget,canShareVerified=false) {
  if(!canShareVerified)await requireDriveCanShare(target)
  for(const permission of await listPublicDrivePermissions(target.fileId,target.resourceKey))await revokeDriveTargetPermissionUnchecked(target,permission.id)
}

const normalizedShareEmail=(email:string)=>email.trim().toLowerCase()

async function ensureUserPermission(target:DriveAclTarget,email:string,role:'reader'|'writer',canShareVerified=false) {
  if(!canShareVerified)await requireDriveCanShare(target)
  const normalized=normalizedShareEmail(email)
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new Error('Enter a valid email address for Google Drive sharing.')
  const permissions=await listDriveFilePermissions(target),matches=permissions.filter(permission=>permission.type==='user'&&permission.emailAddress?.toLowerCase()===normalized)
  const sufficient=matches.find(permission=>permission.role==='owner'||permission.role===role)
  if(sufficient)return sufficient
  if(role==='reader'&&matches.some(permission=>permission.role==='writer'&&inheritedDrivePermission(permission)))throw new Error('This person already inherits collaborator write access and cannot be represented as a read-only viewer on this target.')
  const direct=matches.find(permission=>!inheritedDrivePermission(permission))
  if(direct){
    return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(target.fileId)}/permissions/${encodeURIComponent(direct.id)}?fields=id,type,role,emailAddress`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(target.fileId,target.resourceKey)},body:JSON.stringify({role})}).then(response=>response.json()) as Promise<DrivePermissionSnapshot>
  }
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(target.fileId)}/permissions?sendNotificationEmail=false&fields=id,type,role,emailAddress`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(target.fileId,target.resourceKey)},body:JSON.stringify({type:'user',role,emailAddress:normalized})}).then(response=>response.json()) as Promise<DrivePermissionSnapshot>
}

export async function verifyDriveTripPublication(publication:DrivePublishedTrip) {
  const details=await getDriveFileDetails(publication.fileId,publication.resourceKey)
  if(details.waypointKind!=='published-trip'||details.tripId!==publication.tripId||details.audience!==publication.audience)throw new Error('The saved sharing manifest points to a different Google Drive object. No sharing change was made.')
  if(details.capabilities?.canShare!==true)throw new Error('Google Drive does not currently confirm permission to manage this publication. No sharing change was made.')
  return {...publication,resourceKey:details.resourceKey||publication.resourceKey,modifiedTime:details.modifiedTime}
}

async function verifyDriveBoundObject(fileId:string,resourceKey:string|undefined,tripId:string,waypointKind:string,parentId?:string) {
  const details=await getDriveFileDetails(fileId,resourceKey)
  if(details.waypointKind!==waypointKind||details.tripId!==tripId||parentId&&!details.parents?.includes(parentId))throw new Error('A cached Google Drive folder or file no longer matches this Waypoint trip. No access change was made.')
  return details
}

export async function verifyDriveSyncRecordBindings(record:DriveSyncRecord,includeMedia=false) {
  const canonical=await verifyDriveBoundObject(record.fileId,record.resourceKey,record.tripId,'trip')
  if(record.tripFolderId){await verifyDriveBoundObject(record.tripFolderId,record.tripFolderResourceKey,record.tripId,'trip-folder');if(!canonical.parents?.includes(record.tripFolderId))throw new Error('The canonical trip is no longer inside its verified Waypoint folder.')}
  if(includeMedia&&record.journalMediaFolderId){if(!record.tripFolderId)throw new Error('The cached journal-media folder has no verified trip-folder parent.');await verifyDriveBoundObject(record.journalMediaFolderId,record.journalMediaFolderResourceKey,record.tripId,'journal-media',record.tripFolderId)}
  if(includeMedia&&record.journalPhotoFolderId){if(!record.journalMediaFolderId)throw new Error('The cached photo folder has no verified journal-media parent.');await verifyDriveBoundObject(record.journalPhotoFolderId,record.journalPhotoFolderResourceKey,record.tripId,'journal-photo-folder',record.journalMediaFolderId)}
  if(includeMedia&&record.journalAudioFolderId){if(!record.journalMediaFolderId)throw new Error('The cached audio folder has no verified journal-media parent.');await verifyDriveBoundObject(record.journalAudioFolderId,record.journalAudioFolderResourceKey,record.tripId,'journal-audio-folder',record.journalMediaFolderId)}
  return record
}

export async function grantDriveNamedViewer(publication:DrivePublishedTrip,email:string,mediaTargets:DriveAclTarget[]=[]){
  publication=await verifyDriveTripPublication(publication)
  const granted=[await ensureUserPermission(publication,email,'reader',true)]
  for(const target of mediaTargets)granted.push(await ensureUserPermission(target,email,'reader'))
  return granted
}

export async function grantDriveCollaborator(record:DriveSyncRecord,email:string) {
  await verifyDriveSyncRecordBindings(record,false)
  const target={fileId:record.tripFolderId||record.fileId,resourceKey:record.tripFolderId?record.tripFolderResourceKey:record.resourceKey}
  await requireDriveCanShare(target)
  await setDriveWritersCanShareUnchecked(target.fileId,target.resourceKey,false)
  return ensureUserPermission(target,email,'writer',true)
}

export async function expandDriveAclTargets(targets:DriveAclTarget[]) {
  const expanded:DriveAclTarget[]=[],queue=[...targets],seen=new Set<string>()
  while(queue.length){const target=queue.shift()!;if(seen.has(target.fileId))continue;seen.add(target.fileId);expanded.push(target);if(expanded.length>5_000)throw new Error('The Drive access audit found too many descendants to update safely.');let pageToken:string|undefined;do{const query=new URLSearchParams({q:`'${target.fileId.replace(/'/g,"\\'")}' in parents and trashed=false`,spaces:'drive',pageSize:'1000',fields:'nextPageToken,files(id,resourceKey,mimeType)'});if(pageToken)query.set('pageToken',pageToken);const page=await driveFetch(`${DRIVE_API}/files?${query}`,{headers:resourceKeyHeaders(target.fileId,target.resourceKey)}).then(response=>response.json()) as {nextPageToken?:string;files?:Array<{id:string;resourceKey?:string;mimeType?:string}>};for(const child of page.files||[]){const childTarget={fileId:child.id,resourceKey:child.resourceKey};if(child.mimeType==='application/vnd.google-apps.folder')queue.push(childTarget);else if(!seen.has(child.id)){seen.add(child.id);expanded.push(childTarget);if(expanded.length>5_000)throw new Error('The Drive access audit found too many descendants to update safely.')}}pageToken=page.nextPageToken}while(pageToken)}
  return expanded
}

export async function removeAllNamedDriveAccess(targets:DriveAclTarget[]) {
  const removed:DrivePermissionSnapshot[]=[]
  for(const target of await expandDriveAclTargets(targets)){
    await requireDriveCanShare(target)
    for(const permission of await listDriveFilePermissions(target)){
      // These targets are canonical, named-projection, or media boundaries. Public
      // readers belong only on the separate public projection/calendar artifacts.
      if(permission.type==='anyone'){await revokeDriveTargetPermissionUnchecked(target,permission.id);removed.push(permission);continue}
      if(permission.role==='owner'||permission.type!=='user'||inheritedDrivePermission(permission))continue
      await revokeDriveTargetPermissionUnchecked(target,permission.id)
      removed.push(permission)
    }
  }
  return removed
}

export async function auditDriveTargetPermissions(targets:DriveAclTarget[]) {
  const audit:Record<string,DrivePermissionSnapshot[]>={}
  for(const target of targets)audit[target.fileId]=await listDriveFilePermissions(target)
  return audit
}

async function suspendProjectionReaders(target:DriveAclTarget,audience:DrivePublicationAudience,canShareVerified=false) {
  if(!canShareVerified)await requireDriveCanShare(target)
  const permissions=await listDriveFilePermissions(target)
  const suspended=permissions.filter(permission=>audience==='public'?permission.type==='anyone':permission.role==='reader'&&(permission.type==='user'||permission.type==='group'))
  for(const permission of permissions)if(permission.role!=='owner')await revokeDriveTargetPermissionUnchecked(target,permission.id)
  return suspended
}

async function suspendNamedMediaReaders(target:DriveAclTarget,canShareVerified=false) {
  if(!canShareVerified)await requireDriveCanShare(target)
  const permissions=await listDriveFilePermissions(target),suspended=permissions.filter(permission=>permission.role==='reader'&&(permission.type==='user'||permission.type==='group')&&!inheritedDrivePermission(permission))
  for(const permission of suspended)await revokeDriveTargetPermissionUnchecked(target,permission.id)
  return suspended
}

async function restoreProjectionReaders(target:DriveAclTarget,audience:DrivePublicationAudience,permissions:DrivePermissionSnapshot[],publicEnabled:boolean) {
  await requireDriveCanShare(target)
  if(audience==='public'){
    if(publicEnabled)await ensureFilePublicReadOnly(target,true)
    return
  }
  for(const permission of permissions){
    const body=permissionBody(permission)
    if(!body)continue
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(target.fileId)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(target.fileId,target.resourceKey)},body:JSON.stringify({...body,role:'reader'})})
  }
}

export async function suspendDrivePublicationReaders(subject:DrivePublicationReaderTarget):Promise<DriveSuspendedReaders> {
  if(subject.kind==='trip'){
    const publication=await verifyDriveTripPublication(subject.publication),target={fileId:publication.fileId,resourceKey:publication.resourceKey}
    if(subject.namedMedia&&publication.audience!=='named')throw new Error('Named media can be suspended only with the named trip projection.')
    if(subject.namedMedia?.record.tripId!==undefined&&subject.namedMedia.record.tripId!==publication.tripId)throw new Error('The named-media suspension belongs to a different Waypoint trip.')
    const kinds=[...new Set(subject.namedMedia?.kinds||[])]
    if(kinds.some(kind=>kind!=='photo'&&kind!=='audio'))throw new Error('The named-media suspension contains an unsupported media kind.')
    const mediaTargets:Array<{kind:DriveJournalMediaKind;target:DriveAclTarget}>=[]
    if(subject.namedMedia){
      await verifyDriveSyncRecordBindings(subject.namedMedia.record,true)
      for(const kind of kinds){
        const fields=mediaFolderFields(kind),fileId=subject.namedMedia.record[fields.id],resourceKey=subject.namedMedia.record[fields.resourceKey]
        if(!fileId)continue
        const mediaTarget={fileId,resourceKey}
        await requireDriveCanShare(mediaTarget)
        mediaTargets.push({kind,target:mediaTarget})
      }
    }
    const permissions=await suspendProjectionReaders(target,publication.audience,true)
    if(!subject.namedMedia)return {target,tripId:publication.tripId,audience:publication.audience,permissions}
    const namedMedia:DriveSuspendedMediaReaders[]=[]
    for(const media of mediaTargets){
      const mediaPermissions=await suspendNamedMediaReaders(media.target,true)
      namedMedia.push({...media,permissions:mediaPermissions})
    }
    return {target,tripId:publication.tripId,audience:publication.audience,permissions,namedMediaKinds:kinds,namedMedia}
  }
  const target={fileId:subject.fileId,resourceKey:subject.resourceKey},details=await requireDriveCanShare(target)
  if(details.waypointKind!=='calendar'||details.tripId!==subject.tripId)throw new Error('The saved calendar manifest points to a different Google Drive object. No sharing change was made.')
  const permissions=await suspendProjectionReaders(target,'public',true)
  return {target,tripId:subject.tripId,audience:'calendar',permissions}
}

async function restoreNamedMediaPolicy(suspended:DriveSuspendedReaders,policy:{record:DriveSyncRecord;includePhotos:boolean;includeAudio:boolean}) {
  if(suspended.audience!=='named'||policy.record.tripId!==suspended.tripId)throw new Error('The named-media restore state does not match this Drive publication.')
  const requested=new Set(suspended.namedMediaKinds||[])
  if(!requested.has('photo')||!requested.has('audio'))throw new Error('Both named media kinds must be suspended before reconciling a named-media policy.')
  await verifyDriveSyncRecordBindings(policy.record,true)
  for(const kind of ['photo','audio'] as const){
    const fields=mediaFolderFields(kind),fileId=policy.record[fields.id],resourceKey=policy.record[fields.resourceKey],prior=suspended.namedMedia?.find(item=>item.kind===kind)
    if(prior&&fileId&&prior.target.fileId!==fileId)throw new Error('A named-media folder changed during sharing reconciliation. Reader access remains suspended.')
    if(!(kind==='photo'?policy.includePhotos:policy.includeAudio)||!fileId)continue
    await restoreProjectionReaders({fileId,resourceKey},'named',suspended.permissions,false)
  }
}

const combinedSuspendedReaders=(first:DrivePermissionSnapshot[],second:DrivePermissionSnapshot[])=>{
  const result:DrivePermissionSnapshot[]=[],seen=new Set<string>()
  for(const permission of [...first,...second]){const key=permission.id||`${permission.type}:${permission.role}:${permission.emailAddress||permission.domain||''}`;if(seen.has(key))continue;seen.add(key);result.push(permission)}
  return result
}

export async function publishDriveTripProjection(tripId:string,tripName:string,audience:DrivePublicationAudience,projection:ShareProjectionV1,options:{publicEnabled?:boolean;known?:DrivePublishedTrip;suspendedReaders?:DriveSuspendedReaders;namedMediaPolicy?:{record:DriveSyncRecord;includePhotos:boolean;includeAudio:boolean}}={}):Promise<DrivePublishedTrip> {
  if(!tripId)throw new Error('A trip ID is required to publish a live trip.')
  if(!isShareProjectionV1(projection)||(audience==='public'&&projection.accessMode!=='public-viewer')||(audience==='named'&&projection.accessMode!=='named-viewer'))throw new Error('Refusing to publish an invalid or mismatched Waypoint trip projection.')
  let file:DriveJsonFile|undefined,fileCanShareVerified=false
  if(options.known){try{const verified=await verifyDriveTripPublication(options.known);file={id:verified.fileId,resourceKey:verified.resourceKey,modifiedTime:verified.modifiedTime};fileCanShareVerified=true}catch(error){if(!(error instanceof DriveRequestError&&error.status===404))throw error}}
  let folder:DriveFolder|undefined
  if(!file){folder=await findOrCreatePublishedTripFolder(tripId,tripName);file=await findAppJsonFile(folder.id,'published-trip',tripId,audience)}
  if(options.suspendedReaders&&(options.suspendedReaders.tripId!==tripId||options.suspendedReaders.audience!==audience||file&&options.suspendedReaders.target.fileId!==file.id))throw new Error('The suspended-reader token does not match this Drive publication.')
  if(options.suspendedReaders?.namedMedia?.length&&!options.namedMediaPolicy)throw new Error('A named-media policy is required to finish this suspended Drive publication.')
  if(options.namedMediaPolicy&&(!options.suspendedReaders||audience!=='named'))throw new Error('Named-media access can be reconciled only from a suspended named publication.')
  const suspended=file?combinedSuspendedReaders(options.suspendedReaders?.permissions||[],await suspendProjectionReaders({fileId:file.id,resourceKey:file.resourceKey},audience,fileCanShareVerified)):[]
  try{
    file=file?await updateJsonFile(file,projection):await createJsonFile(folder!.id,audience==='public'?'public.waypoint.json':'named.waypoint.json','published-trip',projection,{tripId,audience})
    if(options.suspendedReaders&&options.namedMediaPolicy)await restoreNamedMediaPolicy(options.suspendedReaders,options.namedMediaPolicy)
    await restoreProjectionReaders({fileId:file.id,resourceKey:file.resourceKey},audience,suspended,options.publicEnabled===true)
  }catch(error){
    // Fail closed. The request may have been a policy narrowing, so restoring
    // readers to the previous artifact could re-expose fields the owner just
    // removed. The intact artifact stays private until a later successful publish.
    throw error
  }
  return {tripId,audience,fileId:file.id,resourceKey:file.resourceKey,modifiedTime:file.modifiedTime,publishedAt:new Date().toISOString()}
}

export async function setDrivePublicTripEnabled(publication:DrivePublishedTrip,enabled:boolean) {
  publication=await verifyDriveTripPublication(publication)
  const target={fileId:publication.fileId,resourceKey:publication.resourceKey}
  if(enabled)await ensureFilePublicReadOnly(target,true)
  else await disablePublicDriveAccess(target,true)
}

export function drivePublishedTripUrl(publication:DrivePublishedTrip) {
  const url=new URL(location.href);url.search='';url.hash=new URLSearchParams({sharedTrip:publication.fileId,audience:publication.audience,...(publication.resourceKey?{resourceKey:publication.resourceKey}:{})}).toString();return url.toString()
}

export function publishedDriveTripFromLocation(){
  const params=new URLSearchParams(location.hash.replace(/^#/,'')),fileId=params.get('sharedTrip'),audience=params.get('audience')
  return fileId&&(audience==='public'||audience==='named')?{fileId,audience,resourceKey:params.get('resourceKey')||undefined}:null
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
  const file=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(subscription.fileId)}?${query}`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(subscription.fileId,subscription.resourceKey)},body:JSON.stringify({name:tripCalendarFilename(trip),appProperties:{waypoint:'calendar',tripId:trip.id},writersCanShare:false})}).then(response=>response.json()) as {id:string;resourceKey?:string;webContentLink?:string;modifiedTime?:string}
  if(!file.webContentLink)throw new Error('Google Drive did not provide a calendar subscription URL.')
  return {fileId:file.id,resourceKey:file.resourceKey||subscription.resourceKey,webContentLink:file.webContentLink,modifiedTime:file.modifiedTime}
}

function validatePublishedCalendar(calendar:string) {
  if(new TextEncoder().encode(calendar).byteLength>2_000_000||!calendar.startsWith('BEGIN:VCALENDAR')||!calendar.includes('\r\nEND:VCALENDAR'))throw new Error('Refusing to publish an invalid or oversized calendar feed.')
}

export async function publishDriveCalendarSubscription(trip:Trip,calendar:string,record?:Pick<DriveSyncRecord,'tripFolderId'>,options:{suspendedReaders?:DriveSuspendedReaders}={}):Promise<DriveCalendarSubscription> {
  validatePublishedCalendar(calendar)
  const structured=record||getDriveSyncRecord(trip.id),folder=await findOrCreatePublishedCalendarsFolder()
  let subscription=await findDriveCalendarSubscription(trip.id)
  if(options.suspendedReaders&&(options.suspendedReaders.tripId!==trip.id||options.suspendedReaders.audience!=='calendar'||subscription&&options.suspendedReaders.target.fileId!==subscription.fileId))throw new Error('The suspended-reader token does not match this Drive calendar publication.')
  if(!subscription){
    const boundary=`waypoint-calendar-${crypto.randomUUID()}`
    const metadata={name:tripCalendarFilename(trip),mimeType:'text/calendar',parents:[folder.id],appProperties:{waypoint:'calendar',tripId:trip.id},writersCanShare:false}
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/calendar; charset=UTF-8\r\n\r\n${calendar}\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
    const file=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as {id:string;resourceKey?:string}
    subscription=await calendarFileDetails(file.id,file.resourceKey)
  }else{
    await moveDriveFile(subscription.fileId,folder.id,subscription.resourceKey)
    await disablePublicDriveAccess(subscription)
    subscription=await uploadCalendarFile(subscription,trip,calendar)
  }
  await ensureFilePublicReadOnly(subscription)
  if(structured?.tripFolderId)await removeTripPublishedCalendarFolders(structured.tripFolderId,trip.id)
  return calendarFileDetails(subscription.fileId,subscription.resourceKey)
}

export async function refreshDriveCalendarSubscription(trip:Trip,calendar:string,knownSubscription?:DriveCalendarSubscription) {
  validatePublishedCalendar(calendar)
  const subscription=knownSubscription||await findDriveCalendarSubscription(trip.id)
  if(!subscription)return undefined
  const folder=await findOrCreatePublishedCalendarsFolder()
  await moveDriveFile(subscription.fileId,folder.id,subscription.resourceKey)
  await disablePublicDriveAccess(subscription)
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
  const tripFolder=await verifyDriveBoundObject(structured.tripFolderId,structured.tripFolderResourceKey,trip.id,'trip-folder')
  if(tripFolder.capabilities?.canAddChildren!==true)throw new Error('Google Drive does not currently confirm permission to add media folders to this trip.')
  const folder=await findAppFolder(structured.tripFolderId,'journal-media',trip.id)||await createAppFolder(structured.tripFolderId,JOURNAL_MEDIA_FOLDER_NAME,'journal-media',trip.id)
  structured=saveDriveSyncRecord({...structured,journalMediaFolderId:folder.id,journalMediaFolderResourceKey:folder.resourceKey})
  return {record:structured,folder}
}

type JournalMediaKind='photo'|'audio'
type UploadedJournalMedia={id:string;resourceKey?:string;name?:string;mimeType?:string;size?:string|number}
const mediaFolderFields = (kind:JournalMediaKind) => kind==='photo'
  ? {id:'journalPhotoFolderId',resourceKey:'journalPhotoFolderResourceKey',name:JOURNAL_PHOTOS_FOLDER_NAME,waypoint:'journal-photo-folder'} as const
  : {id:'journalAudioFolderId',resourceKey:'journalAudioFolderResourceKey',name:JOURNAL_AUDIO_FOLDER_NAME,waypoint:'journal-audio-folder'} as const

async function ensureJournalMediaKindFolder(record:DriveSyncRecord,trip:Trip,kind:JournalMediaKind) {
  const parent=await ensureJournalMediaFolder(record,trip),fields=mediaFolderFields(kind),cachedId=parent.record[fields.id],cachedResourceKey=parent.record[fields.resourceKey]
  if(cachedId)return {record:parent.record,folder:{id:cachedId,resourceKey:cachedResourceKey} as DriveFolder}
  const parentDetails=await verifyDriveBoundObject(parent.folder.id,parent.folder.resourceKey,trip.id,'journal-media',parent.record.tripFolderId)
  if(parentDetails.capabilities?.canAddChildren!==true)throw new Error(`Google Drive does not currently confirm permission to add the ${kind} folder.`)
  const folder=await findAppFolder(parent.folder.id,fields.waypoint,trip.id)||await createAppFolder(parent.folder.id,fields.name,fields.waypoint,trip.id)
  const structured=saveDriveSyncRecord({...parent.record,[fields.id]:folder.id,[fields.resourceKey]:folder.resourceKey})
  return {record:structured,folder}
}

async function listLegacyJournalMedia(parentId:string,kind:JournalMediaKind) {
  const clauses=[`'${parentId.replace(/'/g,"\\'")}' in parents`,appPropertyQuery('waypoint',`journal-${kind}`),'trashed=false']
  const query=new URLSearchParams({q:clauses.join(' and '),spaces:'drive',pageSize:'1000',fields:'files(id,resourceKey,parents)'})
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:Array<{id:string;resourceKey?:string}>}
  return result.files||[]
}

export async function migrateDriveJournalMediaFolders(record:DriveSyncRecord,trip:Trip) {
  await verifyDriveSyncRecordBindings(record,true)
  if(record.journalMediaStorageMigrated)return record
  let parent=await ensureJournalMediaFolder(record,trip),structured=parent.record
  if(structured.ownedByMe===true)await setDriveWritersCanShare(parent.folder.id,parent.folder.resourceKey,false)
  for(const kind of ['photo','audio'] as const){
    const destination=await ensureJournalMediaKindFolder(structured,trip,kind)
    structured=destination.record
    if(structured.ownedByMe===true)await setDriveWritersCanShare(destination.folder.id,destination.folder.resourceKey,false)
    for(const file of await listLegacyJournalMedia(parent.folder.id,kind)){
      await moveDriveFile(file.id,destination.folder.id,file.resourceKey)
      await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?fields=id,writersCanShare,appProperties`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(file.id,file.resourceKey)},body:JSON.stringify({appProperties:{waypoint:`journal-${kind}`,tripId:null,journalEntryId:null,attachmentId:null},...(structured.ownedByMe===true?{writersCanShare:false}:{})})})
    }
  }
  structured=saveDriveSyncRecord({...structured,journalMediaStorageMigrated:true})
  return structured
}

const journalMediaMetadata = (kind:JournalMediaKind,file:File,mimeType:string,parentId:string) => ({name:driveSafeName(file.name,kind),mimeType,parents:[parentId],appProperties:{waypoint:`journal-${kind}`},writersCanShare:false})
const journalMediaFromDrive = (attachmentId:string,file:File,mimeType:string,createdAt:string,uploaded:UploadedJournalMedia):JournalPhoto|JournalAudio => ({id:attachmentId,driveFileId:uploaded.id,resourceKey:uploaded.resourceKey,name:uploaded.name||file.name,mimeType:uploaded.mimeType||mimeType,size:Number(uploaded.size??file.size),createdAt})

async function uploadDriveJournalMedia(record:DriveSyncRecord,trip:Trip,entryId:string,file:File,kind:JournalMediaKind):Promise<{record:DriveSyncRecord;media:JournalPhoto|JournalAudio}> {
  if(record.tripId!==trip.id)throw new Error('The selected media upload belongs to a different Waypoint trip.')
  const canonical=await verifyDriveBoundObject(record.fileId,record.resourceKey,trip.id,'trip')
  if(canonical.capabilities?.canEdit!==true)throw new Error('Google Drive does not currently confirm edit access to this trip; media cannot be uploaded.')
  const mimeType=kind==='photo'&&file.type.startsWith('image/')?file.type:kind==='audio'?audioMimeType(file):undefined
  if(!mimeType)throw new Error(kind==='photo'?'Choose an image file to add to the journal.':'Choose an audio file to add to the journal.')
  void entryId // Entry linkage stays only in canonical JSON; Drive media metadata is deliberately de-identified.
  const {record:structured,folder}=await ensureJournalMediaKindFolder({...record,canEdit:true},trip,kind),folderDetails=await verifyDriveBoundObject(folder.id,folder.resourceKey,trip.id,mediaFolderFields(kind).waypoint,structured.journalMediaFolderId)
  if(folderDetails.capabilities?.canAddChildren!==true)throw new Error(`Google Drive does not currently confirm permission to add ${kind} files to this trip.`)
  const attachmentId=crypto.randomUUID(),createdAt=new Date().toISOString(),metadata=journalMediaMetadata(kind,file,mimeType,folder.id)
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

type DriveJournalMediaReference=Pick<JournalPhoto|JournalAudio,'driveFileId'|'resourceKey'|'mimeType'>

async function withDriveMediaPickerFallback<T>(media:DriveJournalMediaReference,loader:()=>Promise<T>,options:DrivePickerOptions={}) {
  try{return await loader()}
  catch(error){
    if(!isDriveAppNotAuthorizedError(error))throw error
    await authorizeSharedDriveFileWithPicker(media.driveFileId,{...options,mimeTypes:media.mimeType})
    return loader()
  }
}

async function loadDriveJournalMedia(media:DriveJournalMediaReference,options:DrivePickerOptions={}) {
  const loader=()=>driveFetch(`${DRIVE_API}/files/${encodeURIComponent(media.driveFileId)}?alt=media`,{headers:resourceKeyHeaders(media.driveFileId,media.resourceKey)}).then(response=>response.blob())
  return withDriveMediaPickerFallback(media,loader,options)
}

export const loadDriveJournalPhoto = (photo:DriveJournalMediaReference,options:DrivePickerOptions={}) => loadDriveJournalMedia(photo,options)
export const loadDriveJournalAudio = (audio:DriveJournalMediaReference,options:DrivePickerOptions={}) => loadDriveJournalMedia(audio,options)

export async function loadDriveJournalPhotoMetadata(photo:Pick<JournalPhoto,'driveFileId'|'resourceKey'>):Promise<DriveJournalPhotoMetadata> {
  const fields='id,name,mimeType,size,imageMediaMetadata(width,height,rotation,time,cameraMake,cameraModel,lens,exposureTime,aperture,focalLength,isoSpeed,exposureBias,location(latitude,longitude,altitude))'
  const query=new URLSearchParams({fields})
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(photo.driveFileId)}?${query}`,{headers:resourceKeyHeaders(photo.driveFileId,photo.resourceKey)}).then(response=>response.json()) as Promise<DriveJournalPhotoMetadata>
}

async function trashDriveJournalMedia(record:DriveSyncRecord,trip:Trip,media:Pick<JournalPhoto|JournalAudio,'driveFileId'|'resourceKey'>,kind:JournalMediaKind) {
  if(record.tripId!==trip.id)throw new Error('The Google Drive media link belongs to a different Waypoint trip. Nothing was moved to trash.')
  if(record.ownedByMe!==true&&record.canEdit!==true)throw new Error('This shared trip is read-only; media cannot be moved to trash.')
  const folderId=kind==='photo'?record.journalPhotoFolderId:record.journalAudioFolderId
  if(!folderId)throw new Error(`The ${kind} is not bound to a verified Waypoint ${kind} folder. Nothing was moved to trash.`)
  await verifyDriveSyncRecordBindings(record,true)
  const details=await getDriveFileDetails(media.driveFileId,media.resourceKey)
  if(details.waypointKind!==`journal-${kind}`||!details.parents?.includes(folderId))throw new Error(`The ${kind} does not belong to this trip's verified Waypoint media folder. Nothing was moved to trash.`)
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(media.driveFileId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(media.driveFileId,media.resourceKey)},body:JSON.stringify({trashed:true})})
}

export const trashDriveJournalPhoto = (record:DriveSyncRecord,trip:Trip,photo:Pick<JournalPhoto,'driveFileId'|'resourceKey'>) => trashDriveJournalMedia(record,trip,photo,'photo')
export const trashDriveJournalAudio = (record:DriveSyncRecord,trip:Trip,audio:Pick<JournalAudio,'driveFileId'|'resourceKey'>) => trashDriveJournalMedia(record,trip,audio,'audio')

const calendarSubscriptionMetadata = (subscription:DriveCalendarSubscription,linkedAt=new Date().toISOString()):CalendarSubscriptionMetadata => ({provider:'google-drive',format:'ics',mimeType:'text/calendar',access:'public-read-only',fileId:subscription.fileId,resourceKey:subscription.resourceKey,publicUrl:subscription.webContentLink,linkedAt})

export async function linkDriveCalendarSubscription(record:DriveSyncRecord,subscription:DriveCalendarSubscription) {
  const {data,details}=await loadDriveTrip(record.fileId,record.resourceKey),current=data as TripExport
  if(!current?.trip)throw new Error('The Google Drive itinerary JSON could not be linked to its calendar feed.')
  const existing=record.calendarSubscription||current.calendarSubscription,calendarSubscription=calendarSubscriptionMetadata(subscription,existing?.fileId===subscription.fileId&&existing.publicUrl===subscription.webContentLink?existing.linkedAt:undefined)
  await patchDriveTripProperties(record,current.trip,record.shared===true,true,undefined,details.capabilities?.canShare===true)
  return saveDriveSyncRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,version:details.version||record.version,calendarSubscription})
}

export async function unlinkMissingDriveCalendarSubscription(record:DriveSyncRecord) {
  const {data,details}=await loadDriveTrip(record.fileId,record.resourceKey),current=data as TripExport
  if(!current?.trip)throw new Error('The Google Drive itinerary JSON could not be unlinked from its missing calendar feed.')
  const unlinked:DriveSyncRecord={...record,ownedByMe:details.ownedByMe??record.ownedByMe,version:details.version||record.version}
  delete unlinked.calendarSubscription
  await patchDriveTripProperties(record,current.trip,record.shared===true,false,undefined,details.capabilities?.canShare===true)
  return saveDriveSyncRecord(unlinked)
}

export async function trashDriveCalendarSubscription(tripId:string) {
  const subscription=await findDriveCalendarSubscription(tripId)
  if(subscription)await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(subscription.fileId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(subscription.fileId,subscription.resourceKey)},body:JSON.stringify({trashed:true})})
}

export async function createDriveTrip(trip:Trip) {
  const folder=await findOrCreateTripFolder(trip)
  const boundary=`waypoint-${crypto.randomUUID()}`
  const metadata={name:`${driveSafeName(trip.name,'Trip')}.waypoint.json`,mimeType:'application/json',parents:[folder.id],appProperties:{waypoint:'trip',tripId:trip.id,travelStart:tripFirstTravelDate(trip),travelEnd:tripLastTravelDate(trip),archived:String(!!trip.archivedAt),shared:'false',hasCalendar:'false'},writersCanShare:false}
  const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(tripExport(trip))}\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
  const file=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey,headRevisionId`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as {id:string;resourceKey?:string;headRevisionId?:string}
  const details=await getDriveFileDetails(file.id,file.resourceKey)
  let record:DriveSyncRecord={tripId:trip.id,fileId:file.id,ownedByMe:details.ownedByMe??true,resourceKey:details.resourceKey||file.resourceKey,tripFolderId:folder.id,tripFolderResourceKey:folder.resourceKey,tripFolderName:driveSafeName(trip.name,'Trip'),calendarStorageMigrated:true,accessModelMigrated:true,canonicalSchemaMigrated:true,version:details.version,headRevisionId:details.headRevisionId,canReadRevisions:details.capabilities?.canReadRevisions,canDownload:details.capabilities?.canDownload,canEdit:details.capabilities?.canEdit,canShare:details.capabilities?.canShare,canAddChildren:details.capabilities?.canAddChildren,bootstrapRevisionId:file.headRevisionId||details.headRevisionId,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:new Date().toISOString(),driveModifiedTime:details.modifiedTime,revision:details.headRevisionId||details.version,baseTrip:trip}
  record.permissions=await listDrivePermissions(record)
  const updated=await uploadDriveExport(record,tripExport(trip),{bootstrapRevisionId:record.bootstrapRevisionId,shared:false,hasCalendar:false,canShareVerified:details.capabilities?.canShare===true})
  record=synchronizedRecord({...record,revision:updated.headRevisionId||updated.version||record.revision},updated)
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
  await requireDriveCanShare({fileId:record.fileId,resourceKey:record.resourceKey})
  await requireDriveCanShare({fileId:folder.id,resourceKey:folder.resourceKey})
  const source=await listDrivePermissions({...record,tripFolderId:undefined,tripFolderResourceKey:undefined})
  const folderRecord={...record,tripFolderId:folder.id,tripFolderResourceKey:folder.resourceKey}
  const existing=await listDrivePermissions(folderRecord),keys=new Set(existing.map(permissionKey))
  for(const permission of source){
    const namedWriter=permission.role==='writer'&&(permission.type==='user'||permission.type==='group')
    if(!namedWriter||keys.has(permissionKey(permission)))continue
    const body=permissionBody(permission)
    if(!body)continue
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(folder.id,folder.resourceKey)},body:JSON.stringify(body)})
  }
  return {source,permissions:await listDrivePermissions(folderRecord)}
}

export async function migrateLegacyDriveTripAccess(record:DriveSyncRecord) {
  await verifyDriveSyncRecordBindings(record,false)
  const target={fileId:record.tripFolderId||record.fileId,resourceKey:record.tripFolderId?record.tripFolderResourceKey:record.resourceKey}
  await requireDriveCanShare(target)
  const permissions=await listDriveFilePermissions(target)
  for(const permission of permissions){
    const preservedCollaborator=permission.role==='writer'&&(permission.type==='user'||permission.type==='group')
    if(permission.role!=='owner'&&!preservedCollaborator&&!inheritedDrivePermission(permission))await revokeDriveTargetPermissionUnchecked(target,permission.id)
  }
  if(record.tripFolderId){
    const canonical={fileId:record.fileId,resourceKey:record.resourceKey}
    await requireDriveCanShare(canonical)
    for(const permission of await listDriveFilePermissions(canonical))if(permission.role!=='owner'&&!inheritedDrivePermission(permission))await revokeDriveTargetPermissionUnchecked(canonical,permission.id)
  }
  if(record.ownedByMe===true){
    await setDriveWritersCanShareUnchecked(target.fileId,target.resourceKey,false)
    if(record.tripFolderId)await setDriveWritersCanShareUnchecked(record.fileId,record.resourceKey,false)
  }
  const remaining=await listDriveFilePermissions(target)
  return saveDriveSyncRecord({...record,accessModelMigrated:true,permissions:remaining,shared:remaining.some(permission=>permission.role!=='owner')})
}

export async function ensureDriveTripStructure(record:DriveSyncRecord,trip:Trip):Promise<DriveSyncRecord> {
  const folderName=driveSafeName(trip.name,'Trip')
  if(record.tripFolderId){
    await verifyDriveSyncRecordBindings(record,false)
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
    try{await revokeDriveTargetPermissionUnchecked({fileId:record.fileId,resourceKey:record.resourceKey},permission.id)}catch{/* Folder access is authoritative; a redundant direct permission can be cleaned up on a later migration pass. */}
  }
  await setDriveWritersCanShareUnchecked(folder.id,folder.resourceKey,false)
  await setDriveWritersCanShareUnchecked(record.fileId,record.resourceKey,false)
  return saveDriveSyncRecord({...record,tripFolderId:folder.id,tripFolderResourceKey:folder.resourceKey,tripFolderName:folderName,calendarStorageMigrated:true,permissions,shared:permissions.some(permission=>permission.role!=='owner')})
}

export async function enableDriveTripSharing(record:DriveSyncRecord):Promise<DriveSyncRecord> {
  await migrateLegacyDriveTripAccess(record)
  throw new Error('Live-trip sharing now requires a read-only published projection. The canonical trip was kept private.')
}

async function getDriveFileDetails(fileId:string,resourceKey?:string){
  const query=new URLSearchParams({fields:'id,name,parents,version,headRevisionId,modifiedTime,resourceKey,ownedByMe,appProperties,capabilities(canReadRevisions,canDownload,canEdit,canShare,canAddChildren)'})
  const file=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as DriveFileCheckpoint&{id:string;name:string;resourceKey?:string;ownedByMe?:boolean;parents?:string[];appProperties?:Record<string,string>}
  return {...file,bootstrapRevisionId:file.appProperties?.[BOOTSTRAP_REVISION_PROPERTY],waypointKind:file.appProperties?.waypoint,tripId:file.appProperties?.tripId,audience:file.appProperties?.audience,legacyShared:file.appProperties?.shared==='true'} satisfies DriveFileDetails
}

async function requireDriveCanShare(target:DriveAclTarget) {
  const details=await getDriveFileDetails(target.fileId,target.resourceKey)
  if(details.capabilities?.canShare!==true)throw new Error('Google Drive does not currently confirm permission to manage sharing for this item. No sharing change was made.')
  return details
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

type DriveTripPropertyOptions={bootstrapRevisionId?:string;shared?:boolean;hasCalendar?:boolean;canShareVerified?:boolean}

async function patchDriveTripProperties(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'>,trip:Trip,shared=false,hasCalendar=false,bootstrapRevisionId?:string,canShareVerified=false) {
  const appProperties:Record<string,string>={waypoint:'trip',tripId:trip.id,travelStart:tripFirstTravelDate(trip),travelEnd:tripLastTravelDate(trip),archived:String(!!trip.archivedAt),shared:String(shared),hasCalendar:String(hasCalendar)}
  if(bootstrapRevisionId)appProperties[BOOTSTRAP_REVISION_PROPERTY]=bootstrapRevisionId
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}?fields=id,version,headRevisionId,modifiedTime,capabilities(canReadRevisions,canDownload,canEdit,canShare,canAddChildren)`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({appProperties,...(canShareVerified?{writersCanShare:false}:{})})}).then(response=>response.json()) as Promise<DriveFileCheckpoint>
}

async function uploadDriveExport(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'>,value:CanonicalTripExportV2,options:DriveTripPropertyOptions={}){
  await driveFetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(record.fileId)}?uploadType=media&fields=id`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify(value)})
  return patchDriveTripProperties(record,value.trip,options.shared===true,options.hasCalendar===true,options.bootstrapRevisionId,options.canShareVerified===true)
}

export async function listDrivePermissions(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'tripFolderId'|'tripFolderResourceKey'>) {
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  return listDriveFilePermissions({fileId:targetId,resourceKey:targetResourceKey})
}

export async function refreshDriveAccess(record:DriveSyncRecord) {
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  const [permissions,details]=await Promise.all([listDriveFilePermissions({fileId:targetId,resourceKey:targetResourceKey}),getDriveFileDetails(targetId,targetResourceKey)])
  return saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,permissions,shared:permissions.some(permission=>permission.role!=='owner')},details))
}

export async function revokeDrivePermission(record:DriveSyncRecord,permissionId:string) {
  const permission=(record.permissions||[]).find(value=>value.id===permissionId)
  if(permission?.role==='owner')throw new Error('The file owner cannot be removed from the itinerary.')
  const targetId=record.tripFolderId||record.fileId,targetResourceKey=record.tripFolderId?record.tripFolderResourceKey:record.resourceKey
  await requireDriveCanShare({fileId:targetId,resourceKey:targetResourceKey})
  await revokeDriveTargetPermissionUnchecked({fileId:targetId,resourceKey:targetResourceKey},permissionId)
  return refreshDriveAccess(record)
}

export async function loadDriveTrip(fileId:string,resourceKey?:string) {
  const [details,data]=await Promise.all([
    getDriveFileDetails(fileId,resourceKey),
    driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>readDriveTripExport(response)),
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

export async function loadDriveTripRevision(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'canDownload'|'canEdit'>,revision:DriveRevisionSummary) {
  if(record.canEdit===false)throw new Error('This shared trip is read-only; Drive versions cannot be pinned or restored.')
  if(record.canDownload===false)throw new Error('Google Drive does not allow this account to download trip versions.')
  let kept=revision
  if(!revision.keepForever){
    kept=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/revisions/${encodeURIComponent(revision.id)}?fields=id,modifiedTime,keepForever`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({keepForever:true})}).then(response=>response.json()) as DriveRevisionSummary
  }
  const data=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/revisions/${encodeURIComponent(revision.id)}?alt=media`,{headers:resourceKeyHeaders(record.fileId,record.resourceKey)}).then(response=>readDriveTripExport(response,'The Google Drive trip revision'))
  return {data,revision:{...revision,keepForever:kept.keepForever===true}}
}

function downloadDriveTrip(fileId:string,resourceKey?:string) {
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>readDriveTripExport(response))
}

const tripReferencesJournalMedia = (trip:Trip) => trip.items.some(item=>item.type==='journal'&&((item.photos?.length||0)>0||(item.audio?.length||0)>0))

export async function updateDriveTrip(record:DriveSyncRecord,trip:Trip) {
  if(record.tripId!==trip.id)throw new Error('Sync stopped because the selected trip does not match this Google Drive file.')
  try{trip=createTripExportV2(migrateLegacyJournalEntries(trip),new Date().toISOString()).trip}catch{throw new Error('Sync stopped because the local trip is malformed or too large.')}
  const cleanupWasPending=!!record.pendingBootstrapRevisionId
  record=await retryDriveBootstrapRevisionCleanup(record)
  const cleanupCompleted=cleanupWasPending&&!record.pendingBootstrapRevisionId
  const details=await getDriveFileDetails(record.fileId,record.resourceKey)
  if(details.ownedByMe!==true&&details.capabilities?.canEdit!==true){
    // A canonical reader would receive the owner's full JSON, bypassing the
    // named-viewer projection policy. Freeze the last-known-good collaborator
    // cache instead; the owner must grant a named projection link for viewing.
    throw new DriveRequestError('Google Drive no longer confirms collaborator write access. Ask the owner for a named viewer link to receive further read-only updates.',403,'insufficientFilePermissions')
  }
  if(details.waypointKind&&details.waypointKind!=='trip')throw new Error('Sync stopped because the linked Drive file is not a Waypoint trip.')
  if(details.tripId&&details.tripId!==trip.id)throw new Error('Sync stopped because this Google Drive file belongs to a different trip.')
  let preloadedRemote:TripExport|undefined
  if(!details.waypointKind||!details.tripId){
    const candidate=await downloadDriveTrip(record.fileId,record.resourceKey) as TripExport
    if(!candidate?.trip||!Array.isArray(candidate.trip.items)||candidate.trip.id!==trip.id)throw new Error('Sync stopped because the linked Drive file could not be verified for this trip.')
    preloadedRemote=candidate
  }
  const ownerCanMigrate=(details.ownedByMe??record.ownedByMe)===true
  if(ownerCanMigrate&&record.canonicalSchemaMigrated!==true&&!preloadedRemote)preloadedRemote=await downloadDriveTrip(record.fileId,record.resourceKey) as TripExport
  // The first upgraded owner sync always audits the canonical boundary. Legacy
  // clients did not reliably persist a `shared` marker beside anyone/writer ACLs.
  if((details.ownedByMe??record.ownedByMe)===true&&record.accessModelMigrated!==true)record=await migrateLegacyDriveTripAccess({...record,ownedByMe:true})
  const discoveredCleanup=!cleanupCompleted&&!record.pendingBootstrapRevisionId&&!!details.bootstrapRevisionId&&details.bootstrapRevisionId!==details.headRevisionId
  record=withDriveBootstrapCleanupMarker(record,details)
  if(discoveredCleanup&&record.pendingBootstrapRevisionId)record=await retryDriveBootstrapRevisionCleanup(record,true)
  const structureWasMissing=!record.tripFolderId
  record=await ensureDriveTripStructure({...record,ownedByMe:details.ownedByMe??record.ownedByMe},trip)
  const structureChanged=structureWasMissing&&!!record.tripFolderId
  if(!record.tripFolderId&&record.ownedByMe===false){
    if(details.parents?.[0])record=saveDriveSyncRecord({...record,tripFolderId:details.parents[0]})
  }
  if(!record.tripFolderId&&record.ownedByMe===false){
    try{
      const current=await downloadDriveTrip(record.fileId,record.resourceKey) as TripExport,drive=current.collaboration?.drive
      if(drive?.tripFolderId)record=saveDriveSyncRecord({...record,tripFolderId:drive.tripFolderId,tripFolderResourceKey:drive.tripFolderResourceKey,journalMediaFolderId:drive.journalMediaFolderId,journalMediaFolderResourceKey:drive.journalMediaFolderResourceKey})
    }catch{/* Legacy shared files remain usable without folder-backed journal photos. */}
  }
  if(record.ownedByMe===true&&record.journalMediaStorageMigrated!==true&&(!!record.journalMediaFolderId||tripReferencesJournalMedia(trip)))record=await migrateDriveJournalMediaFolders(record,trip)
  let base:Trip|undefined
  if(record.baseTrip){try{base=createTripExportV2(migrateLegacyJournalEntries(record.baseTrip),new Date().toISOString()).trip}catch{throw new Error('Sync stopped because the stored reconciliation base is malformed or too large.')}}
  let canonicalNeedsUpgrade=ownerCanMigrate&&preloadedRemote?.schemaVersion===1
  if(ownerCanMigrate&&preloadedRemote?.schemaVersion===2&&record.canonicalSchemaMigrated!==true)record=saveDriveSyncRecord({...record,canonicalSchemaMigrated:true})
  const localChanged=!base||JSON.stringify(trip)!==JSON.stringify(base)||structureChanged||canonicalNeedsUpgrade
  if(base&&!hasIncomingDriveUpdates(record,details)){
    if(!localChanged){
      const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe},details))
      return {record:nextRecord,trip,conflicts:0,changed:false}
    }
    const updated=await uploadDriveExport(record,tripExport(trip),{shared:record.shared===true,hasCalendar:!!record.calendarSubscription,canShareVerified:details.capabilities?.canShare===true})
    const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,canonicalSchemaMigrated:true,lastSyncedUpdatedAt:trip.updatedAt,revision:updated.headRevisionId||updated.version||record.revision,baseTrip:trip},updated))
    return {record:nextRecord,trip,conflicts:0,changed:true}
  }
  const data=preloadedRemote||await downloadDriveTrip(record.fileId,record.resourceKey)
  const downloaded=data as TripExport
  if(!downloaded?.trip||!Array.isArray(downloaded.trip.items))throw new Error('The Drive file no longer contains a supported Waypoint trip.')
  canonicalNeedsUpgrade=ownerCanMigrate&&downloaded.schemaVersion===1
  const remote={...downloaded,trip:migrateLegacyJournalEntries(downloaded.trip)}
  if(remote.trip.id!==trip.id)throw new Error('Sync stopped because this Google Drive file belongs to a different trip.')
  record={...record,bootstrapRevisionId:record.bootstrapRevisionId||remote.collaboration?.drive?.bootstrapRevisionId,tripFolderId:record.tripFolderId||remote.collaboration?.drive?.tripFolderId,tripFolderResourceKey:record.tripFolderResourceKey||remote.collaboration?.drive?.tripFolderResourceKey,journalMediaFolderId:record.journalMediaFolderId||remote.collaboration?.drive?.journalMediaFolderId,journalMediaFolderResourceKey:record.journalMediaFolderResourceKey||remote.collaboration?.drive?.journalMediaFolderResourceKey}
  const mergeBase=base||remote.trip
  const hasLocalUpdates=JSON.stringify(trip)!==JSON.stringify(mergeBase)||canonicalNeedsUpgrade
  const remoteChanged=JSON.stringify(remote.trip)!==JSON.stringify(mergeBase)
  if(!hasLocalUpdates){
    const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,canonicalSchemaMigrated:downloaded.schemaVersion===2,lastSyncedUpdatedAt:remote.trip.updatedAt,revision:details.headRevisionId||details.version||remote.collaboration?.revision||record.revision,permissions:record.permissions||remote.collaboration?.drive?.permissions,calendarSubscription:record.calendarSubscription||remote.calendarSubscription,baseTrip:remote.trip},details))
    return {record:nextRecord,trip:remote.trip,conflicts:0,changed:remoteChanged}
  }
  const {trip:merged,conflicts}=remoteChanged?mergeTripVersions(mergeBase,trip,remote.trip):{trip,conflicts:0}
  const calendarSubscription=record.calendarSubscription||remote.calendarSubscription
  const updated=await uploadDriveExport(record,tripExport(merged),{shared:record.shared===true,hasCalendar:!!calendarSubscription,canShareVerified:details.capabilities?.canShare===true})
  const nextRecord=saveDriveSyncRecord(synchronizedRecord({...record,ownedByMe:details.ownedByMe??record.ownedByMe,canonicalSchemaMigrated:true,lastSyncedUpdatedAt:merged.updatedAt,revision:updated.headRevisionId||updated.version||record.revision,calendarSubscription,baseTrip:merged},updated))
  return {record:nextRecord,trip:merged,conflicts,changed:true}
}

export function driveShareUrl(record:DriveSyncRecord) {
  const url=new URL(location.href);url.hash='';url.searchParams.set('driveTrip',record.fileId);if(record.resourceKey)url.searchParams.set('resourceKey',record.resourceKey);return url.toString()
}

export function driveTripFromLocation(){const params=new URLSearchParams(location.search);const fileId=params.get('driveTrip');return fileId?{fileId,resourceKey:params.get('resourceKey')||undefined}:null}
