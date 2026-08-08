import { ItemType, SCHEMA_VERSION, Status, TripExport, types } from './types'

const statuses:Status[] = ['confirmed','pending','planned']
const object = (value:unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value:unknown,max=12_000): value is string => typeof value === 'string' && value.length <= max
const optionalString = (value:unknown,max?:number) => value === undefined || string(value,max)

export const safeHttpsLink = (value?:string) => {
  if(!value)return undefined
  try{const url=new URL(value);return url.protocol==='https:'?url.toString():undefined}catch{return undefined}
}

export const tripNameWithoutImportedSuffix = (value:string) => value.replace(/\s+\(imported\)$/,'')

export function validTripExport(value:unknown): value is TripExport {
  if(!object(value)||value.schemaVersion!==SCHEMA_VERSION||!string(value.exportedAt,100)||!object(value.trip))return false
  if(value.calendarSubscription!==undefined){
    const calendar=value.calendarSubscription
    if(!object(calendar)||calendar.provider!=='google-drive'||calendar.format!=='ics'||calendar.mimeType!=='text/calendar'||calendar.access!=='public-read-only'||!string(calendar.fileId,500)||!optionalString(calendar.resourceKey,500)||!string(calendar.publicUrl,4_000)||!safeHttpsLink(calendar.publicUrl)||!string(calendar.linkedAt,100))return false
  }
  const trip=value.trip
  if(!string(trip.id,200)||!string(trip.name,300)||!string(trip.destination,500)||!string(trip.createdAt,100)||!string(trip.updatedAt,100)||!optionalString(trip.archivedAt,100)||!Array.isArray(trip.items)||trip.items.length>5000)return false
  const ids=new Set<string>(),photoIds=new Set<string>()
  const validItems=trip.items.every(raw=>{
    if(!object(raw)||!string(raw.id,200)||ids.has(raw.id)||!types.includes(raw.type as ItemType)||!string(raw.title,500)||!string(raw.start,50)||!string(raw.timeZone,100)||!statuses.includes(raw.status as Status))return false
    ids.add(raw.id)
    const safeOptionalStrings=['provider','confirmation','end','endTimeZone','location','endLocation','notes','bookedBy','quantity','flightNumber','relatedItemId','createdAt','updatedAt','conflictOf']
    if(!safeOptionalStrings.every(key=>optionalString(raw[key],key==='notes'?12_000:2_000)))return false
    if(raw.link!==undefined&&(!string(raw.link,4_000)||!safeHttpsLink(raw.link)))return false
    if(raw.emailLink!==undefined&&(!string(raw.emailLink,4_000)||!safeHttpsLink(raw.emailLink)))return false
    if(raw.allDay!==undefined&&typeof raw.allDay!=='boolean')return false
    if(raw.durationMinutes!==undefined&&(!Number.isInteger(raw.durationMinutes)||Number(raw.durationMinutes)<0))return false
    if(raw.conflictSource!==undefined&&raw.conflictSource!=='local'&&raw.conflictSource!=='drive')return false
    if(raw.photos!==undefined){
      if(raw.type!=='journal'||!Array.isArray(raw.photos)||raw.photos.length>500)return false
      for(const photo of raw.photos){
        if(!object(photo)||!string(photo.id,200)||photoIds.has(photo.id)||!string(photo.driveFileId,500)||!optionalString(photo.resourceKey,500)||!string(photo.name,1_000)||!string(photo.mimeType,200)||!Number.isInteger(photo.size)||Number(photo.size)<0||!string(photo.createdAt,100))return false
        photoIds.add(photo.id)
      }
    }
    return true
  })
  if(!validItems)return false
  if(trip.journalEntries===undefined)return true
  if(!Array.isArray(trip.journalEntries)||trip.journalEntries.length>5000)return false
  const entryIds=new Set<string>()
  return trip.journalEntries.every(raw=>{
    if(!object(raw)||!string(raw.id,200)||entryIds.has(raw.id)||!string(raw.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)||!optionalString(raw.text,50_000)||!optionalString(raw.relatedItemId,200)||!string(raw.createdAt,100)||!string(raw.updatedAt,100)||!Array.isArray(raw.photos)||raw.photos.length>500)return false
    entryIds.add(raw.id)
    if((!raw.text||!raw.text.trim())&&raw.photos.length===0)return false
    if(!optionalString(raw.conflictOf,2_000)||raw.conflictSource!==undefined&&raw.conflictSource!=='local'&&raw.conflictSource!=='drive')return false
    return raw.photos.every(photo=>{
      if(!object(photo)||!string(photo.id,200)||photoIds.has(photo.id)||!string(photo.driveFileId,500)||!optionalString(photo.resourceKey,500)||!string(photo.name,1_000)||!string(photo.mimeType,200)||!Number.isInteger(photo.size)||Number(photo.size)<0||!string(photo.createdAt,100))return false
      photoIds.add(photo.id)
      return true
    })
  })
}
