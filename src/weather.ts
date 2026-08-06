import { useEffect, useMemo, useState } from 'react'
import { destinationLabel } from './destinations'
import { sortTripItems, TripItem } from './types'

export const WEATHER_FORECAST_DAYS = 14
export const WEATHER_API_DAYS = 16
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
  date: string
  target: WeatherTarget
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
  if(!items.length)return undefined
  let start=items[0].start.slice(0,10),end=(items[0].end||items[0].start).slice(0,10)
  for(const item of items){
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
  if(today>bounds.end)return {state:'completed',dates:[]}
  const state=today<bounds.start?'upcoming':'active',anchor=state==='upcoming'?bounds.start:today
  const end=[bounds.end,addWeatherDays(anchor,WEATHER_FORECAST_DAYS-1)].sort()[0]
  return {state,anchor,dates:inclusiveDates(anchor,end)}
}

export function isWeatherForecastDate(date:string,today:string) {
  return date>=today&&date<=addWeatherDays(today,WEATHER_API_DAYS-1)
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
  const first=cleanPart(address.split(',')[0])
    .replace(/\b[A-Z]{3}\b/g,' ')
    .replace(/\b(?:international|regional|municipal)\s+airport\b.*$/i,' ')
    .replace(/\bairport\b.*$/i,' ')
    .replace(/\s+/g,' ').trim()
  return first||undefined
}

export function weatherTargetFromAddress(address?:string):WeatherTarget|undefined {
  if(!address?.trim())return undefined
  const fullLabel=destinationLabel(address),parts=address.split(',').map(part=>destinationLabel(part)).filter((value):value is string=>!!value)
  const place=fullLabel&&!/^[A-Z]{3}$/.test(fullLabel)?fullLabel:parts.find(value=>!/^[A-Z]{3}$/.test(value))||airportFallback(address)||fullLabel
  if(!place)return undefined
  const countryCode=weatherCountryCode(address),queries=[place]
  const words=place.split(/\s+/)
  if(/\bairport\b/i.test(address)&&words.length>1)for(let length=words.length-1;length>=1;length--)queries.push(words.slice(0,length).join(' '))
  const uniqueQueries=queries.filter((query,index,all)=>query.length>=2&&all.findIndex(value=>value.toLocaleLowerCase()===query.toLocaleLowerCase())===index)
  const key=`${uniqueQueries[0].toLocaleLowerCase()}|${countryCode||address.toLocaleLowerCase()}`
  return {key,label:uniqueQueries[0],address,queries:uniqueQueries,...(countryCode?{countryCode}: {})}
}

type LocatedCandidate = {address:string;time:string;priority:number}

const itemCandidatesForDate = (item:TripItem,date:string):LocatedCandidate[] => {
  const candidates:LocatedCandidate[]=[]
  const startDate=item.start.slice(0,10),endDate=item.end?.slice(0,10)
  if(item.type==='stay'&&item.location&&startDate<=date&&(!endDate||date<=endDate))candidates.push({address:item.location,time:'00:00',priority:1})
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
    if(item.type==='insurance')continue
    if(item.type==='flight'&&item.endLocation&&(item.end||item.start).slice(0,10)<=date)address=item.endLocation
    else if(item.endLocation)address=item.endLocation
    else if(item.location)address=item.location
  }
  return address
}

const nextLocation = (items:TripItem[],date:string) => {
  for(const item of sortTripItems(items)){
    if(item.start.slice(0,10)<date||item.type==='insurance')continue
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
  const targets=new Map<string,WeatherTarget>()
  for(const candidate of candidates){const target=weatherTargetFromAddress(candidate.address);if(target)targets.set(target.key,target)}
  if(targets.size)return [...targets.values()]
  const fallback=weatherTargetFromAddress(previousLocation(items,date)||nextLocation(items,date))
  return fallback?[fallback]:[]
}

export function weatherPlansForDates(items:TripItem[],dates:string[]) {
  return dates.flatMap(date=>weatherTargetsForDate(items,date).map(target=>({date,target})))
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

async function requestLocationWeather(target:WeatherTarget):Promise<LocationWeather> {
  const location=await geocodeWeatherTarget(target)
  const url=new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',String(location.latitude));url.searchParams.set('longitude',String(location.longitude))
  url.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max')
  url.searchParams.set('timezone','auto');url.searchParams.set('forecast_days',String(WEATHER_API_DAYS))
  const response=await fetch(url)
  if(!response.ok)throw new Error(`Weather forecast failed for ${target.label}.`)
  const days=parseDailyWeatherResponse(await response.json())
  if(!days.size)throw new Error(`Weather forecast was incomplete for ${target.label}.`)
  return {target,...location,loadedAt:Date.now(),days}
}

function loadLocationWeather(target:WeatherTarget) {
  const resolved=resolvedForecasts.get(target.key)
  if(resolved&&Date.now()-resolved.loadedAt<weatherCacheMilliseconds)return Promise.resolve(resolved)
  if(resolved)resolvedForecasts.delete(target.key)
  const running=forecastRequests.get(target.key)
  if(running)return running
  const request=requestLocationWeather(target).then(forecast=>{resolvedForecasts.set(target.key,forecast);return forecast}).finally(()=>forecastRequests.delete(target.key))
  forecastRequests.set(target.key,request)
  return request
}

export function useWeatherForecasts(targets:WeatherTarget[],enabled=true,refreshKey:string|number=''):WeatherForecastState {
  const targetKey=targets.map(target=>target.key).sort().join('~')
  const uniqueTargets=useMemo(()=>{
    const found=new Map<string,WeatherTarget>()
    for(const target of targets)found.set(target.key,target)
    return [...found.values()]
  },[targetKey])
  const [state,setState]=useState<WeatherForecastState>({forecasts:new Map(),failedTargets:new Set(),loadingTargets:new Set()})

  useEffect(()=>{
    let cancelled=false
    if(!enabled||!uniqueTargets.length){setState({forecasts:new Map(),failedTargets:new Set(),loadingTargets:new Set()});return()=>{cancelled=true}}
    const forecasts=new Map<string,LocationWeather>(),failedTargets=new Set<string>(),loadingTargets=new Set(uniqueTargets.filter(target=>!resolvedForecasts.has(target.key)).map(target=>target.key))
    for(const target of uniqueTargets){const cached=resolvedForecasts.get(target.key);if(cached)forecasts.set(target.key,cached)}
    setState({forecasts:new Map(forecasts),failedTargets:new Set(),loadingTargets:new Set(loadingTargets)})
    void Promise.allSettled(uniqueTargets.map(async target=>{
      try{const forecast=await loadLocationWeather(target);forecasts.set(target.key,forecast)}catch{failedTargets.add(target.key)}finally{
        loadingTargets.delete(target.key)
        if(!cancelled)setState({forecasts:new Map(forecasts),failedTargets:new Set(failedTargets),loadingTargets:new Set(loadingTargets)})
      }
    }))
    return()=>{cancelled=true}
  },[enabled,targetKey,refreshKey])

  return state
}
