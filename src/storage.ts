import { Trip } from './types'
import { sortTripsByTravelDate } from './tripOrder'
import { createTripExportV2, migrateTripExportToV2 } from './tripImport'
const DB = 'waypoint-trips', DB_VERSION = 3, STORE = 'trips', REMOVED_VIEWER_CACHE_STORE = 'viewer-caches'

function open() { return new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(DB, DB_VERSION); r.onupgradeneeded = () => {if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});if(r.result.objectStoreNames.contains(REMOVED_VIEWER_CACHE_STORE))r.result.deleteObjectStore(REMOVED_VIEWER_CACHE_STORE)}; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) }) }
export function validatedStoredTrip(value:unknown):Trip|undefined {
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const candidate=value as Partial<Trip>,exportedAt=typeof candidate.updatedAt==='string'?candidate.updatedAt:''
  return migrateTripExportToV2({schemaVersion:1,exportedAt,trip:value})?.trip
}
export async function listTrips(): Promise<Trip[]> { const db = await open(); return new Promise((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(sortTripsByTravelDate((r.result as unknown[]).flatMap(value=>{const trip=validatedStoredTrip(value);return trip?[trip]:[]}))); r.onerror = () => reject(r.error) }) }
export async function saveTrip(trip: Trip) { const safe=createTripExportV2(trip,new Date().toISOString()).trip,db = await open(); return new Promise<void>((resolve,reject) => { const r = db.transaction(STORE,'readwrite').objectStore(STORE).put(safe); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error) }) }
export async function removeTrip(id:string) { const db = await open(); return new Promise<void>((resolve,reject) => { const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error) }) }
