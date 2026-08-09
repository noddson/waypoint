import type { TripListTab } from './tripList'

export const SAVED_SHARE_SCHEMA_VERSION = 1 as const
export const savedSharesStorageKey = 'waypoint-saved-shares-v1'

export type SavedShareProvider = 'google-drive'
export type SavedShareAccessMode = 'public-viewer'|'named-viewer'|'collaborator'

export interface SavedShareDescriptorV1 {
  schemaVersion: typeof SAVED_SHARE_SCHEMA_VERSION
  provider: SavedShareProvider
  fileId: string
  resourceKey?: string
  accessMode: SavedShareAccessMode
  tripId: string
  tripName: string
  savedAt: string
  lastSavedAt: string
  lastPublishedAt?: string
  archivedAt?: string
}

export interface SaveSavedShareInput {
  provider: SavedShareProvider
  fileId: string
  resourceKey?: string
  accessMode: SavedShareAccessMode
  tripId: string
  tripName: string
  lastPublishedAt?: string
  archivedAt?: string
}

const requiredKeys = ['schemaVersion','provider','fileId','accessMode','tripId','tripName','savedAt','lastSavedAt'] as const
const optionalKeys = ['resourceKey','lastPublishedAt','archivedAt'] as const
const allowedKeys = new Set<string>([...requiredKeys,...optionalKeys])
const accessModes:SavedShareAccessMode[]=['public-viewer','named-viewer','collaborator']
const object = (value:unknown):value is Record<string,unknown> => typeof value === 'object'&&value!==null&&!Array.isArray(value)
const trimmedString = (value:unknown,max:number,allowEmpty=false):value is string => typeof value === 'string'&&value.length<=max&&value===value.trim()&&(allowEmpty||value.length>0)
const optionalTrimmedString = (value:unknown,max:number) => value===undefined||trimmedString(value,max)
const validTimestamp = (value:unknown):value is string => {
  if(typeof value!=='string'||value.length>40)return false
  const match=value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/)
  if(!match)return false
  const normalized=`${match[1]}.${(match[2]||'').padEnd(3,'0')}Z`,parsed=new Date(value)
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString()===normalized
}
const optionalTimestamp = (value:unknown) => value===undefined||validTimestamp(value)
export function validSavedShareDescriptorV1(value:unknown):value is SavedShareDescriptorV1 {
  if(!object(value)||!requiredKeys.every(key=>Object.prototype.hasOwnProperty.call(value,key))||!Object.keys(value).every(key=>allowedKeys.has(key)))return false
  return value.schemaVersion===SAVED_SHARE_SCHEMA_VERSION
    &&value.provider==='google-drive'
    &&trimmedString(value.fileId,500)
    &&optionalTrimmedString(value.resourceKey,500)
    &&accessModes.includes(value.accessMode as SavedShareAccessMode)
    &&trimmedString(value.tripId,200)
    &&trimmedString(value.tripName,300)
    &&validTimestamp(value.savedAt)
    &&validTimestamp(value.lastSavedAt)
    &&Date.parse(value.lastSavedAt)>=Date.parse(value.savedAt)
    &&optionalTimestamp(value.lastPublishedAt)
    &&optionalTimestamp(value.archivedAt)
}

const cloneDescriptor = (share:SavedShareDescriptorV1):SavedShareDescriptorV1 => ({...share})

export function savedShareSourceKey(provider:SavedShareProvider,fileId:string) {
  return `${provider}:${fileId}`
}

const validSavedShares = (value:unknown):SavedShareDescriptorV1[] => {
  if(!Array.isArray(value)||value.length>1000)return []
  const deduplicated=new Map<string,SavedShareDescriptorV1>()
  for(const candidate of value){
    if(!validSavedShareDescriptorV1(candidate))continue
    const key=savedShareSourceKey(candidate.provider,candidate.fileId),current=deduplicated.get(key)
    if(!current||candidate.lastSavedAt>current.lastSavedAt)deduplicated.set(key,cloneDescriptor(candidate))
  }
  return [...deduplicated.values()].sort((left,right)=>right.lastSavedAt.localeCompare(left.lastSavedAt)||left.tripName.localeCompare(right.tripName))
}

export function listSavedShares():SavedShareDescriptorV1[] {
  try{
    const stored=localStorage.getItem(savedSharesStorageKey)
    return stored===null?[]:validSavedShares(JSON.parse(stored))
  }catch{return []}
}

const writeSavedShares = (shares:SavedShareDescriptorV1[]) => {
  try{localStorage.setItem(savedSharesStorageKey,JSON.stringify(shares))}
  catch{/* Existing in-memory trip state remains usable when browser storage is unavailable. */}
}

export function saveSavedShare(input:SaveSavedShareInput,now=new Date().toISOString()):SavedShareDescriptorV1 {
  const normalized={
    ...input,
    fileId:input.fileId.trim(),
    resourceKey:input.resourceKey?.trim()||undefined,
    tripId:input.tripId.trim(),
    tripName:input.tripName.trim(),
  }
  const shares=listSavedShares(),key=savedShareSourceKey(normalized.provider,normalized.fileId)
  const current=shares.find(share=>savedShareSourceKey(share.provider,share.fileId)===key)
  const resourceKey=normalized.resourceKey??current?.resourceKey
  const lastPublishedAt=normalized.lastPublishedAt??current?.lastPublishedAt
  const descriptor:SavedShareDescriptorV1={
    schemaVersion:SAVED_SHARE_SCHEMA_VERSION,
    provider:normalized.provider,
    fileId:normalized.fileId,
    ...(resourceKey?{resourceKey}:{}),
    accessMode:normalized.accessMode,
    tripId:normalized.tripId,
    tripName:normalized.tripName,
    savedAt:current?.savedAt??now,
    lastSavedAt:now,
    ...(lastPublishedAt?{lastPublishedAt}:{}),
    ...(normalized.archivedAt?{archivedAt:normalized.archivedAt}:{}),
  }
  if(!validSavedShareDescriptorV1(descriptor))throw new Error('The shared-trip descriptor is invalid.')
  writeSavedShares([descriptor,...shares.filter(share=>savedShareSourceKey(share.provider,share.fileId)!==key)])
  return cloneDescriptor(descriptor)
}

export function removeSavedShare(provider:SavedShareProvider,fileId:string):boolean {
  const shares=listSavedShares(),key=savedShareSourceKey(provider,fileId.trim())
  const remaining=shares.filter(share=>savedShareSourceKey(share.provider,share.fileId)!==key)
  if(remaining.length===shares.length)return false
  writeSavedShares(remaining)
  return true
}

export function savedShareForSource(provider:SavedShareProvider,fileId:string):SavedShareDescriptorV1|undefined {
  return listSavedShares().find(share=>savedShareSourceKey(share.provider,share.fileId)===savedShareSourceKey(provider,fileId.trim()))
}

export type SavedShareListCategory = 'shared-with-me'|'archived'

export function savedShareListCategory(share:Pick<SavedShareDescriptorV1,'archivedAt'>):SavedShareListCategory {
  return share.archivedAt?'archived':'shared-with-me'
}

export function savedSharesForTripListTab(shares:SavedShareDescriptorV1[],tab:TripListTab):SavedShareDescriptorV1[] {
  if(tab!=='shared-with-me'&&tab!=='archived')return []
  return shares.filter(share=>savedShareListCategory(share)===tab)
}

export function isSavedSharedTrip(tripId:string,shares:SavedShareDescriptorV1[]=listSavedShares()):boolean {
  return shares.some(share=>share.tripId===tripId)
}
