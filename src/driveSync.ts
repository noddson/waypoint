export interface KnownDriveObjectMetadata {
  driveModifiedTime?: string
  headRevisionId?: string
  version?: string
}

export interface CurrentDriveObjectMetadata {
  modifiedTime?: string
  headRevisionId?: string
  version?: string
}

export function hasIncomingDriveUpdates(known:KnownDriveObjectMetadata,current:CurrentDriveObjectMetadata) {
  if(known.headRevisionId&&current.headRevisionId)return known.headRevisionId!==current.headRevisionId
  if(!known.driveModifiedTime)return true
  if(!current.modifiedTime)return !known.version||!current.version||known.version!==current.version
  if(current.modifiedTime!==known.driveModifiedTime)return true
  return !!known.version&&!!current.version&&known.version!==current.version
}

export function isRecentDriveSyncCheckpoint(lastSynchronizedAt:string|undefined,lastSyncedUpdatedAt:string|undefined,tripUpdatedAt:string,now=Date.now(),maxAgeMs=75_000) {
  if(lastSyncedUpdatedAt!==tripUpdatedAt)return false
  const synchronizedAt=Date.parse(lastSynchronizedAt||'')
  return !Number.isNaN(synchronizedAt)&&now>=synchronizedAt&&now-synchronizedAt<=maxAgeMs
}
