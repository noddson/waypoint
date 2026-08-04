import type { DriveSyncRecord } from './googleDrive'

export function ownsTripItinerary(readOnly:boolean,driveRecord?:Pick<DriveSyncRecord,'ownedByMe'>) {
  if(readOnly)return false
  return !driveRecord||driveRecord.ownedByMe===true
}
