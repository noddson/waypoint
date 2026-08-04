export type CalendarDelivery = 'export' | 'subscription'

const calendarDeliveryStorageKey = 'waypoint-calendar-delivery'

export const calendarDeliveryFromStorage = (value:string|null):CalendarDelivery => value==='subscription'?'subscription':'export'

export function loadCalendarDelivery():CalendarDelivery {
  try{return calendarDeliveryFromStorage(localStorage.getItem(calendarDeliveryStorageKey))}
  catch{return 'export'}
}

export function saveCalendarDelivery(delivery:CalendarDelivery) {
  try{localStorage.setItem(calendarDeliveryStorageKey,delivery)}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}
