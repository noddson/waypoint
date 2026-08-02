import { TripItem, sortTripItems } from './types'

export interface DestinationStop {
  id: string
  label: string
  address: string
}

const countryOrRegion = /^(canada|ireland|republic of ireland|united kingdom|northern ireland|ontario|county .+)$/i
const postalCode = /^(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|[A-Z]\d{2}\s?[A-Z\d]{4})$/i
const venueOrStreet = /(?:\b(?:airport|terminal|hotel|house|apartment|castle|folk park|visitor centre|restaurant|campus|road|street|avenue|drive|place|way|lane|bridge|quay)\b|^\d)/i

const clean = (value:string) => value.replace(/\([^)]*\)/g,' ').replace(/\b[A-Z]{2,3}\d?\b/g,' ').replace(/\s+\d{1,2}$/,'').replace(/\s+/g,' ').trim()

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
  const chunks:DestinationStop[][]=[]
  for(let index=0;index<stops.length-1;index+=10)chunks.push(stops.slice(index,Math.min(index+11,stops.length)))
  return chunks.map(chunk=>{
    const params=new URLSearchParams({api:'1',origin:chunk[0].address,destination:chunk[chunk.length-1].address,travelmode:'driving'})
    const waypoints=chunk.slice(1,-1).map(stop=>stop.address)
    if(waypoints.length)params.set('waypoints',waypoints.join('|'))
    return `https://www.google.com/maps/dir/?${params}`
  })
}
