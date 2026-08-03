import { TripItem, sortTripItems } from './types'

export interface DestinationStop {
  id: string
  label: string
  address: string
}

export interface GroundRouteSegment {
  id: string
  label: string
  stops: DestinationStop[]
}

const countryOrRegion = /^(canada|ireland|republic of ireland|united kingdom|northern ireland|alberta|british columbia|manitoba|new brunswick|newfoundland and labrador|nova scotia|ontario|prince edward island|quebec|saskatchewan|county .+)$/i
const postalCode = /^(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|[A-Z]\d{2}\s?[A-Z\d]{4})$/i
const venueOrStreet = /(?:\b(?:airport|terminal|hotel|house|apartment|castle|folk park|visitor centre|restaurant|campus|road|street|avenue|drive|place|way|lane|bridge|quay)\b|^\d)/i

const clean = (value:string) => value.replace(/\([^)]*\)/g,' ').replace(/\b[A-Z]{2,3}\d?\b/g,' ').replace(/\s+\d{1,2}$/,'').replace(/^(?:downtown|city centre|city center)\s+/i,'').replace(/\s+/g,' ').trim()

export function destinationLabel(value?:string) {
  if(!value)return undefined
  const airport=value.match(/^(.+?)(?:\s+Pearson)?(?:\s+International)?\s+Airport\b/i)
  if(airport)return clean(airport[1])||undefined
  const parts=value.split(',').map(clean).filter(Boolean)
  const candidates=parts.filter(part=>!countryOrRegion.test(part)&&!postalCode.test(part)&&!venueOrStreet.test(part))
  return candidates.sort((a,b)=>a.length-b.length)[0]||parts.find(part=>!countryOrRegion.test(part)&&!postalCode.test(part))
}

export function itemDestinationLabels(item:TripItem) {
  return [destinationLabel(item.location),destinationLabel(item.endLocation)].filter((value,index,all):value is string=>!!value&&all.indexOf(value)===index)
}

const destinationStop = (address?:string) => {const label=destinationLabel(address);return label&&address?{id:label.toLocaleLowerCase(),label,address}:undefined}
const itemDestinationStops = (item:TripItem) => [destinationStop(item.location),destinationStop(item.endLocation)].filter((value):value is DestinationStop=>!!value)
const sameAddress = (left:string,right:string) => left.toLocaleLowerCase().replace(/\s+/g,' ').trim()===right.toLocaleLowerCase().replace(/\s+/g,' ').trim()
const appendRouteStop = (route:DestinationStop[],stop?:DestinationStop) => {if(stop&&!sameAddress(route[route.length-1]?.address||'',stop.address))route.push(stop)}
const routeItem = (item:TripItem) => item.type!=='flight'&&item.type!=='insurance'&&item.type!=='reference'

const segmentLabel = (stops:DestinationStop[]) => {
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
    const stops:DestinationStop[]=[]
    for(const item of sorted.filter(routeItem))for(const stop of itemDestinationStops(item))appendRouteStop(stops,stop)
    return stops.length?[{id:'ground-1',label:segmentLabel(stops),stops}]:[]
  }

  const segments:GroundRouteSegment[]=[]
  let pendingArrival:DestinationStop|undefined,current:DestinationStop[]=[]
  let groundSinceFlight=false,seenFlight=false
  const finishSegment=(departure?:DestinationStop)=>{
    if(!groundSinceFlight)return
    appendRouteStop(current,departure)
    if(current.length)segments.push({id:`ground-${segments.length+1}`,label:segmentLabel(current),stops:current})
    current=[];groundSinceFlight=false
  }

  for(const item of sorted){
    if(item.type==='flight'){
      if(seenFlight)finishSegment(destinationStop(item.location))
      current=[];groundSinceFlight=false;pendingArrival=destinationStop(item.endLocation);seenFlight=true
      continue
    }
    if(!seenFlight||!routeItem(item))continue
    const stops=itemDestinationStops(item)
    if(!stops.length)continue
    if(!current.length)appendRouteStop(current,pendingArrival)
    for(const stop of stops)appendRouteStop(current,stop)
    groundSinceFlight=true
  }

  // A final ground section is useful for a one-way itinerary. For a round trip,
  // omit the short airport-to-home tail after returning to the original city.
  const firstOrigin=destinationStop(flights[0].location),lastArrival=destinationStop(flights[flights.length-1].endLocation)
  if(firstOrigin?.id!==lastArrival?.id)finishSegment()
  return segments
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

export function tripDestinations(items:TripItem[]):DestinationStop[] {
  const seen=new Set<string>()
  return tripRouteStops(items).filter(stop=>!seen.has(stop.id)&&!!seen.add(stop.id))
}

export const itemMatchesDestination = (item:TripItem,destinationId:string) => itemDestinationLabels(item).some(label=>label.toLocaleLowerCase()===destinationId)

export const googleMapsSearchUrl = (address:string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

export function googleMapsDirectionsUrls(stops:DestinationStop[]) {
  if(stops.length<2)return stops[0]?[googleMapsSearchUrl(stops[0].address)]:[]
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
    const params=new URLSearchParams({api:'1',origin:chunk[0].address,destination:chunk[chunk.length-1].address,travelmode:'driving'})
    const waypoints=chunk.slice(1,-1).map(stop=>stop.address)
    if(waypoints.length)params.set('waypoints',waypoints.join('|'))
    return `https://www.google.com/maps/dir/?${params}`
  })
}
