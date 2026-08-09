export type TripListTab = 'favourites'|'synced'|'local-only'|'shared-with-me'|'archived'

const tripListTabStorageKey = 'waypoint-trip-list-tab'
const tripListTabs:TripListTab[] = ['favourites','synced','local-only','shared-with-me','archived']

export function loadTripListTab():TripListTab {
  try{
    const value=localStorage.getItem(tripListTabStorageKey)
    return tripListTabs.includes(value as TripListTab)?value as TripListTab:'favourites'
  }catch{return 'favourites'}
}

export function saveTripListTab(tab:TripListTab) {
  try{localStorage.setItem(tripListTabStorageKey,tab)}
  catch{/* The selected tab remains available for this session. */}
}
