import { Trip } from './types'

const VERSION_HISTORY_STORAGE_KEY='waypoint-show-version-history'

export interface DriveRevisionLike {
  id:string
  modifiedTime?:string
}

export type NumberedDriveRevision<T extends DriveRevisionLike=DriveRevisionLike> = T & {
  number:number
  current:boolean
}

export const versionHistoryEnabledFromStorage = (value:string|null) => value==='enabled'

export function loadVersionHistoryEnabled() {
  try{return versionHistoryEnabledFromStorage(localStorage.getItem(VERSION_HISTORY_STORAGE_KEY))}
  catch{return false}
}

export function saveVersionHistoryEnabled(enabled:boolean) {
  try{localStorage.setItem(VERSION_HISTORY_STORAGE_KEY,enabled?'enabled':'disabled')}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}

export function numberDriveRevisions<T extends DriveRevisionLike>(revisions:T[],headRevisionId?:string):NumberedDriveRevision<T>[] {
  const ordered=revisions.map((revision,index)=>({revision,index})).sort((left,right)=>{
    const leftTime=Date.parse(left.revision.modifiedTime||''),rightTime=Date.parse(right.revision.modifiedTime||'')
    if(!Number.isNaN(leftTime)&&!Number.isNaN(rightTime)&&leftTime!==rightTime)return leftTime-rightTime
    if(Number.isNaN(leftTime)!==Number.isNaN(rightTime))return Number.isNaN(leftTime)?-1:1
    return left.index-right.index
  }).map(({revision})=>revision)
  const matchedHead=ordered.findIndex(revision=>revision.id===headRevisionId),currentIndex=matchedHead>=0?matchedHead:ordered.length-1
  return ordered.map((revision,index)=>({...revision,number:index+1,current:index===currentIndex}))
}

export function restoredVersionTripName(name:string,versionNumber:number,modifiedTime?:string) {
  const parsed=Date.parse(modifiedTime||''),date=Number.isNaN(parsed)?'unknown date':new Date(parsed).toISOString().slice(0,10)
  return `${name} (restored version ${versionNumber} ${date})`
}

export function restoredTripFromVersion(source:Trip,versionNumber:number,modifiedTime:string|undefined,id:string,restoredAt:string):Trip {
  const restored:Trip={...source,id,name:restoredVersionTripName(source.name,versionNumber,modifiedTime),createdAt:restoredAt,updatedAt:restoredAt,items:source.items.map(item=>({...item}))}
  delete restored.archivedAt
  return restored
}
