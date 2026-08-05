export type CalendarDelivery = 'export' | 'subscription'
export type StayCalendarTiming = 'all-day' | 'check-in-out'

const calendarDeliveryStorageKey = 'waypoint-calendar-delivery'
const stayCalendarTimingStorageKey = 'waypoint-stay-calendar-timing'
const exportedCalendarTripsStorageKey = 'waypoint-exported-calendar-trips'

const validTripIds = (value:unknown):string[] => Array.isArray(value)
  ? [...new Set(value.filter((id):id is string=>typeof id==='string'&&!!id))]
  : []

export const calendarDeliveryFromStorage = (value:string|null):CalendarDelivery => value==='subscription'?'subscription':'export'
export const stayCalendarTimingFromStorage = (value:string|null):StayCalendarTiming => value==='all-day'?'all-day':'check-in-out'

export function calendarActionLabel(delivery:CalendarDelivery,published:boolean,busy=false) {
  if(busy)return delivery==='export'?'Building calendar…':published?'Refreshing calendar…':'Publishing calendar…'
  if(delivery==='export')return 'Export calendar (.ics)'
  return published?'Show published link':'Publish calendar subscription'
}

export function loadCalendarDelivery():CalendarDelivery {
  try{return calendarDeliveryFromStorage(localStorage.getItem(calendarDeliveryStorageKey))}
  catch{return 'export'}
}

export function saveCalendarDelivery(delivery:CalendarDelivery) {
  try{localStorage.setItem(calendarDeliveryStorageKey,delivery)}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}

export function loadStayCalendarTiming():StayCalendarTiming {
  try{return stayCalendarTimingFromStorage(localStorage.getItem(stayCalendarTimingStorageKey))}
  catch{return 'check-in-out'}
}

export function saveStayCalendarTiming(timing:StayCalendarTiming) {
  try{localStorage.setItem(stayCalendarTimingStorageKey,timing)}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}

export function loadExportedCalendarTripIds():string[] {
  try{return validTripIds(JSON.parse(localStorage.getItem(exportedCalendarTripsStorageKey)||'[]'))}
  catch{return []}
}

export function saveExportedCalendarTripIds(tripIds:Iterable<string>) {
  try{localStorage.setItem(exportedCalendarTripsStorageKey,JSON.stringify(validTripIds([...tripIds])))}
  catch{/* Export markers remain available for this session when storage is unavailable. */}
}
