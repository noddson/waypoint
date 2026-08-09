import { mapLocationQuery } from './destinations'
import { StayCalendarTiming } from './calendarDelivery'
import { virtualEventLink } from './calendarItemLink'
import { Trip, TripItem, sortTripItems, typeLabels } from './types'

export interface CalendarBuildOptions {
  includeSourceEmail?:boolean
  stayTiming?:StayCalendarTiming
  itemUrls?:Record<string,string>
}

const encoder=new TextEncoder()
const pad=(value:number)=>String(value).padStart(2,'0')
const compactDate=(value:string)=>value.slice(0,10).replace(/-/g,'')
const escapeText=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')
const safeFilenamePart=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')

const nextDate=(value:string)=>{const date=new Date(`${value.slice(0,10)}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10)}
const hasTime=(value?:string)=>!!value&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
const utcStamp=(value:string):string=>{const date=new Date(value);return Number.isNaN(date.getTime())?utcStamp(new Date().toISOString()):`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`}

function localDateTimeAsUtc(value:string,timeZone:string) {
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if(!match)return utcStamp(value)
  const [,year,month,day,hour,minute]=match,target=Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute))
  let instant=target
  try{
    const formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
    for(let pass=0;pass<3;pass++){
      const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part=>[part.type,part.value]))
      const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second))
      const adjustment=target-represented
      instant+=adjustment
      if(!adjustment)break
    }
  }catch{/* Unknown time zones fall back to treating the itinerary wall time as UTC. */}
  return utcStamp(new Date(instant).toISOString())
}

function foldLine(line:string) {
  const folded:string[]=[]
  let current='',bytes=0,limit=75
  for(const char of line){const size=encoder.encode(char).length;if(current&&bytes+size>limit){folded.push(current);current=' ';bytes=1;limit=75}current+=char;bytes+=size}
  if(current)folded.push(current)
  return folded
}

const descriptionLines=(item:TripItem,includeSourceEmail=false)=>[
  `Type: ${typeLabels[item.type]}`,
  item.provider&&`Provider: ${item.provider}`,
  `Status: ${item.status}`,
  item.confirmation&&`Confirmation: ${item.confirmation}`,
  item.bookedBy&&item.bookedBy!=='Unknown'&&`Booked by: ${item.bookedBy}`,
  item.quantity&&`Quantity: ${item.quantity}`,
  item.flightNumber&&`Flight number: ${item.flightNumber}`,
  item.durationMinutes&&`Duration: ${Math.floor(item.durationMinutes/60)}h ${item.durationMinutes%60}m`,
  item.endLocation&&`End location: ${mapLocationQuery(item,item.endLocation)}`,
  item.notes&&`Details: ${item.notes}`,
  item.link&&`${virtualEventLink(item)?'Virtual event':'Booking'}: ${item.link}`,
  includeSourceEmail&&item.emailLink&&`Source email: ${item.emailLink}`,
].filter((value):value is string=>!!value)

const displayAlarm=(trigger:string,description:string)=>['BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${escapeText(description)}`,trigger,'END:VALARM']
const absoluteAlarm=(value:string,timeZone:string,description:string)=>displayAlarm(`TRIGGER;VALUE=DATE-TIME:${localDateTimeAsUtc(value,timeZone)}`,description)
const morningOrEarlier=(value:string)=>hasTime(value)&&value.slice(11,16)<'08:00'?value:`${value.slice(0,10)}T08:00`

function alarmLines(item:TripItem) {
  const timed=hasTime(item.start)&&!item.allDay
  if(item.type==='flight'&&timed)return [...displayAlarm('TRIGGER:-P1D','Flight check-in opens in 24 hours'),...displayAlarm('TRIGGER:-PT3H','Flight departs in 3 hours')]
  if(item.type==='transport'&&timed)return displayAlarm('TRIGGER:-PT1H','Transit or train departs in 1 hour')
  if(item.type==='car'){
    const actions=[{value:item.start,timeZone:item.timeZone,description:/\b(return|drop.?off)\b/i.test(item.title)?'Car rental return time':'Car rental pickup time'},...(item.end?[{value:item.end,timeZone:item.endTimeZone||item.timeZone,description:'Car rental return time'}]:[])]
    const alarms:string[]=[],seen=new Set<string>()
    for(const action of actions){const trigger=`TRIGGER;VALUE=DATE-TIME:${localDateTimeAsUtc(morningOrEarlier(action.value),action.timeZone)}`;if(!seen.has(trigger)){seen.add(trigger);alarms.push(...displayAlarm(trigger,action.description))}}
    return alarms
  }
  if(item.type==='stay'){
    const alarms:string[]=[]
    if(timed)alarms.push(...absoluteAlarm(item.start,item.timeZone,'Stay check-in time'))
    if(hasTime(item.end)&&!item.allDay)alarms.push(...absoluteAlarm(item.end!,item.endTimeZone||item.timeZone,'Stay checkout time'))
    return alarms
  }
  if(item.type==='event')return [...displayAlarm('TRIGGER:-P1D','Event is tomorrow'),...(timed?displayAlarm('TRIGGER:-PT2H','Event starts in 2 hours'):[])]
  return []
}

function eventLines(item:TripItem,trip:Trip,options:CalendarBuildOptions) {
  const lines=[
    'BEGIN:VEVENT',
    `UID:${item.id}@waypoint.travel`,
    `DTSTAMP:${utcStamp(trip.updatedAt)}`,
    `LAST-MODIFIED:${utcStamp(trip.updatedAt)}`,
    `SUMMARY:${escapeText(item.title)}`,
    `DESCRIPTION:${escapeText(descriptionLines(item,options.includeSourceEmail).join('\n'))}`,
    `STATUS:${item.status==='confirmed'?'CONFIRMED':'TENTATIVE'}`,
    `CATEGORIES:${escapeText(typeLabels[item.type])}`,
  ]
  const allDayStay=item.type==='stay'&&options.stayTiming==='all-day'
  if(item.allDay||allDayStay){
    lines.push(`DTSTART;VALUE=DATE:${compactDate(item.start)}`)
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDate(item.end||item.start))}`)
  }else{
    lines.push(`DTSTART:${localDateTimeAsUtc(item.start,item.timeZone)}`)
    if(item.end)lines.push(`DTEND:${localDateTimeAsUtc(item.end,item.endTimeZone||item.timeZone)}`)
  }
  const location=item.location?mapLocationQuery(item,item.location):item.endLocation?mapLocationQuery(item,item.endLocation):undefined
  if(location)lines.push(`LOCATION:${escapeText(location)}`)
  const eventUrl=virtualEventLink(item)||options.itemUrls?.[item.id]
  if(eventUrl)lines.push(`URL:${eventUrl}`)
  lines.push(...alarmLines(item))
  lines.push('END:VEVENT')
  return lines
}

export function tripCalendarFilename(trip:Pick<Trip,'name'>) {
  return `${safeFilenamePart(trip.name)||'trip'}-itinerary.ics`
}

export function buildTripCalendar(trip:Trip,options:CalendarBuildOptions={}) {
  const lines=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Waypoint Travel Planner//Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WAYPOINT-DATA-FLOW:ITINERARY-JSON-TO-CALENDAR',
    `X-WR-CALNAME:${escapeText(trip.name)}`,
    ...sortTripItems(trip.items).filter(item=>item.type!=='journal').flatMap(item=>eventLines(item,trip,options)),
    'END:VCALENDAR',
  ]
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`
}
