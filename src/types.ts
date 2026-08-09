export const LEGACY_SCHEMA_VERSION = 1 as const
export const SCHEMA_VERSION = 2 as const
export type SupportedSchemaVersion = typeof LEGACY_SCHEMA_VERSION | typeof SCHEMA_VERSION
export type ItemType = 'flight' | 'stay' | 'car' | 'transport' | 'insurance' | 'event' | 'journal'
export type Status = 'confirmed' | 'pending' | 'planned'
export interface AuthorRef {
  profileId: string
  displayName: string
}
export interface TripItem {
  id: string; type: ItemType; title: string; provider?: string; confirmation?: string
  start: string; end?: string; timeZone: string; endTimeZone?: string; location?: string; endLocation?: string
  notes?: string; link?: string; emailLink?: string; bookedBy?: string; status: Status; quantity?: string; flightNumber?: string; durationMinutes?: number; allDay?: boolean
  relatedItemId?: string; photos?: JournalPhoto[]; audio?: JournalAudio[]; createdAt?: string; updatedAt?: string; createdBy?: AuthorRef; updatedBy?: AuthorRef
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
export interface JournalAudio {
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
  audio?: JournalAudio[]
  createdAt: string
  updatedAt: string
  createdBy?: AuthorRef
  updatedBy?: AuthorRef
  conflictOf?: string
  conflictSource?: 'local'|'drive'
}
export interface Trip { id: string; name: string; destination: string; createdAt: string; updatedAt: string; archivedAt?: string; createdBy?: AuthorRef; updatedBy?: AuthorRef; items: TripItem[]; journalEntries?: JournalEntry[] }

export interface ProfileV1 {
  schemaVersion: 1
  profileId: string
  name: string
  email?: string
  homeBase?: string
  updatedAt: string
}

export type TripAccessMode = 'owner' | 'collaborator' | 'named-viewer' | 'public-viewer' | 'snapshot'
export type ShareProjectionAccessMode = Extract<TripAccessMode,'named-viewer'|'public-viewer'|'snapshot'>
export type ShareAudience = 'public-trip' | 'named-trip' | 'public-calendar'
export type SharePolicyPreset = 'simplified' | 'full' | 'custom'
export type ShareField =
  | 'type' | 'title' | 'provider' | 'confirmation' | 'start' | 'end' | 'timeZone' | 'endTimeZone'
  | 'location' | 'endLocation' | 'notes' | 'link' | 'emailLink' | 'bookedBy' | 'status' | 'quantity'
  | 'flightNumber' | 'durationMinutes' | 'allDay' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'

export interface SharePolicyV1 {
  version: 1
  audience: ShareAudience
  preset: SharePolicyPreset
  itemTypes: ItemType[]
  fields: ShareField[]
  includePhotos: boolean
  includeAudio: boolean
}

export type ShareSensitiveCategory = 'confirmations' | 'booking-details' | 'notes-and-journal' | 'links' | 'locations' | 'photos' | 'audio'

export interface ShareProjectionMedia {
  driveFileId: string
  resourceKey?: string
  name: string
  mimeType: string
  size: number
  createdAt: string
}

export interface ShareProjectionItem {
  type?: ItemType
  title?: string
  provider?: string
  confirmation?: string
  start?: string
  end?: string
  timeZone?: string
  endTimeZone?: string
  location?: string
  endLocation?: string
  notes?: string
  link?: string
  emailLink?: string
  bookedBy?: string
  status?: Status
  quantity?: string
  flightNumber?: string
  durationMinutes?: number
  allDay?: boolean
  createdAt?: string
  updatedAt?: string
  createdBy?: AuthorRef
  updatedBy?: AuthorRef
  photos?: ShareProjectionMedia[]
  audio?: ShareProjectionMedia[]
}

export interface ShareProjectionTrip {
  name: string
  destination?: string
  archivedAt?: string
  items: ShareProjectionItem[]
}

export interface ShareProjectionV1 {
  kind: 'waypoint-share-projection'
  schemaVersion: 1
  accessMode: ShareProjectionAccessMode
  publishedAt: string
  trip: ShareProjectionTrip
}
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
  schemaVersion: SupportedSchemaVersion
  exportedAt: string
  trip: Trip
  calendarSubscription?: CalendarSubscriptionMetadata
  collaboration?: {
    revision: string
    parentRevision?: string
    drive?: {fileId:string;resourceKey?:string;tripFolderId?:string;tripFolderResourceKey?:string;journalMediaFolderId?:string;journalMediaFolderResourceKey?:string;permissions:DrivePermissionSnapshot[];capturedAt:string;bootstrapRevisionId?:string}
  }
}
export interface CanonicalTripExportV2 {
  schemaVersion: typeof SCHEMA_VERSION
  exportedAt: string
  trip: Trip
}
export const types: ItemType[] = ['flight','stay','car','event','transport','insurance','journal']
export const typeLabels: Record<ItemType,string> = { flight:'Flight', stay:'Stay', car:'Car rental', transport:'Transport', insurance:'Insurance', event:'Event', journal:'Journal' }
export const uid = () => crypto.randomUUID()
export function scheduleTime(value:string, allDay=false) { const match=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);if(!match)return Number.MAX_SAFE_INTEGER;const [,year,month,day,hour='00',minute='00']=match;return Date.UTC(Number(year),Number(month)-1,Number(day),allDay?12:Number(hour),allDay?0:Number(minute)) }
const sameTimeTypeOrder:Record<ItemType,number>={flight:0,transport:1,car:2,event:3,stay:4,insurance:5,journal:6}
export const sortTripItems = (items:TripItem[]) => [...items].sort((a,b)=>{const time=scheduleTime(a.start,a.allDay)-scheduleTime(b.start,b.allDay);if(time)return time;if(a.type==='journal'&&a.relatedItemId===b.id)return 1;if(b.type==='journal'&&b.relatedItemId===a.id)return -1;return sameTimeTypeOrder[a.type]-sameTimeTypeOrder[b.type]||a.title.localeCompare(b.title)})
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
