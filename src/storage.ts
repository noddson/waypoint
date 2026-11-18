import { SCHEMA_VERSION, Trip } from './types'
import { sortTripsByTravelDate } from './tripOrder'
import { createTripExport, migrateTripExport } from './tripImport'
const DB = 'waypoint-trips', DB_VERSION = 4, STORE = 'trips', REMOVED_VIEWER_CACHE_STORE = 'viewer-caches'

export function validatedStoredTrip(value:unknown):Trip|undefined {
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const {schemaVersion=1,...trip}=value as Partial<Trip>&{schemaVersion?:unknown}
  const exportedAt=typeof trip.updatedAt==='string'?trip.updatedAt:''
  return migrateTripExport({schemaVersion,exportedAt,trip})?.trip
}
const storedTrip = (trip:Trip) => ({...createTripExport(trip,new Date().toISOString()).trip,schemaVersion:SCHEMA_VERSION})

function open() {
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DB,DB_VERSION)
    request.onupgradeneeded=()=>{
      const db=request.result
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})
      if(db.objectStoreNames.contains(REMOVED_VIEWER_CACHE_STORE))db.deleteObjectStore(REMOVED_VIEWER_CACHE_STORE)
      const cursor=request.transaction!.objectStore(STORE).openCursor()
      cursor.onsuccess=()=>{
        const current=cursor.result
        if(!current)return
        const trip=validatedStoredTrip(current.value)
        // Preserve unreadable records for recovery rather than deleting them.
        if(trip)current.update(storedTrip(trip))
        current.continue()
      }
    }
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)}
    request.onerror=()=>reject(request.error)
  })
}
export async function listTrips():Promise<Trip[]> {
  const db=await open()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE),request=tx.objectStore(STORE).getAll()
    tx.oncomplete=()=>{db.close();resolve(sortTripsByTravelDate((request.result as unknown[]).flatMap(value=>{const trip=validatedStoredTrip(value);return trip?[trip]:[]})))}
    tx.onabort=()=>{db.close();reject(tx.error)}
  })
}
export async function saveTrip(trip:Trip) {
  const safe=storedTrip(trip),db=await open()
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(safe)
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onabort=()=>{db.close();reject(tx.error)}
  })
}
export async function removeTrip(id:string) {
  const db=await open()
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id)
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onabort=()=>{db.close();reject(tx.error)}
  })
}
