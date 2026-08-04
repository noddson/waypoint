import { TripItem, sortTripItems } from './types'

export interface WaypointDriveItemLink {fileId:string;resourceKey?:string}
export interface WaypointItemLocation {tripId?:string;itemId:string}

const virtualHosts=['zoom.us','meet.google.com','teams.microsoft.com','teams.live.com','webex.com','gotomeeting.com']

export function virtualEventLink(item:TripItem) {
  if(item.type!=='event'||!item.link)return undefined
  try{const host=new URL(item.link).hostname.toLocaleLowerCase();return virtualHosts.some(domain=>host===domain||host.endsWith(`.${domain}`))?item.link:undefined}catch{return undefined}
}

export function buildWaypointItemUrl(baseHref:string,tripId:string,itemId:string,drive?:WaypointDriveItemLink) {
  const url=new URL(baseHref);url.hash='';url.search=''
  if(drive){url.searchParams.set('driveTrip',drive.fileId);if(drive.resourceKey)url.searchParams.set('resourceKey',drive.resourceKey)}
  else url.searchParams.set('tripId',tripId)
  url.searchParams.set('item',itemId)
  return url.toString()
}

export function waypointItemFromUrl(href:string):WaypointItemLocation|undefined {
  try{const params=new URL(href).searchParams,itemId=params.get('item');return itemId?{tripId:params.get('tripId')||undefined,itemId}:undefined}catch{return undefined}
}

export const waypointItemAnchorId = (itemId:string) => `waypoint-item-${encodeURIComponent(itemId).replace(/%/g,'_')}`

export function waypointItemDayIndex(items:TripItem[],itemId:string) {
  const item=items.find(value=>value.id===itemId);if(!item)return -1
  const days=[...new Set(sortTripItems(items).map(value=>value.start.slice(0,10)))]
  return days.indexOf(item.start.slice(0,10))
}
