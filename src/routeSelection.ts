import type { GroundRouteSegment } from './destinations'

export function routeStepFlightFilterId(segment:GroundRouteSegment,index:number) {
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
