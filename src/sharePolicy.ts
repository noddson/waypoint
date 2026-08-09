import { migrateLegacyJournalEntries } from './journalItems'
import { isIanaTimeZone, isIsoInstant, isLocalDateTime, serializedUtf8SizeAtMost } from './schemaValidation'
import {
  type AuthorRef,
  type ItemType,
  type ShareAudience,
  type ShareField,
  type SharePolicyPreset,
  type SharePolicyV1,
  type ShareProjectionAccessMode,
  type ShareProjectionItem,
  type ShareProjectionMedia,
  type ShareProjectionV1,
  type ShareSensitiveCategory,
  type Status,
  type Trip,
  type TripItem,
  sortTripItems,
  types,
} from './types'

export const SHARE_FIELD_CATALOG = [
  'type','title','provider','confirmation','start','end','timeZone','endTimeZone','location','endLocation',
  'notes','link','emailLink','bookedBy','status','quantity','flightNumber','durationMinutes','allDay',
  'createdAt','updatedAt','createdBy','updatedBy',
] as const satisfies readonly ShareField[]

export const PUBLIC_SHARE_FIELDS = [
  'type','title','provider','start','end','timeZone','endTimeZone','location','endLocation','status','flightNumber','durationMinutes',
] as const satisfies readonly ShareField[]

export const FULL_SHARE_FIELDS = [...SHARE_FIELD_CATALOG] as const

const PUBLIC_ITEM_TYPES = ['flight','stay'] as const satisfies readonly ItemType[]
const NAMED_ITEM_TYPES = ['flight','stay','car','event'] as const satisfies readonly ItemType[]

export const DEFAULT_PUBLIC_SHARE_POLICY:SharePolicyV1 = Object.freeze({
  version:1,
  audience:'public-trip',
  preset:'simplified',
  itemTypes:[...PUBLIC_ITEM_TYPES],
  fields:[...PUBLIC_SHARE_FIELDS],
  includePhotos:false,
  includeAudio:false,
})

export const DEFAULT_NAMED_SHARE_POLICY:SharePolicyV1 = Object.freeze({
  version:1,
  audience:'named-trip',
  preset:'custom',
  itemTypes:[...NAMED_ITEM_TYPES],
  fields:[...FULL_SHARE_FIELDS],
  includePhotos:false,
  includeAudio:false,
})

export const DEFAULT_CALENDAR_SHARE_POLICY:SharePolicyV1 = Object.freeze({
  version:1,
  audience:'public-calendar',
  preset:'simplified',
  itemTypes:[...PUBLIC_ITEM_TYPES],
  fields:[...PUBLIC_SHARE_FIELDS],
  includePhotos:false,
  includeAudio:false,
})

const object = (value:unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value:unknown,max:number): value is string => typeof value === 'string' && value.length <= max
const exactKeys = (value:Record<string,unknown>,allowed:readonly string[]) => Object.keys(value).every(key=>allowed.includes(key))
const uniqueKnown = <T extends string>(value:unknown,catalog:readonly T[]): value is T[] => Array.isArray(value)&&value.length<=catalog.length&&new Set(value).size===value.length&&value.every(entry=>catalog.includes(entry as T))

const POLICY_KEYS = ['version','audience','preset','itemTypes','fields','includePhotos','includeAudio'] as const
const audiences:ShareAudience[] = ['public-trip','named-trip','public-calendar']
const presets:SharePolicyPreset[] = ['simplified','full','custom']

export function isSharePolicyV1(value:unknown): value is SharePolicyV1 {
  if(!object(value)||!exactKeys(value,POLICY_KEYS)||value.version!==1||!audiences.includes(value.audience as ShareAudience)||!presets.includes(value.preset as SharePolicyPreset))return false
  if(!uniqueKnown(value.itemTypes,types)||!uniqueKnown(value.fields,SHARE_FIELD_CATALOG)||typeof value.includePhotos!=='boolean'||typeof value.includeAudio!=='boolean')return false
  if(value.audience!=='named-trip'&&(value.includePhotos||value.includeAudio))return false
  if((value.includePhotos||value.includeAudio)&&!value.itemTypes.includes('journal'))return false
  return true
}

const defaultPolicy = (audience:ShareAudience) => audience==='named-trip'?DEFAULT_NAMED_SHARE_POLICY:audience==='public-calendar'?DEFAULT_CALENDAR_SHARE_POLICY:DEFAULT_PUBLIC_SHARE_POLICY

export function sharePolicyForPreset(audience:ShareAudience,preset:SharePolicyPreset):SharePolicyV1 {
  if(preset==='simplified')return normalizeSharePolicy({...DEFAULT_PUBLIC_SHARE_POLICY,audience})
  if(preset==='full')return normalizeSharePolicy({version:1,audience,preset,itemTypes:[...types],fields:[...FULL_SHARE_FIELDS],includePhotos:false,includeAudio:false})
  return normalizeSharePolicy({...defaultPolicy(audience),audience,preset:'custom'})
}

export function normalizeSharePolicy(policy:SharePolicyV1):SharePolicyV1 {
  if(!isSharePolicyV1(policy))throw new Error('Invalid Waypoint share policy.')
  const selectedTypes=new Set(policy.itemTypes),selectedFields=new Set(policy.fields)
  return {
    version:1,
    audience:policy.audience,
    preset:policy.preset,
    itemTypes:types.filter(type=>selectedTypes.has(type)),
    fields:SHARE_FIELD_CATALOG.filter(field=>selectedFields.has(field)),
    includePhotos:policy.includePhotos,
    includeAudio:policy.includeAudio,
  }
}

export const canonicalSharePolicyJson = (policy:SharePolicyV1) => JSON.stringify(normalizeSharePolicy(policy))

export async function sharePolicyHash(policy:SharePolicyV1) {
  const bytes=new TextEncoder().encode(canonicalSharePolicyJson(policy))
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')
}

export function sensitiveCategoriesForSharePolicy(policy:SharePolicyV1):ShareSensitiveCategory[] {
  const normalized=normalizeSharePolicy(policy),fields=new Set(normalized.fields),itemTypes=new Set(normalized.itemTypes),categories:ShareSensitiveCategory[]=[]
  if(fields.has('confirmation'))categories.push('confirmations')
  if(['bookedBy','quantity'].some(field=>fields.has(field as ShareField)))categories.push('booking-details')
  if(fields.has('notes')||(itemTypes.has('journal')&&fields.has('title')))categories.push('notes-and-journal')
  if(fields.has('link')||fields.has('emailLink'))categories.push('links')
  if(fields.has('location')||fields.has('endLocation'))categories.push('locations')
  if(normalized.includePhotos)categories.push('photos')
  if(normalized.includeAudio)categories.push('audio')
  return categories
}

const safeHttps = (value:string) => {
  try{return new URL(value).protocol==='https:'}catch{return false}
}

const validAuthorRef = (value:unknown): value is AuthorRef => {
  if(!object(value)||!exactKeys(value,['profileId','displayName']))return false
  const {profileId,displayName}=value
  return string(profileId,200)&&profileId.length>0&&string(displayName,300)&&displayName.length>0
}

const mediaProjection = (value:NonNullable<TripItem['photos']>[number]):ShareProjectionMedia => ({
  driveFileId:value.driveFileId,
  ...(value.resourceKey?{resourceKey:value.resourceKey}:{}),
  name:value.name,
  mimeType:value.mimeType,
  size:value.size,
  createdAt:value.createdAt,
})

function projectItem(item:TripItem,policy:SharePolicyV1):ShareProjectionItem {
  const projected:Record<string,unknown>={}
  for(const field of policy.fields){
    const value=item[field]
    if(value===undefined)continue
    if((field==='link'||field==='emailLink')&&typeof value==='string'&&!safeHttps(value))continue
    if(field==='createdBy'||field==='updatedBy'){
      if(validAuthorRef(value))projected[field]={profileId:value.profileId,displayName:value.displayName}
      continue
    }
    projected[field]=value
  }
  if(policy.audience==='named-trip'&&item.type==='journal'){
    if(policy.includePhotos||policy.includeAudio)projected.type='journal'
    if(policy.includePhotos)projected.photos=(item.photos||[]).map(mediaProjection)
    if(policy.includeAudio)projected.audio=(item.audio||[]).map(mediaProjection)
  }
  return projected as ShareProjectionItem
}

const defaultAccessMode = (audience:ShareAudience):ShareProjectionAccessMode => audience==='named-trip'?'named-viewer':audience==='public-trip'?'public-viewer':'snapshot'

const validPolicyAccessMode = (audience:ShareAudience,accessMode:ShareProjectionAccessMode) =>
  audience==='named-trip'?accessMode==='named-viewer':audience==='public-trip'?accessMode==='public-viewer'||accessMode==='snapshot':accessMode==='snapshot'

export function buildShareProjection(source:Trip,policyInput:SharePolicyV1,options:{publishedAt:string;accessMode?:ShareProjectionAccessMode}):ShareProjectionV1 {
  const policy=normalizeSharePolicy(policyInput),accessMode=options.accessMode||defaultAccessMode(policy.audience)
  if(!validPolicyAccessMode(policy.audience,accessMode))throw new Error('The projection access mode does not match its share policy.')
  if(!isIsoInstant(options.publishedAt))throw new Error('A valid publication time is required.')
  const trip=migrateLegacyJournalEntries(source),includedTypes=new Set(policy.itemTypes)
  const projection:ShareProjectionV1={
    kind:'waypoint-share-projection',
    schemaVersion:1,
    accessMode,
    publishedAt:options.publishedAt,
    trip:{
      name:trip.name,
      ...(policy.fields.includes('location')||policy.fields.includes('endLocation')?{destination:trip.destination}:{}),
      ...(trip.archivedAt?{archivedAt:trip.archivedAt}:{}),
      items:sortTripItems(trip.items).filter(item=>includedTypes.has(item.type)).map(item=>projectItem(item,policy)),
    },
  }
  if(!isShareProjectionV1(projection))throw new Error('The trip cannot be represented by this share policy safely.')
  return projection
}

const PROJECTION_KEYS = ['kind','schemaVersion','accessMode','publishedAt','trip'] as const
const PROJECTION_TRIP_KEYS = ['name','destination','archivedAt','items'] as const
const PROJECTION_ITEM_KEYS = [...SHARE_FIELD_CATALOG,'photos','audio'] as const
const MEDIA_KEYS = ['driveFileId','resourceKey','name','mimeType','size','createdAt'] as const
const statuses:Status[] = ['confirmed','pending','planned']
const accessModes:ShareProjectionAccessMode[] = ['named-viewer','public-viewer','snapshot']

function validProjectionMedia(value:unknown,kind:'photos'|'audio') {
  if(!object(value)||!exactKeys(value,MEDIA_KEYS))return false
  const {driveFileId,resourceKey,name,mimeType,size,createdAt}=value
  if(!string(driveFileId,500)||driveFileId.length===0||resourceKey!==undefined&&!string(resourceKey,500)||!string(name,1_000)||!string(mimeType,200)||!mimeType.startsWith(kind==='photos'?'image/':'audio/')||!Number.isInteger(size)||Number(size)<0||!isIsoInstant(createdAt))return false
  return true
}

function validProjectionItem(value:unknown,accessMode:ShareProjectionAccessMode) {
  if(!object(value)||!exactKeys(value,PROJECTION_ITEM_KEYS))return false
  if(value.type!==undefined&&!types.includes(value.type as ItemType)||value.status!==undefined&&!statuses.includes(value.status as Status))return false
  const strings:Record<string,number>={title:500,provider:2_000,confirmation:2_000,start:50,end:2_000,timeZone:100,endTimeZone:2_000,location:2_000,endLocation:2_000,notes:12_000,link:4_000,emailLink:4_000,bookedBy:2_000,quantity:2_000,flightNumber:2_000,createdAt:2_000,updatedAt:2_000}
  for(const [field,max] of Object.entries(strings))if(value[field]!==undefined&&!string(value[field],max))return false
  if(value.start!==undefined&&!isLocalDateTime(value.start)||value.end!==undefined&&!isLocalDateTime(value.end)||value.timeZone!==undefined&&!isIanaTimeZone(value.timeZone)||value.endTimeZone!==undefined&&!isIanaTimeZone(value.endTimeZone)||value.createdAt!==undefined&&!isIsoInstant(value.createdAt)||value.updatedAt!==undefined&&!isIsoInstant(value.updatedAt))return false
  if(value.link!==undefined&&!safeHttps(value.link as string)||value.emailLink!==undefined&&!safeHttps(value.emailLink as string))return false
  if(value.durationMinutes!==undefined&&(!Number.isInteger(value.durationMinutes)||Number(value.durationMinutes)<0)||value.allDay!==undefined&&typeof value.allDay!=='boolean')return false
  if(value.createdBy!==undefined&&!validAuthorRef(value.createdBy)||value.updatedBy!==undefined&&!validAuthorRef(value.updatedBy))return false
  for(const kind of ['photos','audio'] as const){
    if(value[kind]===undefined)continue
    if(accessMode!=='named-viewer'||value.type!=='journal'||!Array.isArray(value[kind])||value[kind].length>500||!value[kind].every(media=>validProjectionMedia(media,kind)))return false
  }
  return true
}

export function isShareProjectionV1(value:unknown): value is ShareProjectionV1 {
  if(!object(value)||!serializedUtf8SizeAtMost(value,5_000_000)||!exactKeys(value,PROJECTION_KEYS)||value.kind!=='waypoint-share-projection'||value.schemaVersion!==1||!accessModes.includes(value.accessMode as ShareProjectionAccessMode)||!isIsoInstant(value.publishedAt)||!object(value.trip)||!exactKeys(value.trip,PROJECTION_TRIP_KEYS))return false
  if(!string(value.trip.name,300)||value.trip.destination!==undefined&&!string(value.trip.destination,500)||value.trip.archivedAt!==undefined&&!isIsoInstant(value.trip.archivedAt)||!Array.isArray(value.trip.items)||value.trip.items.length>5000)return false
  return value.trip.items.every(item=>validProjectionItem(item,value.accessMode as ShareProjectionAccessMode))
}
