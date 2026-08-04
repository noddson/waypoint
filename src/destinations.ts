import { TripItem, sortTripItems } from './types'
import { MapProvider } from './mapProvider'

export interface DestinationStop {
  id: string
  label: string
  address: string
  mapQuery?: string
}

export interface GroundRouteSegment {
  id: string
  label: string
  stops: DestinationStop[]
  mapStops?: DestinationStop[]
  arrivalFlightRoute?: string[]
  departureFlightRoute?: string[]
  arrivalFlightItemIds?: string[]
  departureFlightItemIds?: string[]
}

const postalCode = /^(?:\d{5}(?:-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|[A-Z]\d{2}\s?[A-Z\d]{4})$/i
const trailingPostalCode = /(?:\s+\d{5}(?:-\d{4})?|\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d|\s+[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i
const venueOrStreet = /(?:\b(?:airport|terminal|hotel|resort|lodge|inn|house|apartment|castle|folk park|visitor centre|restaurant|campus|road|street|avenue|boulevard|drive|highway|hwy|place|way|lane|bridge|quay|court|circle|terrace|trail)\b|^\d)/i

const regionAliases:Record<string,string> = Object.fromEntries([
  'AL:Alabama','AK:Alaska','AZ:Arizona','AR:Arkansas','CA:California','CO:Colorado','CT:Connecticut','DE:Delaware','FL:Florida','GA:Georgia','HI:Hawaii','ID:Idaho','IL:Illinois','IN:Indiana','IA:Iowa','KS:Kansas','KY:Kentucky','LA:Louisiana','ME:Maine','MD:Maryland','MA:Massachusetts','MI:Michigan','MN:Minnesota','MS:Mississippi','MO:Missouri','MT:Montana','NE:Nebraska','NV:Nevada','NH:New Hampshire','NJ:New Jersey','NM:New Mexico','NY:New York','NC:North Carolina','ND:North Dakota','OH:Ohio','OK:Oklahoma','OR:Oregon','PA:Pennsylvania','RI:Rhode Island','SC:South Carolina','SD:South Dakota','TN:Tennessee','TX:Texas','UT:Utah','VT:Vermont','VA:Virginia','WA:Washington','WV:West Virginia','WI:Wisconsin','WY:Wyoming','DC:District of Columbia',
  'AB:Alberta','BC:British Columbia','MB:Manitoba','NB:New Brunswick','NL:Newfoundland and Labrador','NS:Nova Scotia','NT:Northwest Territories','NU:Nunavut','ON:Ontario','PE:Prince Edward Island','QC:Quebec','SK:Saskatchewan','YT:Yukon',
].flatMap(value=>{const [code,label]=value.split(':');return [[code.toLocaleLowerCase(),label],[label.toLocaleLowerCase(),label]]}))

const namedRegions = new Set(['canada','ireland','republic of ireland','united kingdom','northern ireland','england','scotland','wales',...Object.keys(regionAliases)])
const regionPart = (value:string) => value.trim().replace(trailingPostalCode,'').trim()
const knownRegion = (value:string) => regionAliases[regionPart(value).toLocaleLowerCase()]
const countryOrRegion = (value:string) => namedRegions.has(regionPart(value).toLocaleLowerCase())||/^county .+$/i.test(value)

const broadRegionLabel = (address:string) => {
  const parts=address.split(',').map(regionPart).filter(Boolean)
  const subdivision=parts.map(knownRegion).find(Boolean)
  if(subdivision)return subdivision
  const last=parts[parts.length-1]
  return last&&!postalCode.test(last)&&!venueOrStreet.test(last)?last:undefined
}

const clean = (value:string) => value.replace(/\([^)]*\)/g,' ').replace(/\b[A-Z]{2,3}\d?\b/g,' ').replace(/\s+\d{1,2}$/,'').replace(/^(?:downtown|city centre|city center)\s+/i,'').replace(/\s+/g,' ').trim()
const uppercaseCode = (value?:string) => value&&value===value.toUpperCase()?value:undefined
const airportCode = (value:string) => {
  if(!/\bairport\b/i.test(value))return undefined
  const explicit=value.match(/[([]\s*([A-Z]{3})\s*[)\]]/i)?.[1]
    ||value.match(/\bIATA(?:\s+code)?\s*[:\-]?\s*([A-Z]{3})\b/i)?.[1]
  const code=explicit
    ||uppercaseCode(value.match(/^\s*([A-Z]{3})\b(?=.*\bairport\b)/i)?.[1])
    ||uppercaseCode(value.match(/\b([A-Z]{3})\s+(?:international\s+)?airport\b/i)?.[1])
    ||uppercaseCode(value.match(/\bairport\b\s*(?:[-–—|/,:]\s*)?([A-Z]{3})\b/i)?.[1])
  return code?.toUpperCase()
}

export function destinationLabel(value?:string) {
  if(!value)return undefined
  const airport=value.match(/^(.+?)(?:\s+Pearson)?(?:\s+International)?\s+Airport\b/i),code=airportCode(value)
  if(code)return code
  if(airport){
    const city=value.split(',').slice(1).map(clean).find(part=>part&&!countryOrRegion(part)&&!postalCode.test(part)&&!venueOrStreet.test(part))
    return city||clean(airport[1])||undefined
  }
  const parts=value.split(',').map(clean).filter(Boolean)
  const candidates=parts.filter(part=>!countryOrRegion(part)&&!postalCode.test(part)&&!venueOrStreet.test(part))
  return candidates.sort((a,b)=>a.length-b.length)[0]||parts.find(part=>!countryOrRegion(part)&&!postalCode.test(part))
}

export function itemDestinationLabels(item:TripItem) {
  return [destinationLabel(item.location),destinationLabel(item.endLocation)].filter((value,index,all):value is string=>!!value&&all.indexOf(value)===index)
}

export const mapLocationQuery = (item:TripItem,address:string) => {
  const value=address.trim(),provider=item.type==='stay'?item.provider?.trim():undefined
  if(!provider)return value
  const normalizedValue=value.toLocaleLowerCase(),normalizedProvider=provider.toLocaleLowerCase()
  return normalizedValue===normalizedProvider||normalizedValue.startsWith(`${normalizedProvider},`)||normalizedValue.startsWith(`${normalizedProvider} `)?value:`${provider}, ${value}`
}

const destinationStop = (address?:string,mapQuery?:string) => {const label=destinationLabel(address);return label&&address?{id:label.toLocaleLowerCase(),label,address,...(mapQuery&&mapQuery!==address?{mapQuery}: {})}:undefined}
const itemDestinationStops = (item:TripItem) => [item.location,item.endLocation].map(address=>destinationStop(address,address?mapLocationQuery(item,address):undefined)).filter((value):value is DestinationStop=>!!value)
const sameAddress = (left:string,right:string) => left.toLocaleLowerCase().replace(/\s+/g,' ').trim()===right.toLocaleLowerCase().replace(/\s+/g,' ').trim()
const appendRouteStop = (route:DestinationStop[],stop?:DestinationStop) => {if(stop&&route[route.length-1]?.id!==stop.id)route.push(stop)}
const appendWaypoint = (route:DestinationStop[],stop?:DestinationStop) => {if(stop&&!sameAddress(route[route.length-1]?.address||'',stop.address))route.push(stop)}
const routeItem = (item:TripItem) => item.type!=='flight'&&item.type!=='insurance'
const airportRouteCode = (address?:string) => {const label=destinationLabel(address);return label&&/^[A-Z]{3}$/.test(label)?label:undefined}

const tripFlightRoutes = (items:TripItem[]) => {
  const routes:Array<{codes:string[];itemIds:string[]}>=[]
  let current:{codes:string[];itemIds:string[]}|undefined
  for(const item of sortTripItems(items)){
    if(item.type==='flight'){
      if(!current){current={codes:[],itemIds:[]};routes.push(current)}
      current.itemIds.push(item.id)
      for(const code of [airportRouteCode(item.location),airportRouteCode(item.endLocation)])if(code&&current.codes[current.codes.length-1]!==code)current.codes.push(code)
    }else if(routeItem(item)&&itemDestinationStops(item).length)current=undefined
  }
  return routes
}

const segmentLabel = (stops:DestinationStop[]) => {
  const regions=new Map<string,{label:string,count:number}>()
  for(const stop of stops){const label=broadRegionLabel(stop.address);if(!label)continue;const key=label.toLocaleLowerCase(),current=regions.get(key);regions.set(key,{label,count:(current?.count||0)+1})}
  const broadRegion=[...regions.values()].sort((left,right)=>right.count-left.count||left.label.localeCompare(right.label))[0]
  if(broadRegion)return broadRegion.label
  const cities=new Map<string,{label:string,count:number}>()
  for(const stop of stops){const current=cities.get(stop.id);cities.set(stop.id,{label:stop.label,count:(current?.count||0)+1})}
  if(cities.size===1)return stops[0].label
  const dominantCity=[...cities.values()].sort((left,right)=>right.count-left.count)[0]
  if(dominantCity.count/stops.length>=0.6)return dominantCity.label
  const areas=new Map<string,{label:string,count:number}>()
  for(const stop of stops){
    const parts=stop.address.split(',').map(clean).filter(Boolean)
    const preferred=parts.find(part=>/^(?:scotland|wales|northern ireland|england)$/i.test(part))||parts[parts.length-1]
    if(!preferred||postalCode.test(preferred))continue
    const key=preferred.toLocaleLowerCase(),current=areas.get(key)
    areas.set(key,{label:preferred,count:(current?.count||0)+1})
  }
  return [...areas.values()].sort((left,right)=>right.count-left.count||left.label.localeCompare(right.label))[0]?.label||`${stops[0].label} to ${stops[stops.length-1].label}`
}

export function tripGroundRouteSegments(items:TripItem[]):GroundRouteSegment[] {
  const sorted=sortTripItems(items),flights=sorted.filter(item=>item.type==='flight')
  if(!flights.length){
    const stops:DestinationStop[]=[],mapStops:DestinationStop[]=[]
    for(const item of sorted.filter(routeItem))for(const stop of itemDestinationStops(item)){appendRouteStop(stops,stop);appendWaypoint(mapStops,stop)}
    return stops.length?[{id:'ground-1',label:segmentLabel(stops),stops,mapStops}]:[]
  }

  const segments:GroundRouteSegment[]=[]
  let pendingArrival:DestinationStop|undefined,current:DestinationStop[]=[],currentMap:DestinationStop[]=[]
  let groundSinceFlight=false,seenFlight=false
  const finishSegment=(departure?:DestinationStop)=>{
    if(!groundSinceFlight)return
    appendRouteStop(current,departure);appendWaypoint(currentMap,departure)
    if(current.length)segments.push({id:`ground-${segments.length+1}`,label:segmentLabel(current),stops:current,mapStops:currentMap})
    current=[];currentMap=[];groundSinceFlight=false
  }

  for(const item of sorted){
    if(item.type==='flight'){
      if(seenFlight)finishSegment(destinationStop(item.location))
      current=[];currentMap=[];groundSinceFlight=false;pendingArrival=destinationStop(item.endLocation);seenFlight=true
      continue
    }
    if(!seenFlight||!routeItem(item))continue
    const stops=itemDestinationStops(item)
    if(!stops.length)continue
    if(!current.length)appendRouteStop(current,pendingArrival)
    if(!currentMap.length)appendWaypoint(currentMap,pendingArrival)
    for(const stop of stops){appendRouteStop(current,stop);appendWaypoint(currentMap,stop)}
    groundSinceFlight=true
  }

  // A final ground section is useful for a one-way itinerary. For a round trip,
  // omit the short airport-to-home tail after returning to the original city.
  const firstOrigin=destinationStop(flights[0].location),lastArrival=destinationStop(flights[flights.length-1].endLocation)
  if(firstOrigin?.id!==lastArrival?.id)finishSegment()
  const flightRoutes=tripFlightRoutes(sorted)
  return segments.map((segment,index)=>({...segment,arrivalFlightRoute:flightRoutes[index]?.codes,departureFlightRoute:flightRoutes[index+1]?.codes,arrivalFlightItemIds:flightRoutes[index]?.itemIds,departureFlightItemIds:flightRoutes[index+1]?.itemIds}))
}

export function tripRouteStops(items:TripItem[]):DestinationStop[] {
  const route:DestinationStop[]=[]
  for(const item of sortTripItems(items))for(const stop of itemDestinationStops(item)){
    if(route[route.length-1]?.id!==stop.id)route.push(stop)
  }
  const flights=sortTripItems(items.filter(item=>item.type==='flight'))
  if(!flights.length)return route
  const origin=destinationLabel(flights[0].location)?.toLocaleLowerCase()
  const destination=destinationLabel(flights[flights.length-1]?.endLocation)?.toLocaleLowerCase()
  const first=origin?route.findIndex(stop=>stop.id===origin):-1
  let last=-1
  if(destination)for(let index=route.length-1;index>=0;index--)if(route[index].id===destination){last=index;break}
  return first>=0&&last>=first?route.slice(first,last+1):route
}

export function dayWaypointStops(items:TripItem[]):DestinationStop[] {
  const route:DestinationStop[]=[]
  for(const item of sortTripItems(items).filter(routeItem))for(const stop of itemDestinationStops(item))appendWaypoint(route,stop)
  return route
}

export function tripDestinations(items:TripItem[]):DestinationStop[] {
  const seen=new Set<string>()
  return tripRouteStops(items).filter(stop=>!seen.has(stop.id)&&!!seen.add(stop.id))
}

export const itemMatchesDestination = (item:TripItem,destinationId:string) => itemDestinationLabels(item).some(label=>label.toLocaleLowerCase()===destinationId)

export const googleMapsSearchUrl = (address:string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
export const appleMapsSearchUrl = (address:string) => `https://maps.apple.com/?q=${encodeURIComponent(address)}`
export const mapSearchUrl = (address:string,provider:MapProvider='google') => provider==='apple'?appleMapsSearchUrl(address):googleMapsSearchUrl(address)
const googleMapsStopQuery = (stop:DestinationStop) => stop.mapQuery||stop.address

export function googleMapsDirectionsUrls(stops:DestinationStop[]) {
  if(stops.length<2)return stops[0]?[googleMapsSearchUrl(googleMapsStopQuery(stops[0]))]:[]
  const maximumLegs=10,totalLegs=stops.length-1,linkCount=Math.ceil(totalLegs/maximumLegs),chunks:DestinationStop[][]=[]
  let start=0
  for(let link=0;link<linkCount;link++){
    const linksLeft=linkCount-link,legsLeft=totalLegs-start,ideal=Math.round(legsLeft/linksLeft)
    const minimum=Math.max(1,legsLeft-maximumLegs*(linksLeft-1)),maximum=Math.min(maximumLegs,legsLeft-(linksLeft-1))
    let legCount=Math.max(minimum,Math.min(maximum,ideal))
    const candidates:Array<{legs:number,distance:number}> = []
    for(let legs=minimum;legs<=maximum;legs++){
      const boundary=start+legs
      if(boundary>=stops.length-1||stops[boundary-1]?.id!==stops[boundary]?.id)candidates.push({legs,distance:Math.abs(legs-ideal)})
    }
    if(candidates.length)legCount=candidates.sort((left,right)=>left.distance-right.distance||right.legs-left.legs)[0].legs
    chunks.push(stops.slice(start,start+legCount+1));start+=legCount
  }
  return chunks.map(chunk=>{
    const params=new URLSearchParams({api:'1',origin:googleMapsStopQuery(chunk[0]),destination:googleMapsStopQuery(chunk[chunk.length-1]),travelmode:'driving'})
    const waypoints=chunk.slice(1,-1).map(googleMapsStopQuery)
    if(waypoints.length)params.set('waypoints',waypoints.join('|'))
    return `https://www.google.com/maps/dir/?${params}`
  })
}

export const mapDirectionsUrls = (stops:DestinationStop[],provider:MapProvider='google') => provider==='apple'?[]:googleMapsDirectionsUrls(stops)
