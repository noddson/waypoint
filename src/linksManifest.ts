import type { DriveShareManifestEntry, DriveTripLinksManifest, LinksManifestV1 } from './googleDrive'
import { isSharePolicyV1 } from './sharePolicy'
import { isIsoInstant, serializedUtf8SizeAtMost } from './schemaValidation'

export const linksManifestStorageKey='waypoint-links-manifest-v1'

const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value)
const string=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max
const optionalString=(value:unknown,max:number)=>value===undefined||string(value,max)

export function validDriveShareManifestEntry(value:unknown):value is DriveShareManifestEntry {
  if(!object(value)||typeof value.enabled!=='boolean')return false
  const allowed=['enabled','policy','policyHash','fileId','resourceKey','publicUrl','publishedCanonicalRevision','publishedAt','stale','error','reviewRequired']
  if(Object.keys(value).some(key=>!allowed.includes(key)))return false
  return (value.policy===undefined||isSharePolicyV1(value.policy))&&optionalString(value.policyHash,200)&&optionalString(value.fileId,500)&&optionalString(value.resourceKey,500)&&optionalString(value.publicUrl,4_000)&&optionalString(value.publishedCanonicalRevision,500)&&(value.publishedAt===undefined||isIsoInstant(value.publishedAt))&&(value.stale===undefined||typeof value.stale==='boolean')&&(value.reviewRequired===undefined||typeof value.reviewRequired==='boolean')&&optionalString(value.error,2_000)
}

export function validLinksManifestV1(value:unknown):value is LinksManifestV1 {
  if(!object(value)||!serializedUtf8SizeAtMost(value,1_000_000)||value.schemaVersion!==1||!isIsoInstant(value.updatedAt)||!object(value.trips)||Object.keys(value.trips).length>2_000)return false
  return Object.entries(value.trips).every(([tripId,raw])=>string(tripId,200)&&tripId.length>0&&object(raw)&&Object.keys(raw).every(key=>['publicTrip','namedTrip','publicCalendar'].includes(key))&&Object.values(raw).every(entry=>entry===undefined||validDriveShareManifestEntry(entry)))
}

export function loadLocalLinksManifest():LinksManifestV1|undefined {
  try{const value:unknown=JSON.parse(localStorage.getItem(linksManifestStorageKey)||'null');return validLinksManifestV1(value)?structuredClone(value):undefined}catch{return undefined}
}

export function saveLocalLinksManifest(value:LinksManifestV1):LinksManifestV1 {
  if(!validLinksManifestV1(value))throw new Error('The Waypoint sharing manifest is malformed.')
  try{localStorage.setItem(linksManifestStorageKey,JSON.stringify(value))}catch{/* Keep the in-memory copy when storage is unavailable. */}
  return structuredClone(value)
}

export function updateTripLinksManifest(manifest:LinksManifestV1|undefined,tripId:string,patch:Partial<DriveTripLinksManifest>,updatedAt=new Date().toISOString()):LinksManifestV1 {
  const next:LinksManifestV1={schemaVersion:1,updatedAt,trips:{...(manifest?.trips||{}),[tripId]:{...(manifest?.trips[tripId]||{}),...patch}}}
  return saveLocalLinksManifest(next)
}
