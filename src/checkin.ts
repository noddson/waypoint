import { TripItem } from './types'

export const AIR_CANADA_CHECK_IN_URL = 'https://www.aircanada.com/home/ca/en/aco/checkin'
const FLIGHT_STATUS_LEAD_TIME = 12*60*60*1000
const FLIGHT_STATUS_FALLBACK_DURATION = 12*60*60*1000

export function zonedDateTimeEpoch(value:string,timeZone:string) {
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if(!match)return Number.NaN
  const [,year,month,day,hour,minute]=match
  const target=Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute))
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
  let instant=target
  for(let pass=0;pass<2;pass+=1){const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part=>[part.type,part.value]));const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));instant=target-(represented-instant)}
  return instant
}

export function isAirCanadaCheckInOpen(item:TripItem,now=Date.now()) {
  if(item.type!=='flight'||!item.provider?.toLowerCase().includes('air canada'))return false
  const departure=zonedDateTimeEpoch(item.start,item.timeZone)
  return Number.isFinite(departure)&&now>=departure-24*60*60*1000&&now<departure
}

export function googleFlightStatusUrl(item:TripItem) {
  const flightNumber=item.flightNumber?.trim()
  if(item.type!=='flight'||!flightNumber)return undefined
  const url=new URL('https://www.google.com/search')
  url.searchParams.set('q',`${flightNumber} flight status`)
  return url.toString()
}

export function isFlightStatusWindowOpen(item:TripItem,now=Date.now()) {
  if(!googleFlightStatusUrl(item))return false
  const departure=zonedDateTimeEpoch(item.start,item.timeZone)
  if(!Number.isFinite(departure)||now<departure-FLIGHT_STATUS_LEAD_TIME)return false
  const arrival=item.end?zonedDateTimeEpoch(item.end,item.endTimeZone||item.timeZone):Number.NaN
  const windowEnd=Number.isFinite(arrival)?arrival:departure+FLIGHT_STATUS_FALLBACK_DURATION
  return now<windowEnd
}
