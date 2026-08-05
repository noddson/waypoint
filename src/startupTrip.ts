import { Trip } from './types'
import { tripLastTravelDate } from './tripOrder'

const persistedTripStorageKey = 'waypoint-persisted-trip'

export function loadPersistedTripId():string|null {
  try{return localStorage.getItem(persistedTripStorageKey)||null}
  catch{return null}
}

export function persistTripId(tripId:string) {
  try{localStorage.setItem(persistedTripStorageKey,tripId)}
  catch{/* The startup choice remains unchanged when browser storage is unavailable. */}
}

export function clearPersistedTripId() {
  try{localStorage.removeItem(persistedTripStorageKey)}
  catch{/* The startup choice remains unchanged when browser storage is unavailable. */}
}

const tripFirstTravelDate = (trip:Trip) => trip.items.reduce((earliest,item)=>{
  const date=item.start.slice(0,10)
  return !earliest||date<earliest?date:earliest
},'')

const localToday = () => {
  const now=new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

export function closestUpcomingTrip(trips:Trip[],today=localToday()):Trip|undefined {
  return trips
    .filter(trip=>!trip.archivedAt&&tripFirstTravelDate(trip)&&tripLastTravelDate(trip)>=today)
    .sort((left,right)=>{
      const leftStart=tripFirstTravelDate(left),rightStart=tripFirstTravelDate(right)
      const leftNext=leftStart<today?today:leftStart,rightNext=rightStart<today?today:rightStart
      return leftNext.localeCompare(rightNext)
        ||tripLastTravelDate(left).localeCompare(tripLastTravelDate(right))
        ||right.updatedAt.localeCompare(left.updatedAt)
    })[0]
}

export function initialTrip(trips:Trip[],requestedTripId?:string,persistedTripId?:string|null,today=localToday()):Trip|undefined {
  const persisted=persistedTripId?trips.find(trip=>trip.id===persistedTripId):undefined
  return (requestedTripId?trips.find(trip=>trip.id===requestedTripId):undefined)
    ||(persisted&&!persisted.archivedAt?persisted:undefined)
    ||closestUpcomingTrip(trips,today)
    ||trips.find(trip=>!trip.archivedAt)
    ||trips[0]
}
