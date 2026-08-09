const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const localDateTimePattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
const instantPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(Z|[+-]\d{2}:\d{2})$/

export function isCalendarDate(value:unknown):value is string {
  if(typeof value!=='string')return false
  const match=value.match(calendarDatePattern)
  if(!match)return false
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
  if(year<1000||month<1||month>12||day<1||day>31)return false
  const parsed=new Date(Date.UTC(year,month-1,day))
  return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day
}

/** Waypoint item times are local wall-clock values paired with an IANA time zone. */
export function isLocalDateTime(value:unknown):value is string {
  if(typeof value!=='string')return false
  const match=value.match(localDateTimePattern)
  if(!match||!isCalendarDate(match[1]))return false
  const hour=Number(match[2]),minute=Number(match[3]),second=Number(match[4]||0)
  return hour>=0&&hour<=23&&minute>=0&&minute<=59&&second>=0&&second<=59
}

export function isIsoInstant(value:unknown):value is string {
  if(typeof value!=='string'||value.length>100)return false
  const match=value.match(instantPattern)
  if(!match||!isLocalDateTime(match[1]))return false
  if(match[2]!=='Z'){
    const [hours,minutes]=match[2].slice(1).split(':').map(Number)
    if(hours>14||minutes>59||hours===14&&minutes!==0)return false
  }
  return Number.isFinite(Date.parse(value))
}

const validTimeZones=new Set<string>(),invalidTimeZones=new Set<string>()
export function isIanaTimeZone(value:unknown):value is string {
  if(typeof value!=='string'||value.length===0||value.length>100)return false
  if(validTimeZones.has(value))return true
  if(invalidTimeZones.has(value))return false
  try{
    new Intl.DateTimeFormat('en',{timeZone:value}).format(0)
    validTimeZones.add(value)
    return true
  }catch{
    invalidTimeZones.add(value)
    return false
  }
}

export function serializedUtf8SizeAtMost(value:unknown,maxBytes:number) {
  try{return new TextEncoder().encode(JSON.stringify(value)).byteLength<=maxBytes}catch{return false}
}
