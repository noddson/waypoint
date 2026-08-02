import { TripItem, sortTripItems } from './types'

export interface DestinationStop {
  id: string
  label: string
}

const countryOrRegion = /^(canada|ireland|republic of ireland|united kingdom|northern ireland|ontario|county .+)$/i
const postalCode = /^(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|[A-Z]\d{2}\s?[A-Z\d]{4})$/i
const venueOrStreet = /(?:\b(?:airport|terminal|hotel|house|apartment|castle|folk park|visitor centre|restaurant|campus|road|street|avenue|drive|place|way|lane|bridge|quay)\b|^\d)/i

const clean = (value:string) => value.replace(/\([^)]*\)/g,' ').replace(/\b[A-Z]{2,3}\d?\b/g,' ').replace(/\s+/g,' ').trim()

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

export function tripDestinations(items:TripItem[]):DestinationStop[] {
  const seen=new Set<string>(),stops:DestinationStop[]=[]
  for(const item of sortTripItems(items))for(const label of itemDestinationLabels(item)){
    const id=label.toLocaleLowerCase()
    if(!seen.has(id)){seen.add(id);stops.push({id,label})}
  }
  return stops
}

export const itemMatchesDestination = (item:TripItem,destinationId:string) => itemDestinationLabels(item).some(label=>label.toLocaleLowerCase()===destinationId)

export const googleMapsSearchUrl = (address:string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
