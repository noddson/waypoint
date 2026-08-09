import { JournalAudio, JournalEntry, JournalPhoto, Trip, TripItem } from './types'

type DriveJournalMedia = JournalPhoto | JournalAudio

const sameDriveReference = (candidate:DriveJournalMedia,existing:DriveJournalMedia) =>
  candidate.driveFileId===existing.driveFileId&&candidate.resourceKey===existing.resourceKey

function retainKnownMedia<T extends DriveJournalMedia>(candidate:T[]|undefined,existing:T[]|undefined) {
  if(candidate===undefined)return undefined
  const known=existing||[],retained:T[]=[]
  for(const reference of candidate){
    const match=known.find(value=>sameDriveReference(reference,value))
    if(match&&!retained.some(value=>sameDriveReference(value,match)))retained.push({...match})
  }
  return retained
}

/**
 * A copied or imported trip has no authority over Drive files referenced by the
 * source trip. Keep journal text, but detach every Drive-backed media reference.
 */
export function stripDriveJournalMediaFromTripCopy(trip:Trip):Trip {
  const items=trip.items.map(item=>{
    if(item.type!=='journal')return item
    const {photos:_photos,audio:_audio,...withoutMedia}=item
    return withoutMedia
  })
  const journalEntries=trip.journalEntries?.map((entry:JournalEntry)=>({
    ...entry,
    photos:[],
    ...(entry.audio!==undefined?{audio:[]}:{}),
  }))
  return {
    ...trip,
    items,
    ...(journalEntries!==undefined?{journalEntries}:{}),
  }
}

/**
 * JSON editing may replace local attachment IDs, so Drive file ID + resource
 * key is the stable identity. Return the existing canonical metadata rather
 * than trusting any attachment metadata supplied by the edited JSON.
 */
export function retainExistingDriveJournalMedia(candidate:TripItem,existing?:TripItem):TripItem {
  if(candidate.type!=='journal')return candidate
  const current=existing?.type==='journal'?existing:undefined
  const photos=retainKnownMedia(candidate.photos,current?.photos)
  const audio=retainKnownMedia(candidate.audio,current?.audio)
  return {
    ...candidate,
    ...(photos!==undefined?{photos}:{}),
    ...(audio!==undefined?{audio}:{}),
  }
}
