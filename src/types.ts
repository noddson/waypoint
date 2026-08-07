export const SCHEMA_VERSION = 1 as const
export type ItemType = 'flight' | 'stay' | 'car' | 'transport' | 'insurance' | 'event'
export type Status = 'confirmed' | 'pending' | 'planned'
export interface TripItem {
  id: string; type: ItemType; title: string; provider?: string; confirmation?: string
  start: string; end?: string; timeZone: string; endTimeZone?: string; location?: string; endLocation?: string
  notes?: string; link?: string; emailLink?: string; bookedBy?: string; status: Status; quantity?: string; flightNumber?: string; durationMinutes?: number; allDay?: boolean
  conflictOf?: string; conflictSource?: 'local'|'drive'
}
export interface JournalPhoto {
  id: string
  driveFileId: string
  resourceKey?: string
  name: string
  mimeType: string
  size: number
  createdAt: string
}
export interface JournalEntry {
  id: string
  date: string
  text?: string
  relatedItemId?: string
  photos: JournalPhoto[]
  createdAt: string
  updatedAt: string
  conflictOf?: string
  conflictSource?: 'local'|'drive'
}
export interface Trip { id: string; name: string; destination: string; createdAt: string; updatedAt: string; archivedAt?: string; items: TripItem[]; journalEntries?: JournalEntry[] }
export interface DrivePermissionSnapshot {
  id: string
  type: 'user'|'group'|'domain'|'anyone'|string
  role: string
  displayName?: string
  emailAddress?: string
  photoLink?: string
  domain?: string
  allowFileDiscovery?: boolean
}
export interface CalendarSubscriptionMetadata {
  provider: 'google-drive'
  format: 'ics'
  mimeType: 'text/calendar'
  access: 'public-read-only'
  fileId: string
  resourceKey?: string
  publicUrl: string
  linkedAt: string
}
export interface TripExport {
  schemaVersion: typeof SCHEMA_VERSION
  exportedAt: string
  trip: Trip
  calendarSubscription?: CalendarSubscriptionMetadata
  collaboration?: {
    revision: string
    parentRevision?: string
    drive?: {fileId:string;resourceKey?:string;tripFolderId?:string;tripFolderResourceKey?:string;journalMediaFolderId?:string;journalMediaFolderResourceKey?:string;permissions:DrivePermissionSnapshot[];capturedAt:string;bootstrapRevisionId?:string}
  }
}
export const types: ItemType[] = ['flight','stay','car','event','transport','insurance']
export const typeLabels: Record<ItemType,string> = { flight:'Flight', stay:'Stay', car:'Car rental', transport:'Transport', insurance:'Insurance', event:'Event' }
export const uid = () => crypto.randomUUID()
export function scheduleTime(value:string, allDay=false) { const match=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);if(!match)return Number.MAX_SAFE_INTEGER;const [,year,month,day,hour='00',minute='00']=match;return Date.UTC(Number(year),Number(month)-1,Number(day),allDay?12:Number(hour),allDay?0:Number(minute)) }
const sameTimeTypeOrder:Record<ItemType,number>={flight:0,transport:1,car:2,event:3,stay:4,insurance:5}
export const sortTripItems = (items:TripItem[]) => [...items].sort((a,b)=>scheduleTime(a.start,a.allDay)-scheduleTime(b.start,b.allDay)||sameTimeTypeOrder[a.type]-sameTimeTypeOrder[b.type]||a.title.localeCompare(b.title))
export function overlappingEventIds(items:TripItem[]) {
  const events=sortTripItems(items.filter(item=>item.type==='event'))
  const overlaps=new Set<string>()
  for(const [index,event] of events.entries()){
    if(!event.end)continue
    for(const other of events.slice(index+1)){
      if(event.timeZone===other.timeZone&&scheduleTime(event.end)>scheduleTime(other.start)){overlaps.add(event.id);overlaps.add(other.id)}
    }
  }
  return overlaps
}
