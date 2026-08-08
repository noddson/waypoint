import { JournalEntry, Trip, TripItem } from './types'

const legacyTitle = (entry:JournalEntry) => {
  const firstLine=entry.text?.split(/\r?\n/).map(line=>line.trim()).find(Boolean)
  if(firstLine)return firstLine.length>80?`${firstLine.slice(0,77)}…`:firstLine
  return entry.photos[0]?.name||entry.audio?.[0]?.name||'Journal entry'
}

const legacyJournalItem = (entry:JournalEntry,items:TripItem[]):TripItem => {
  const related=items.find(item=>item.id===entry.relatedItemId&&item.type!=='journal')
  return {
    id:entry.id,
    type:'journal',
    title:legacyTitle(entry),
    start:related?.start||`${entry.date}T12:00`,
    end:related?.end,
    timeZone:related?.timeZone||'UTC',
    location:related?.location,
    notes:entry.text,
    relatedItemId:related?.id,
    photos:entry.photos,
    audio:entry.audio,
    status:'planned',
    createdAt:entry.createdAt,
    updatedAt:entry.updatedAt,
    conflictOf:entry.conflictOf,
    conflictSource:entry.conflictSource,
  }
}

export function migrateLegacyJournalEntries(trip:Trip):Trip {
  if(!trip.journalEntries)return trip
  const existingIds=new Set(trip.items.map(item=>item.id))
  const migrated=trip.journalEntries.filter(entry=>!existingIds.has(entry.id)).map(entry=>legacyJournalItem(entry,trip.items))
  const {journalEntries:_legacy,...current}=trip
  return {...current,items:[...trip.items,...migrated]}
}

export function copyRelatedDetailsToJournal(item:TripItem,related?:TripItem):TripItem {
  if(!related||related.type==='journal')return {...item,relatedItemId:undefined}
  return {
    ...item,
    relatedItemId:related.id,
    start:related.start,
    end:related.end,
    timeZone:related.timeZone,
    location:related.location,
    allDay:related.allDay,
  }
}

export function journalSnapshotForSave(item:TripItem):TripItem {
  const snapshot:TripItem={...item,title:item.title.trim()}
  if(item.notes!==undefined)snapshot.notes=item.notes.trim()||undefined
  if(item.photos!==undefined)snapshot.photos=[...item.photos]
  if(item.audio!==undefined)snapshot.audio=[...item.audio]
  return snapshot
}
