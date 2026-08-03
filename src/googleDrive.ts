import { DrivePermissionSnapshot, SCHEMA_VERSION, Trip, TripExport, sortTripItems } from './types'
import { mergeTripVersions } from './tripMerge'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'Waypoint travel planner'
const SYNC_STORAGE_KEY = 'waypoint-drive-sync'
const TOKEN_STORAGE_KEY = 'waypoint-drive-session'

type TokenResponse = {access_token?:string;expires_in?:number;error?:string;error_description?:string}
type TokenClient = {requestAccessToken:(options?:{prompt?:string})=>void}
type GoogleIdentity = {accounts:{oauth2:{initTokenClient:(options:{client_id:string;scope:string;callback:(response:TokenResponse)=>void;error_callback?:(error:unknown)=>void})=>TokenClient}}}

declare global { interface Window { google?:GoogleIdentity } }

export interface DriveSyncRecord {
  tripId: string
  fileId: string
  resourceKey?: string
  version?: string
  lastSyncedUpdatedAt: string
  shared?: boolean
  revision?: string
  baseTrip?: Trip
  permissions?: DrivePermissionSnapshot[]
}

export interface DriveTripSummary {
  id: string
  name: string
  modifiedTime?: string
  resourceKey?: string
  tripId?: string
}

const storedToken=(()=>{try{return JSON.parse(sessionStorage.getItem(TOKEN_STORAGE_KEY)||'{}') as {accessToken?:string;expiresAt?:number}}catch{return {}}})()
let accessToken = storedToken.accessToken||''
let accessTokenExpiresAt = storedToken.expiresAt||0
let googleScriptPromise: Promise<void> | null = null

const driveMetadata = (record:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'permissions'>) => ({fileId:record.fileId,resourceKey:record.resourceKey,permissions:record.permissions||[],capturedAt:new Date().toISOString()})
const tripExport = (trip:Trip,revision=crypto.randomUUID(),parentRevision?:string,record?:Pick<DriveSyncRecord,'fileId'|'resourceKey'|'permissions'>):TripExport => ({schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),trip:{...trip,items:sortTripItems(trip.items)},collaboration:{revision,parentRevision,drive:record?driveMetadata(record):undefined}})
const resourceKeyHeaders = (fileId:string,resourceKey?:string):Record<string,string> => resourceKey?{'X-Goog-Drive-Resource-Keys':`${fileId}/${resourceKey}`}:{ }

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
    pageSize:'100',
    orderBy:'modifiedTime desc',
    fields:'files(id,name,modifiedTime,resourceKey,appProperties)',
  })
  const result=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:Array<{id:string;name:string;modifiedTime?:string;resourceKey?:string;appProperties?:{tripId?:string}}>}
  return (result.files||[]).map(file=>({id:file.id,name:file.name.replace(/\.waypoint\.json$/i,''),modifiedTime:file.modifiedTime,resourceKey:file.resourceKey,tripId:file.appProperties?.tripId}))
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
  if(response.status===401){accessToken='';accessTokenExpiresAt=0;try{sessionStorage.removeItem(TOKEN_STORAGE_KEY)}catch{/* Ignore unavailable storage. */}throw new Error('Google Drive access expired. Reconnect to continue syncing.')}
  if(response.status===403||response.status===429)throw new Error('Google Drive temporarily refused the sync. Your changes remain saved on this device.')
  if(!response.ok){const detail=await response.json().catch(()=>null) as {error?:{message?:string}}|null;throw new Error(detail?.error?.message||`Google Drive request failed (${response.status}).`)}
  return response
}

function readSyncRecords():Record<string,DriveSyncRecord>{try{return JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)||'{}')}catch{return {}}}
export function getDriveSyncRecord(tripId:string){return readSyncRecords()[tripId]}
export function getDriveSyncRecordByFileId(fileId:string){return Object.values(readSyncRecords()).find(record=>record.fileId===fileId)}
export function saveDriveSyncRecord(record:DriveSyncRecord){const records=readSyncRecords();records[record.tripId]=record;localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(records));return record}
export function removeDriveSyncRecord(tripId:string){const records=readSyncRecords();delete records[tripId];localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(records))}

async function findOrCreateFolder() {
  const escaped=FOLDER_NAME.replace(/'/g,"\\'")
  const query=new URLSearchParams({q:`mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,spaces:'drive',pageSize:'10',fields:'files(id,name)'})
  const found=await driveFetch(`${DRIVE_API}/files?${query}`).then(response=>response.json()) as {files?:{id:string}[]}
  if(found.files?.[0])return found.files[0].id
  const created=await driveFetch(`${DRIVE_API}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})}).then(response=>response.json()) as {id:string}
  return created.id
}

export async function createDriveTrip(trip:Trip) {
  const folderId=await findOrCreateFolder()
  const revision=crypto.randomUUID()
  const boundary=`waypoint-${crypto.randomUUID()}`
  const metadata={name:`${trip.name.replace(/[\\/:*?"<>|]+/g,'-')||'Trip'}.waypoint.json`,mimeType:'application/json',parents:[folderId],appProperties:{waypoint:'trip',tripId:trip.id}}
  const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(tripExport(trip,revision))}\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`})
  const file=await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,resourceKey`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body}).then(response=>response.json()) as {id:string;resourceKey?:string}
  const details=await getDriveFileDetails(file.id,file.resourceKey)
  let record:DriveSyncRecord={tripId:trip.id,fileId:file.id,resourceKey:details.resourceKey||file.resourceKey,version:details.version,lastSyncedUpdatedAt:trip.updatedAt,revision,baseTrip:trip}
  record.permissions=await listDrivePermissions(record)
  const updated=await uploadDriveExport(record,tripExport(trip,revision,undefined,record))
  record={...record,version:updated.version||details.version}
  return saveDriveSyncRecord(record)
}

export async function enableDriveTripSharing(record:DriveSyncRecord) {
  const existing=record.permissions||await listDrivePermissions(record)
  if(!existing.some(permission=>permission.type==='anyone'&&permission.role==='writer')){
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/permissions?sendNotificationEmail=false`,{method:'POST',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify({type:'anyone',role:'writer',allowFileDiscovery:false})})
  }
  return refreshDriveAccess(record)
}

async function getDriveFileDetails(fileId:string,resourceKey?:string){
  const query=new URLSearchParams({fields:'id,name,version,modifiedTime,resourceKey'})
  return driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()) as Promise<{id:string;name:string;version?:string;modifiedTime?:string;resourceKey?:string}>
}

async function uploadDriveExport(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'>,value:TripExport){
  return driveFetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(record.fileId)}?uploadType=media&fields=id,version,modifiedTime`,{method:'PATCH',headers:{'Content-Type':'application/json',...resourceKeyHeaders(record.fileId,record.resourceKey)},body:JSON.stringify(value)}).then(response=>response.json()) as Promise<{version?:string}>
}

export async function listDrivePermissions(record:Pick<DriveSyncRecord,'fileId'|'resourceKey'>) {
  const fields='permissions(id,type,role,displayName,emailAddress,photoLink,domain,allowFileDiscovery)'
  const query=new URLSearchParams({fields})
  const result=await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/permissions?${query}`,{headers:resourceKeyHeaders(record.fileId,record.resourceKey)}).then(response=>response.json()) as {permissions?:DrivePermissionSnapshot[]}
  return (result.permissions||[]).sort((a,b)=>(a.role==='owner'?-1:b.role==='owner'?1:0)||(a.displayName||a.emailAddress||a.type).localeCompare(b.displayName||b.emailAddress||b.type))
}

async function persistDriveAccessMetadata(record:DriveSyncRecord) {
  const {data}=await loadDriveTrip(record.fileId,record.resourceKey)
  const current=data as TripExport
  if(!current?.trip||!current.collaboration?.revision)return record
  const value:TripExport={...current,exportedAt:new Date().toISOString(),collaboration:{...current.collaboration,drive:driveMetadata(record)}}
  const updated=await uploadDriveExport(record,value)
  return {...record,version:updated.version||record.version}
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
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(record.fileId)}/permissions/${encodeURIComponent(permissionId)}`,{method:'DELETE',headers:resourceKeyHeaders(record.fileId,record.resourceKey)})
  return refreshDriveAccess(record)
}

export async function loadDriveTrip(fileId:string,resourceKey?:string) {
  const [details,data]=await Promise.all([
    getDriveFileDetails(fileId,resourceKey),
    driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:resourceKeyHeaders(fileId,resourceKey)}).then(response=>response.json()),
  ])
  return {details,data}
}

export async function updateDriveTrip(record:DriveSyncRecord,trip:Trip) {
  if(record.tripId!==trip.id)throw new Error('Sync stopped because the selected trip does not match this Google Drive file.')
  const {details,data}=await loadDriveTrip(record.fileId,record.resourceKey)
  const remote=data as TripExport
  if(!remote?.trip||!Array.isArray(remote.trip.items))throw new Error('The Drive file no longer contains a supported Waypoint trip.')
  if(remote.trip.id!==trip.id)throw new Error('Sync stopped because this Google Drive file belongs to a different trip.')
  const base=record.baseTrip||remote.trip
  const localChanged=JSON.stringify(trip)!==JSON.stringify(base)
  const remoteChanged=JSON.stringify(remote.trip)!==JSON.stringify(base)
  if(!localChanged){
    const nextRecord=saveDriveSyncRecord({...record,version:details.version,lastSyncedUpdatedAt:remote.trip.updatedAt,revision:remote.collaboration?.revision||record.revision,permissions:record.permissions||remote.collaboration?.drive?.permissions,baseTrip:remote.trip})
    return {record:nextRecord,trip:remote.trip,conflicts:0,changed:remoteChanged}
  }
  const {trip:merged,conflicts}=mergeTripVersions(base,trip,remote.trip)
  const revision=crypto.randomUUID()
  const parentRevision=remote.collaboration?.revision||record.revision
  const updated=await uploadDriveExport(record,tripExport(merged,revision,parentRevision,record))
  const nextRecord=saveDriveSyncRecord({...record,version:updated.version||details.version,lastSyncedUpdatedAt:merged.updatedAt,revision,baseTrip:merged})
  return {record:nextRecord,trip:merged,conflicts,changed:true}
}

export function driveShareUrl(record:DriveSyncRecord) {
  const url=new URL(location.href);url.hash='';url.searchParams.set('driveTrip',record.fileId);if(record.resourceKey)url.searchParams.set('resourceKey',record.resourceKey);return url.toString()
}

export function driveTripFromLocation(){const params=new URLSearchParams(location.search);const fileId=params.get('driveTrip');return fileId?{fileId,resourceKey:params.get('resourceKey')||undefined}:null}
