import { AuthorRef, CanonicalTripExportV2, ItemType, JournalAudio, JournalEntry, JournalPhoto, LEGACY_SCHEMA_VERSION, SCHEMA_VERSION, Status, Trip, TripExport, TripItem, types } from './types'
import { isCalendarDate, isIanaTimeZone, isIsoInstant, isLocalDateTime, serializedUtf8SizeAtMost } from './schemaValidation'

const statuses:Status[] = ['confirmed','pending','planned']
const object = (value:unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value:unknown,max=12_000): value is string => typeof value === 'string' && value.length <= max
const optionalString = (value:unknown,max?:number) => value === undefined || string(value,max)
const exactKeys = (value:Record<string,unknown>,allowed:readonly string[]) => Object.keys(value).every(key=>allowed.includes(key))
const ENVELOPE_KEYS=['schemaVersion','exportedAt','trip'] as const
const TRIP_KEYS=['id','name','destination','createdAt','updatedAt','archivedAt','createdBy','updatedBy','items','journalEntries'] as const
const ITEM_KEYS=['id','type','title','provider','confirmation','start','end','timeZone','endTimeZone','location','endLocation','notes','link','emailLink','bookedBy','status','quantity','flightNumber','durationMinutes','allDay','relatedItemId','photos','audio','createdAt','updatedAt','createdBy','updatedBy','conflictOf','conflictSource'] as const
const JOURNAL_ENTRY_KEYS=['id','date','text','relatedItemId','photos','audio','createdAt','updatedAt','createdBy','updatedBy','conflictOf','conflictSource'] as const
const ATTACHMENT_KEYS=['id','driveFileId','resourceKey','name','mimeType','size','createdAt'] as const
const validAuthorRef = (value:unknown): value is AuthorRef => object(value)&&string(value.profileId,200)&&value.profileId.length>0&&string(value.displayName,300)&&value.displayName.length>0&&Object.keys(value).every(key=>key==='profileId'||key==='displayName')
const validJournalAttachment = (value:unknown,ids:Set<string>,mimePrefix:'image/'|'audio/',strictKeys:boolean) => {
  if(!object(value)||strictKeys&&!exactKeys(value,ATTACHMENT_KEYS)||!string(value.id,200)||!value.id.trim()||ids.has(value.id)||!string(value.driveFileId,500)||!value.driveFileId.trim()||!optionalString(value.resourceKey,500)||!string(value.name,1_000)||!string(value.mimeType,200)||!value.mimeType.startsWith(mimePrefix)||!Number.isInteger(value.size)||Number(value.size)<0||!isIsoInstant(value.createdAt))return false
  ids.add(value.id)
  return true
}

export const safeHttpsLink = (value?:string) => {
  if(!value)return undefined
  try{const url=new URL(value);return url.protocol==='https:'?url.toString():undefined}catch{return undefined}
}

export const tripNameWithoutImportedSuffix = (value:string) => value.replace(/\s+\(imported\)$/,'')

export function validTripExport(value:unknown): value is TripExport {
  if(!object(value)||(value.schemaVersion!==LEGACY_SCHEMA_VERSION&&value.schemaVersion!==SCHEMA_VERSION)||!serializedUtf8SizeAtMost(value,5_000_000)||!isIsoInstant(value.exportedAt)||!object(value.trip))return false
  const strictKeys=value.schemaVersion===SCHEMA_VERSION
  if(strictKeys&&!exactKeys(value,ENVELOPE_KEYS))return false
  if(value.calendarSubscription!==undefined){
    const calendar=value.calendarSubscription
    if(!object(calendar)||calendar.provider!=='google-drive'||calendar.format!=='ics'||calendar.mimeType!=='text/calendar'||calendar.access!=='public-read-only'||!string(calendar.fileId,500)||!calendar.fileId.trim()||!optionalString(calendar.resourceKey,500)||!string(calendar.publicUrl,4_000)||!safeHttpsLink(calendar.publicUrl)||!isIsoInstant(calendar.linkedAt))return false
  }
  const trip=value.trip
  if(strictKeys&&!exactKeys(trip,TRIP_KEYS)||!string(trip.id,200)||!trip.id.trim()||!string(trip.name,300)||!trip.name.trim()||!string(trip.destination,500)||!isIsoInstant(trip.createdAt)||!isIsoInstant(trip.updatedAt)||trip.archivedAt!==undefined&&!isIsoInstant(trip.archivedAt)||!Array.isArray(trip.items)||trip.items.length>5000)return false
  if(trip.createdBy!==undefined&&!validAuthorRef(trip.createdBy)||trip.updatedBy!==undefined&&!validAuthorRef(trip.updatedBy))return false
  const ids=new Set<string>(),attachmentIds=new Set<string>()
  const validItems=trip.items.every(raw=>{
    if(!object(raw)||strictKeys&&!exactKeys(raw,ITEM_KEYS)||!string(raw.id,200)||!raw.id.trim()||ids.has(raw.id)||!types.includes(raw.type as ItemType)||!string(raw.title,500)||!raw.title.trim()||!isLocalDateTime(raw.start)||!isIanaTimeZone(raw.timeZone)||!statuses.includes(raw.status as Status))return false
    ids.add(raw.id)
    const safeOptionalStrings=['provider','confirmation','end','endTimeZone','location','endLocation','notes','bookedBy','quantity','flightNumber','relatedItemId','createdAt','updatedAt','conflictOf']
    if(!safeOptionalStrings.every(key=>optionalString(raw[key],key==='notes'?12_000:2_000)))return false
    if(raw.end!==undefined&&!isLocalDateTime(raw.end)||raw.endTimeZone!==undefined&&!isIanaTimeZone(raw.endTimeZone)||raw.createdAt!==undefined&&!isIsoInstant(raw.createdAt)||raw.updatedAt!==undefined&&!isIsoInstant(raw.updatedAt))return false
    if(raw.link!==undefined&&(!string(raw.link,4_000)||!safeHttpsLink(raw.link)))return false
    if(raw.emailLink!==undefined&&(!string(raw.emailLink,4_000)||!safeHttpsLink(raw.emailLink)))return false
    if(raw.allDay!==undefined&&typeof raw.allDay!=='boolean')return false
    if(raw.durationMinutes!==undefined&&(!Number.isInteger(raw.durationMinutes)||Number(raw.durationMinutes)<0))return false
    if(raw.conflictSource!==undefined&&raw.conflictSource!=='local'&&raw.conflictSource!=='drive')return false
    if(raw.createdBy!==undefined&&!validAuthorRef(raw.createdBy)||raw.updatedBy!==undefined&&!validAuthorRef(raw.updatedBy))return false
    for(const field of ['photos','audio'] as const){
      if(raw[field]!==undefined){
        if(raw.type!=='journal'||!Array.isArray(raw[field])||raw[field].length>500)return false
        for(const attachment of raw[field])if(!validJournalAttachment(attachment,attachmentIds,field==='photos'?'image/':'audio/',strictKeys))return false
      }
    }
    return true
  })
  if(!validItems)return false
  if(trip.journalEntries===undefined)return true
  if(!Array.isArray(trip.journalEntries)||trip.journalEntries.length>5000)return false
  const entryIds=new Set<string>()
  return trip.journalEntries.every(raw=>{
    if(!object(raw)||strictKeys&&!exactKeys(raw,JOURNAL_ENTRY_KEYS)||!string(raw.id,200)||!raw.id.trim()||entryIds.has(raw.id)||!isCalendarDate(raw.date)||!optionalString(raw.text,50_000)||!optionalString(raw.relatedItemId,200)||!isIsoInstant(raw.createdAt)||!isIsoInstant(raw.updatedAt)||!Array.isArray(raw.photos)||raw.photos.length>500||raw.audio!==undefined&&(!Array.isArray(raw.audio)||raw.audio.length>500))return false
    entryIds.add(raw.id)
    if((!raw.text||!raw.text.trim())&&raw.photos.length===0&&(!Array.isArray(raw.audio)||raw.audio.length===0))return false
    if(!optionalString(raw.conflictOf,2_000)||raw.conflictSource!==undefined&&raw.conflictSource!=='local'&&raw.conflictSource!=='drive')return false
    if(raw.createdBy!==undefined&&!validAuthorRef(raw.createdBy)||raw.updatedBy!==undefined&&!validAuthorRef(raw.updatedBy))return false
    return raw.photos.every(attachment=>validJournalAttachment(attachment,attachmentIds,'image/',strictKeys))&&(!Array.isArray(raw.audio)||raw.audio.every(attachment=>validJournalAttachment(attachment,attachmentIds,'audio/',strictKeys)))
  })
}

const authorCopy = (value:AuthorRef|undefined) => value?{profileId:value.profileId,displayName:value.displayName}:undefined
const photoCopy = (value:JournalPhoto):JournalPhoto => ({id:value.id,driveFileId:value.driveFileId,...(value.resourceKey?{resourceKey:value.resourceKey}:{}),name:value.name,mimeType:value.mimeType,size:value.size,createdAt:value.createdAt})
const audioCopy = (value:JournalAudio):JournalAudio => ({id:value.id,driveFileId:value.driveFileId,...(value.resourceKey?{resourceKey:value.resourceKey}:{}),name:value.name,mimeType:value.mimeType,size:value.size,createdAt:value.createdAt})

function itemCopy(value:TripItem):TripItem {
  const item:TripItem={id:value.id,type:value.type,title:value.title,start:value.start,timeZone:value.timeZone,status:value.status}
  const strings=['provider','confirmation','end','endTimeZone','location','endLocation','notes','link','emailLink','bookedBy','quantity','flightNumber','relatedItemId','createdAt','updatedAt','conflictOf'] as const
  for(const key of strings)if(value[key]!==undefined)(item[key] as string|undefined)=value[key]
  if(value.durationMinutes!==undefined)item.durationMinutes=value.durationMinutes
  if(value.allDay!==undefined)item.allDay=value.allDay
  if(value.photos!==undefined)item.photos=value.photos.map(photoCopy)
  if(value.audio!==undefined)item.audio=value.audio.map(audioCopy)
  if(value.createdBy)item.createdBy=authorCopy(value.createdBy)
  if(value.updatedBy)item.updatedBy=authorCopy(value.updatedBy)
  if(value.conflictSource)item.conflictSource=value.conflictSource
  return item
}

function journalEntryCopy(value:JournalEntry):JournalEntry {
  return {
    id:value.id,
    date:value.date,
    ...(value.text!==undefined?{text:value.text}:{}),
    ...(value.relatedItemId!==undefined?{relatedItemId:value.relatedItemId}:{}),
    photos:value.photos.map(photoCopy),
    ...(value.audio!==undefined?{audio:value.audio.map(audioCopy)}:{}),
    createdAt:value.createdAt,
    updatedAt:value.updatedAt,
    ...(value.createdBy?{createdBy:authorCopy(value.createdBy)}:{}),
    ...(value.updatedBy?{updatedBy:authorCopy(value.updatedBy)}:{}),
    ...(value.conflictOf!==undefined?{conflictOf:value.conflictOf}:{}),
    ...(value.conflictSource!==undefined?{conflictSource:value.conflictSource}:{}),
  }
}

function canonicalTripCopy(value:Trip):Trip {
  return {
    id:value.id,
    name:value.name,
    destination:value.destination,
    createdAt:value.createdAt,
    updatedAt:value.updatedAt,
    ...(value.archivedAt!==undefined?{archivedAt:value.archivedAt}:{}),
    ...(value.createdBy?{createdBy:authorCopy(value.createdBy)}:{}),
    ...(value.updatedBy?{updatedBy:authorCopy(value.updatedBy)}:{}),
    items:value.items.map(itemCopy),
    ...(value.journalEntries!==undefined?{journalEntries:value.journalEntries.map(journalEntryCopy)}:{}),
  }
}

/** Converts either supported import envelope to the private-data-only v2 envelope. */
export function migrateTripExportToV2(value:unknown):CanonicalTripExportV2|null {
  if(!validTripExport(value))return null
  return {schemaVersion:SCHEMA_VERSION,exportedAt:value.exportedAt,trip:canonicalTripCopy(value.trip)}
}

/** Creates a v2 export while dropping runtime-only or future unknown properties. */
export function createTripExportV2(trip:Trip,exportedAt:string):CanonicalTripExportV2 {
  const value:CanonicalTripExportV2={schemaVersion:SCHEMA_VERSION,exportedAt,trip:canonicalTripCopy(trip)}
  if(!validTripExport(value))throw new Error('Cannot create an export from invalid trip data.')
  return value
}
