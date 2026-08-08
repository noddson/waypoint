import { useEffect, useMemo, useState } from 'react'
import { destinationLabel } from './destinations'
import { sortTripItems, TripItem } from './types'

export const WEATHER_FORECAST_DAYS = 14
export const WEATHER_API_DAYS = 16
export const HISTORICAL_WEATHER_START_DATE = '2022-01-01'
const weatherDisplayStorageKey = 'waypoint-weather-display'
const legacyWeatherEnabledStorageKey = 'waypoint-weather-enabled'
const legacyWeatherTemperatureUnitStorageKey = 'waypoint-weather-temperature-unit'

export type WeatherTemperatureUnit = 'celsius' | 'fahrenheit' | 'kelvin'
export type WeatherDisplay = 'off' | WeatherTemperatureUnit

export interface WeatherTarget {
  key: string
  label: string
  address: string
  queries: string[]
  countryCode?: string
}

export interface WeatherDayPlan {
  agendaDate: string
  date: string
  target: WeatherTarget
}

export interface ItemWeatherPlan extends WeatherDayPlan {
  itemId: string
}

export interface WeatherRequest {
  source: 'forecast'|'historical'
  target: WeatherTarget
  startDate?: string
  endDate?: string
}

export interface DailyWeather {
  date: string
  code: number
  high: number
  low: number
  precipitationProbability?: number
  windSpeed?: number
}

export interface LocationWeather {
  target: WeatherTarget
  resolvedName: string
  latitude: number
  longitude: number
  loadedAt: number
  days: Map<string, DailyWeather>
}

export interface WeatherForecastState {
  forecasts: Map<string, LocationWeather>
  failedTargets: Set<string>
  loadingTargets: Set<string>
}

export interface TripWeatherWindow {
  state: 'empty' | 'completed' | 'active' | 'upcoming'
  anchor?: string
  dates: string[]
}

type GeocodingResult = {
  name?: unknown
  admin1?: unknown
  country?: unknown
  latitude?: unknown
  longitude?: unknown
}

type ForecastResponse = {
  daily?: {
    time?: unknown
    weather_code?: unknown
    temperature_2m_max?: unknown
    temperature_2m_min?: unknown
    precipitation_probability_max?: unknown
    wind_speed_10m_max?: unknown
  }
}

const resolvedForecasts = new Map<string, LocationWeather>()
const forecastRequests = new Map<string, Promise<LocationWeather>>()
const weatherCacheMilliseconds=30*60*1000

const dateTime = (date:string) => Date.parse(`${date}T12:00:00Z`)

export function addWeatherDays(date:string, days:number) {
  return new Date(dateTime(date) + days * 86_400_000).toISOString().slice(0, 10)
}

export function localWeatherDate(now=Date.now()) {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

const tripBounds = (items:TripItem[]) => {
  const itinerary=items.filter(item=>item.type!=='journal')
  if(!itinerary.length)return undefined
  let start=itinerary[0].start.slice(0,10),end=(itinerary[0].end||itinerary[0].start).slice(0,10)
  for(const item of itinerary){
    const itemStart=item.start.slice(0,10),itemEnd=(item.end||item.start).slice(0,10)
    if(itemStart<start)start=itemStart
    if(itemEnd>end)end=itemEnd
  }
  return {start,end}
}

const inclusiveDates = (start:string,end:string) => {
  const dates:string[]=[]
  for(let date=start;date<=end;date=addWeatherDays(date,1))dates.push(date)
  return dates
}

export function tripWeatherWindow(items:TripItem[],today:string):TripWeatherWindow {
  const bounds=tripBounds(items)
  if(!bounds)return {state:'empty',dates:[]}
  if(today>bounds.end){
    const start=bounds.start>HISTORICAL_WEATHER_START_DATE?bounds.start:HISTORICAL_WEATHER_START_DATE
    return start>bounds.end?{state:'completed',dates:[]}:{state:'completed',anchor:start,dates:inclusiveDates(start,bounds.end)}
  }
  const state=today<bounds.start?'upcoming':'active',anchor=state==='upcoming'?bounds.start:today
  const end=[bounds.end,addWeatherDays(anchor,WEATHER_FORECAST_DAYS-1)].sort()[0]
  return {state,anchor,dates:inclusiveDates(anchor,end)}
}

export function isWeatherForecastDate(date:string,today:string) {
  return date>=today&&date<=addWeatherDays(today,WEATHER_API_DAYS-1)
}

export function isHistoricalWeatherDate(date:string,today:string) {
  return date>=HISTORICAL_WEATHER_START_DATE&&date<today
}

export function isWeatherAvailableDate(date:string,today:string) {
  return isWeatherForecastDate(date,today)||isHistoricalWeatherDate(date,today)
}

const countryAliases:Record<string,string> = {
  'united states':'US','united states of america':'US','usa':'US','u.s.a.':'US',
  'united kingdom':'GB','uk':'GB','great britain':'GB','england':'GB','scotland':'GB','wales':'GB','northern ireland':'GB',
  'republic of ireland':'IE',
}
const canadianProvinces=new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'])
const unitedStates=new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])

type RegionDisplayNames = {of:(code:string)=>string|undefined}
type RegionDisplayNamesConstructor = new (locales:string[],options:{type:'region'})=>RegionDisplayNames

const displayedCountries = (()=>{
  const countries=new Map<string,string>()
  const DisplayNames=(Intl as unknown as {DisplayNames?:RegionDisplayNamesConstructor}).DisplayNames
  if(!DisplayNames)return countries
  try{
    const names=new DisplayNames(['en'],{type:'region'})
    for(let first=65;first<=90;first++)for(let second=65;second<=90;second++){
      const code=String.fromCharCode(first,second),name=names.of(code)
      if(name&&name!==code&&!/^unknown region$/i.test(name))countries.set(name.toLocaleLowerCase(),code)
    }
  }catch{/* Country hints improve matching but are not required for forecasts. */}
  return countries
})()

const cleanPart = (value:string) => value.replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\bIATA(?:\s+code)?\s*[:\-]?\s*[A-Z]{3}\b/gi,' ').replace(/\s+/g,' ').trim()
const iataCode = /^[A-Z]{3}$/
const airportDetail = /^(?:terminal|gate|door|arrivals?|departures?|pre-arranged|taxi|limo|kiosk|parking|shuttle)\b/i
const weatherPlaceIdentity = (value:string) => value.toLocaleLowerCase().replace(/\s+/g,' ').trim()
const sameWeatherTarget = (left:WeatherTarget,right:WeatherTarget) => weatherPlaceIdentity(left.label)===weatherPlaceIdentity(right.label)&&(!left.countryCode||!right.countryCode||left.countryCode===right.countryCode)

export function weatherCountryCode(address:string) {
  const parts=address.split(',').map(cleanPart).filter(Boolean)
  for(const part of [...parts].reverse()){
    const normalized=part.toLocaleLowerCase().replace(/[.]$/,'')
    if(countryAliases[normalized])return countryAliases[normalized]
    if(displayedCountries.has(normalized))return displayedCountries.get(normalized)
    const regionCode=part.match(/(?:^|\s)([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?|\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d|$)/)?.[1]
    if(regionCode&&canadianProvinces.has(regionCode))return 'CA'
    if(regionCode&&unitedStates.has(regionCode))return 'US'
  }
  return undefined
}

const airportFallback = (address:string) => {
  const first=cleanPart(address.split(',')[0]).replace(/\b[A-Z]{3}\b/g,' ').replace(/\s+/g,' ').trim()
  const label=destinationLabel(first)
  if(label&&!iataCode.test(label)&&!airportDetail.test(label))return label
  const simplified=first
    .replace(/\b(?:international|regional|municipal)\s+airport\b.*$/i,' ')
    .replace(/\bairport\b.*$/i,' ')
    .replace(/\s+/g,' ').trim()
  return simplified||undefined
}

export function weatherTargetFromAddress(address?:string):WeatherTarget|undefined {
  if(!address?.trim())return undefined
  const fullLabel=destinationLabel(address),isAirport=/\bairport\b/i.test(address),parts=address.split(',').map(part=>destinationLabel(part)).filter((value):value is string=>!!value)
  const validPlace=(value:string|undefined):value is string=>!!value&&!iataCode.test(value)&&(!isAirport||!airportDetail.test(value))
  const place=validPlace(fullLabel)?fullLabel:parts.find(validPlace)||airportFallback(address)||fullLabel
  if(!place)return undefined
  const countryCode=weatherCountryCode(address),queries=[place]
  const words=place.split(/\s+/)
  if(/\bairport\b/i.test(address)&&words.length>1)for(let length=words.length-1;length>=1;length--)queries.push(words.slice(0,length).join(' '))
  const uniqueQueries=queries.filter((query,index,all)=>query.length>=2&&all.findIndex(value=>value.toLocaleLowerCase()===query.toLocaleLowerCase())===index)
  const key=`${weatherPlaceIdentity(uniqueQueries[0])}|${countryCode||''}`
  return {key,label:uniqueQueries[0],address,queries:uniqueQueries,...(countryCode?{countryCode}: {})}
}

export function weatherPlansForItem(item:TripItem,weatherDate?:string):ItemWeatherPlan[] {
  if(item.type==='insurance'||item.type==='journal')return []
  const agendaDate=item.start.slice(0,10),startDate=weatherDate||agendaDate,endDate=item.end?.slice(0,10)||startDate
  const candidates=[
    ...(item.location?[{address:item.location,date:startDate}]:[]),
    ...(item.endLocation?[{address:item.endLocation,date:endDate}]:[]),
  ]
  const plans:ItemWeatherPlan[]=[]
  for(const candidate of candidates){
    const target=weatherTargetFromAddress(candidate.address)
    if(!target)continue
    const index=plans.findIndex(plan=>sameWeatherTarget(plan.target,target))
    if(index<0)plans.push({itemId:item.id,agendaDate,date:candidate.date,target})
    else if(!plans[index].target.countryCode&&target.countryCode)plans[index]={...plans[index],target}
  }
  return plans
}

export function dedupeWeatherPlans<Plan extends WeatherDayPlan>(plans:Plan[]) {
  // A rendered scope has one card per regional target and forecast date. Keep its
  // first plan while upgrading an unqualified place with a later country hint.
  const unique:Plan[]=[]
  for(const plan of plans){
    const index=unique.findIndex(existing=>existing.date===plan.date&&sameWeatherTarget(existing.target,plan.target))
    if(index<0)unique.push(plan)
    else if(!unique[index].target.countryCode&&plan.target.countryCode)unique[index]={...unique[index],target:plan.target}
  }
  return unique
}

export function agendaItemWeatherPlans(items:TripItem[],forecastDates:string[],today:string) {
  const forecastDateSet=new Set(forecastDates)
  return sortTripItems(items).flatMap(item=>{
    const agendaDate=item.start.slice(0,10),plans=weatherPlansForItem(item)
    if(plans.some(plan=>forecastDateSet.has(plan.date)))return plans
    const activeStay=item.type==='stay'&&agendaDate<=today&&(!item.end||item.end.slice(0,10)>=today)&&forecastDateSet.has(today)
    return activeStay?weatherPlansForItem(item,today):[]
  })
}

type LocatedCandidate = {address:string;time:string;priority:number}

const itemCandidatesForDate = (item:TripItem,date:string):LocatedCandidate[] => {
  const candidates:LocatedCandidate[]=[]
  if(item.type==='journal')return candidates
  const startDate=item.start.slice(0,10),endDate=item.end?.slice(0,10)
  if(item.type==='stay'&&item.location&&startDate<=date&&(!endDate||date<=endDate))candidates.push({address:item.location,time:startDate===date?item.start.slice(11,16)||'12:00':'00:00',priority:1})
  if(startDate===date&&item.type!=='insurance'){
    if(item.location)candidates.push({address:item.location,time:item.start.slice(11,16)||'12:00',priority:2})
    if(item.type!=='flight'&&item.endLocation)candidates.push({address:item.endLocation,time:item.end?.slice(11,16)||item.start.slice(11,16)||'12:00',priority:3})
  }
  if(endDate===date&&item.endLocation)candidates.push({address:item.endLocation,time:item.end?.slice(11,16)||'23:59',priority:4})
  return candidates
}

const previousLocation = (items:TripItem[],date:string) => {
  let address:string|undefined
  for(const item of sortTripItems(items)){
    if(item.start.slice(0,10)>date)break
    if(item.type==='insurance'||item.type==='journal')continue
    if(item.type==='flight'&&item.endLocation&&(item.end||item.start).slice(0,10)<=date)address=item.endLocation
    else if(item.endLocation)address=item.endLocation
    else if(item.location)address=item.location
  }
  return address
}

const nextLocation = (items:TripItem[],date:string) => {
  for(const item of sortTripItems(items)){
    if(item.start.slice(0,10)<date||item.type==='insurance'||item.type==='journal')continue
    const address=item.type==='flight'?item.endLocation||item.location:item.location||item.endLocation
    if(address)return address
  }
  return undefined
}

export function weatherTargetForDate(items:TripItem[],date:string) {
  const candidates=items.flatMap(item=>itemCandidatesForDate(item,date)).sort((left,right)=>left.time.localeCompare(right.time)||left.priority-right.priority)
  return weatherTargetFromAddress(candidates[candidates.length-1]?.address||previousLocation(items,date)||nextLocation(items,date))
}

export function weatherTargetsForDate(items:TripItem[],date:string) {
  const candidates=items.flatMap(item=>itemCandidatesForDate(item,date)).sort((left,right)=>left.time.localeCompare(right.time)||left.priority-right.priority)
  const targets:WeatherTarget[]=[]
  for(const candidate of candidates){
    const target=weatherTargetFromAddress(candidate.address)
    if(!target)continue
    const index=targets.findIndex(existing=>sameWeatherTarget(existing,target))
    if(index<0)targets.push(target)
    else if(!targets[index].countryCode&&target.countryCode)targets[index]=target
  }
  if(targets.length)return targets
  const fallback=weatherTargetFromAddress(previousLocation(items,date)||nextLocation(items,date))
  return fallback?[fallback]:[]
}

export function weatherPlansForDates(items:TripItem[],dates:string[]) {
  return dates.flatMap(date=>weatherTargetsForDate(items,date).map(target=>({agendaDate:date,date,target})))
}

export function agendaWeatherPlans(items:TripItem[],agendaDates:string[],forecastDates:string[],today:string) {
  const agendaDateSet=new Set(agendaDates),forecastDateSet=new Set(forecastDates)
  const activeStays=!agendaDateSet.has(today)&&forecastDateSet.has(today)?sortTripItems(items)
    .filter(item=>item.type==='stay'&&item.start.slice(0,10)<=today&&(!item.end||item.end.slice(0,10)>=today)&&agendaDateSet.has(item.start.slice(0,10))):[]
  const activeStayDate=activeStays[activeStays.length-1]?.start.slice(0,10)
  return agendaDates.flatMap(agendaDate=>{
    const date=forecastDateSet.has(agendaDate)?agendaDate:agendaDate===activeStayDate?today:undefined
    return date?weatherTargetsForDate(items,date).map(target=>({agendaDate,date,target})):[]
  })
}

export function weatherRequestsForPlans(plans:WeatherDayPlan[],today:string) {
  const requests=new Map<string,WeatherRequest>()
  for(const plan of plans){
    const source=isWeatherForecastDate(plan.date,today)?'forecast':isHistoricalWeatherDate(plan.date,today)?'historical':undefined
    if(!source)continue
    const key=`${source}:${plan.target.key}`,existing=requests.get(key)
    if(source==='forecast'){
      if(!existing)requests.set(key,{source,target:plan.target})
      continue
    }
    if(existing){
      existing.startDate=[existing.startDate!,plan.date].sort()[0]
      existing.endDate=existing.endDate!>plan.date?existing.endDate:plan.date
    }else requests.set(key,{source,target:plan.target,startDate:plan.date,endDate:plan.date})
  }
  return [...requests.values()]
}

export function weatherSearchUrl(target:WeatherTarget,date?:string) {
  const query=[target.label,target.countryCode,date,'weather'].filter(Boolean).join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export function weatherDescription(code:number) {
  if(code===0)return {icon:'☀️',label:'Clear'}
  if(code===1)return {icon:'🌤️',label:'Mostly clear'}
  if(code===2)return {icon:'⛅',label:'Partly cloudy'}
  if(code===3)return {icon:'☁️',label:'Overcast'}
  if(code===45||code===48)return {icon:'🌫️',label:'Fog'}
  if(code>=51&&code<=57)return {icon:'🌦️',label:'Drizzle'}
  if(code>=61&&code<=67)return {icon:'🌧️',label:code>=66?'Freezing rain':'Rain'}
  if(code>=71&&code<=77)return {icon:'🌨️',label:'Snow'}
  if(code>=80&&code<=82)return {icon:'🌦️',label:'Rain showers'}
  if(code===85||code===86)return {icon:'🌨️',label:'Snow showers'}
  if(code>=95)return {icon:'⛈️',label:'Thunderstorms'}
  return {icon:'🌡️',label:'Weather'}
}

export function resolveWeatherDisplay(stored:string|null,legacyEnabled:string|null,legacyUnit:string|null):WeatherDisplay {
  if(stored==='off'||stored==='celsius'||stored==='fahrenheit'||stored==='kelvin')return stored
  const unit:WeatherTemperatureUnit=legacyUnit==='fahrenheit'||legacyUnit==='kelvin'?legacyUnit:'celsius'
  return legacyEnabled==='false'?'off':unit
}

export function loadWeatherDisplay():WeatherDisplay {
  try{return resolveWeatherDisplay(localStorage.getItem(weatherDisplayStorageKey),localStorage.getItem(legacyWeatherEnabledStorageKey),localStorage.getItem(legacyWeatherTemperatureUnitStorageKey))}catch{return 'celsius'}
}

export function saveWeatherDisplay(display:WeatherDisplay) {
  try{
    localStorage.setItem(weatherDisplayStorageKey,display)
    localStorage.setItem(legacyWeatherEnabledStorageKey,String(display!=='off'))
    if(display!=='off')localStorage.setItem(legacyWeatherTemperatureUnitStorageKey,display)
  }catch{/* The current selection still works when browser storage is unavailable. */}
}

export function formatWeatherTemperature(value:number,unit:WeatherTemperatureUnit) {
  if(unit==='fahrenheit')return `${Math.round(value*9/5+32)}°F`
  if(unit==='kelvin')return `${Math.round(value+273.15)} K`
  return `${Math.round(value)}°C`
}

export function formatWeatherTemperaturePair(high:number,low:number,unit:WeatherTemperatureUnit) {
  if(unit==='fahrenheit')return `${Math.round(high*9/5+32)}° / ${Math.round(low*9/5+32)}°F`
  if(unit==='kelvin')return `${Math.round(high+273.15)} / ${Math.round(low+273.15)} K`
  return `${Math.round(high)}° / ${Math.round(low)}°C`
}

const valueArray = (value:unknown) => Array.isArray(value)?value:undefined
const stringArray = (value:unknown) => Array.isArray(value)&&value.every(entry=>typeof entry==='string')?value as string[]:undefined

export function parseDailyWeatherResponse(value:unknown) {
  const daily=(value as ForecastResponse|undefined)?.daily,times=stringArray(daily?.time),codes=valueArray(daily?.weather_code),highs=valueArray(daily?.temperature_2m_max),lows=valueArray(daily?.temperature_2m_min)
  const precipitation=valueArray(daily?.precipitation_probability_max),wind=valueArray(daily?.wind_speed_10m_max),days=new Map<string,DailyWeather>()
  if(!times||!codes||!highs||!lows)return days
  for(const [index,date] of times.entries()){
    const code=codes[index],high=highs[index],low=lows[index],rain=precipitation?.[index],windSpeed=wind?.[index]
    if(typeof code!=='number'||typeof high!=='number'||typeof low!=='number')continue
    days.set(date,{date,code,high,low,...(typeof rain==='number'?{precipitationProbability:rain}:{}),...(typeof windSpeed==='number'?{windSpeed}:{})})
  }
  return days
}

async function geocodeWeatherTarget(target:WeatherTarget) {
  for(const query of target.queries){
    const url=new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name',query);url.searchParams.set('count','5');url.searchParams.set('language','en');url.searchParams.set('format','json')
    if(target.countryCode)url.searchParams.set('countryCode',target.countryCode)
    const response=await fetch(url)
    if(!response.ok)continue
    const results=(await response.json() as {results?:unknown}).results
    if(!Array.isArray(results))continue
    const result=results.find((entry):entry is GeocodingResult=>!!entry&&typeof entry==='object'&&typeof (entry as GeocodingResult).latitude==='number'&&typeof (entry as GeocodingResult).longitude==='number')
    if(result){
      const resolved=[result.name,result.admin1,result.country].filter(value=>typeof value==='string'&&value).join(', ')
      return {latitude:result.latitude as number,longitude:result.longitude as number,resolvedName:resolved||target.label}
    }
  }
  throw new Error(`Weather location not found for ${target.label}.`)
}

export function weatherApiUrl(request:WeatherRequest,location:{latitude:number;longitude:number}) {
  const url=new URL(request.source==='historical'?'https://historical-forecast-api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',String(location.latitude));url.searchParams.set('longitude',String(location.longitude))
  url.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max')
  url.searchParams.set('timezone','auto')
  if(request.source==='historical'){
    url.searchParams.set('start_date',request.startDate!);url.searchParams.set('end_date',request.endDate!)
  }else url.searchParams.set('forecast_days',String(WEATHER_API_DAYS))
  return url
}

async function requestLocationWeather(request:WeatherRequest):Promise<LocationWeather> {
  const {target}=request,location=await geocodeWeatherTarget(target),url=weatherApiUrl(request,location)
  const response=await fetch(url)
  if(!response.ok)throw new Error(`${request.source==='historical'?'Historical weather':'Weather forecast'} failed for ${target.label}.`)
  const days=parseDailyWeatherResponse(await response.json())
  if(!days.size)throw new Error(`${request.source==='historical'?'Historical weather':'Weather forecast'} was incomplete for ${target.label}.`)
  return {target,...location,loadedAt:Date.now(),days}
}

const weatherRequestKey = (request:WeatherRequest) => [request.source,request.target.key,request.startDate,request.endDate].filter(Boolean).join(':')

function loadLocationWeather(request:WeatherRequest) {
  const key=weatherRequestKey(request),resolved=resolvedForecasts.get(key)
  if(resolved&&Date.now()-resolved.loadedAt<weatherCacheMilliseconds)return Promise.resolve(resolved)
  if(resolved)resolvedForecasts.delete(key)
  const running=forecastRequests.get(key)
  if(running)return running
  const runningRequest=requestLocationWeather(request).then(forecast=>{resolvedForecasts.set(key,forecast);return forecast}).finally(()=>forecastRequests.delete(key))
  forecastRequests.set(key,runningRequest)
  return runningRequest
}

const mergeLocationWeather = (current:LocationWeather|undefined,next:LocationWeather):LocationWeather => current?{...next,loadedAt:Math.max(current.loadedAt,next.loadedAt),days:new Map([...current.days,...next.days])}:next

export function useWeatherForecasts(plans:WeatherDayPlan[],today:string,enabled=true,refreshKey:string|number=''):WeatherForecastState {
  const planKey=plans.map(plan=>`${plan.date}:${plan.target.key}`).sort().join('~')
  const requests=useMemo(()=>weatherRequestsForPlans(plans,today),[planKey,today])
  const requestKey=requests.map(weatherRequestKey).sort().join('~')
  const [state,setState]=useState<WeatherForecastState>({forecasts:new Map(),failedTargets:new Set(),loadingTargets:new Set()})

  useEffect(()=>{
    let cancelled=false
    if(!enabled||!requests.length){setState({forecasts:new Map(),failedTargets:new Set(),loadingTargets:new Set()});return()=>{cancelled=true}}
    const forecasts=new Map<string,LocationWeather>(),failedTargets=new Set<string>(),loadingTargets=new Set<string>()
    for(const request of requests){const cached=resolvedForecasts.get(weatherRequestKey(request));if(cached)forecasts.set(request.target.key,mergeLocationWeather(forecasts.get(request.target.key),cached));else loadingTargets.add(request.target.key)}
    setState({forecasts:new Map(forecasts),failedTargets:new Set(),loadingTargets:new Set(loadingTargets)})
    void Promise.allSettled(requests.map(async request=>{
      try{const forecast=await loadLocationWeather(request);forecasts.set(request.target.key,mergeLocationWeather(forecasts.get(request.target.key),forecast))}catch{failedTargets.add(request.target.key)}finally{
        loadingTargets.delete(request.target.key)
        if(!cancelled)setState({forecasts:new Map(forecasts),failedTargets:new Set(failedTargets),loadingTargets:new Set(loadingTargets)})
      }
    }))
    return()=>{cancelled=true}
  },[enabled,requestKey,refreshKey])

  return state
}
