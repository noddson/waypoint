import { Trip } from './types'
import { tripFirstTravelDate, tripLastTravelDate } from './tripOrder'

const favouriteTripsStorageKey = 'waypoint-favourite-trips'

const validTripIds = (value:unknown):string[] => Array.isArray(value)
  ? [...new Set(value.filter((id):id is string=>typeof id==='string'&&!!id))]
  : []

export function loadFavouriteTripIds():string[] {
  try{
    const stored=localStorage.getItem(favouriteTripsStorageKey)
    return stored===null?[]:validTripIds(JSON.parse(stored))
  }catch{return []}
}

export function saveFavouriteTripIds(tripIds:Iterable<string>) {
  try{localStorage.setItem(favouriteTripsStorageKey,JSON.stringify(validTripIds([...tripIds])))}
  catch{/* Favourites remain available for this session when browser storage is unavailable. */}
}

const localToday = () => {
  const now=new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

const daysBetween = (left:string,right:string) => Math.abs(Date.parse(`${left}T00:00:00Z`)-Date.parse(`${right}T00:00:00Z`))/86_400_000

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

export function closestFavouriteTrip(trips:Trip[],favouriteTripIds:Iterable<string>,today=localToday()):Trip|undefined {
  const favourites=new Set(favouriteTripIds)
  const distance=(trip:Trip)=>{
    const start=tripFirstTravelDate(trip),end=tripLastTravelDate(trip)
    if(!start||!end)return Number.POSITIVE_INFINITY
    if(start<=today&&end>=today)return 0
    return daysBetween(today,start>today?start:end)
  }
  const period=(trip:Trip)=>{
    const start=tripFirstTravelDate(trip),end=tripLastTravelDate(trip)
    return !start||!end?3:start<=today&&end>=today?0:start>today?1:2
  }
  return trips
    .filter(trip=>favourites.has(trip.id)&&!trip.archivedAt)
    .sort((left,right)=>distance(left)-distance(right)
      ||period(left)-period(right)
      ||(period(left)===2?tripLastTravelDate(right).localeCompare(tripLastTravelDate(left)):tripFirstTravelDate(left).localeCompare(tripFirstTravelDate(right)))
      ||right.updatedAt.localeCompare(left.updatedAt))[0]
}

export function initialTrip(trips:Trip[],requestedTripId?:string,favouriteTripIds:Iterable<string>=[],today=localToday()):Trip|undefined {
  return (requestedTripId?trips.find(trip=>trip.id===requestedTripId):undefined)
    ||closestFavouriteTrip(trips,favouriteTripIds,today)
    ||closestUpcomingTrip(trips,today)
    ||trips.find(trip=>!trip.archivedAt)
    ||trips[0]
}
