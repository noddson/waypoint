import type { GroundRouteSegment } from './destinations'

export function routeStepFlightFilterId(segment:GroundRouteSegment,index:number) {
  // A single-stop segment represents the destination as a whole. Let its normal
  // destination filter include the local itinerary items as well as both flights.
  if(segment.stops.length===1)return undefined
  const directions:string[]=[]
  if(index===0&&segment.arrivalFlightItemIds?.length)directions.push('arrival')
  if(index===segment.stops.length-1&&segment.departureFlightItemIds?.length)directions.push('departure')
  return directions.length?`flight:${segment.id}:${directions.join('+')}`:undefined
}

export function routeStepFlightItemIds(segment:GroundRouteSegment,index:number) {
  return [
    ...(index===0?segment.arrivalFlightItemIds||[]:[]),
    ...(index===segment.stops.length-1?segment.departureFlightItemIds||[]:[]),
  ]
}
