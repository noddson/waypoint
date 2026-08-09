import { type AuthorRef, type ProfileV1 } from './types'

export type { ProfileV1 } from './types'
export interface ProfileDetails {name:string;email:string;homeBase:string}

export const profileStorageKey='waypoint-profile-v1'
const PROFILE_KEYS=['schemaVersion','profileId','name','email','homeBase','updatedAt'] as const
const object = (value:unknown): value is Record<string,unknown> => typeof value === 'object'&&value!==null&&!Array.isArray(value)
const string = (value:unknown,max:number):value is string => typeof value==='string'&&value.length<=max
const exactIsoTime = (value:string) => {
  try{return new Date(value).toISOString()===value}catch{return false}
}

export function validProfileV1(value:unknown):value is ProfileV1 {
  if(!object(value)||Object.keys(value).some(key=>!PROFILE_KEYS.includes(key as typeof PROFILE_KEYS[number]))||value.schemaVersion!==1)return false
  const {profileId,name,email,homeBase,updatedAt}=value
  if(!string(profileId,200)||!profileId.trim()||!string(name,300)||!name.trim()||!string(updatedAt,100)||!exactIsoTime(updatedAt))return false
  if(email!==undefined&&(!string(email,320)||email.includes('\n')||email.includes('\r')||email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return false
  if(homeBase!==undefined&&!string(homeBase,500))return false
  return true
}

export const isProfileV1 = validProfileV1

export function authorRefFromProfile(profile:ProfileV1):AuthorRef {
  if(!validProfileV1(profile))throw new Error('Waypoint profile is invalid.')
  return {profileId:profile.profileId,displayName:profile.name.trim()}
}

type ProfileStorage = Pick<Storage,'getItem'|'setItem'|'removeItem'>
const browserStorage = ():ProfileStorage|undefined => {
  try{return globalThis.localStorage}catch{return undefined}
}

export function loadLocalProfile(storage:ProfileStorage|undefined=browserStorage()) {
  if(!storage)return undefined
  try{const parsed=JSON.parse(storage.getItem(profileStorageKey)||'null');return validProfileV1(parsed)?{...parsed}:undefined}catch{return undefined}
}

export function storeLocalProfile(profile:unknown,storage:ProfileStorage|undefined=browserStorage()):ProfileV1 {
  if(!validProfileV1(profile))throw new Error('Waypoint profile is invalid.')
  if(!storage)throw new Error('Browser profile storage is unavailable.')
  storage.setItem(profileStorageKey,JSON.stringify(profile))
  return profile
}

export function removeLocalProfile(storage:ProfileStorage|undefined=browserStorage()) {
  storage?.removeItem(profileStorageKey)
}

export function saveLocalProfile(details:ProfileDetails,options:{now?:string;createId?:()=>string;storage?:ProfileStorage}={}) {
  const existing=loadLocalProfile(options.storage),now=options.now||new Date().toISOString(),createId=options.createId||(()=>crypto.randomUUID())
  const profile:ProfileV1={
    schemaVersion:1,
    profileId:existing?.profileId||createId(),
    name:details.name.trim(),
    email:details.email.trim(),
    homeBase:details.homeBase.trim(),
    updatedAt:now,
  }
  storeLocalProfile(profile,options.storage)
  return profile
}

export function selectNewestProfile(local:unknown,remote?:unknown) {
  const validLocal=validProfileV1(local)?local:undefined,validRemote=validProfileV1(remote)?remote:undefined
  if(!validLocal)return validRemote?{...validRemote}:undefined
  if(!validRemote)return {...validLocal}
  return {...(Date.parse(validRemote.updatedAt)>Date.parse(validLocal.updatedAt)?validRemote:validLocal)}
}

export const reconcileProfileCopies = (local:unknown,remote:unknown) => selectNewestProfile(local,remote)||null

export function stampCreatedBy<T extends object>(value:T,profile?:ProfileV1):T&{createdBy?:AuthorRef;updatedBy?:AuthorRef} {
  if(!profile)return {...value}
  const author=authorRefFromProfile(profile)
  return {...value,createdBy:author,updatedBy:{...author}}
}

export function stampUpdatedBy<T extends object>(value:T,profile?:ProfileV1):T&{updatedBy?:AuthorRef} {
  return profile?{...value,updatedBy:authorRefFromProfile(profile)}:{...value}
}
