import { ItemType, TripItem } from './types'

export function itemFromEditor(item:TripItem):TripItem {
  return item
}

export function itemTypeForFilter(filter:ItemType|'all'):ItemType {
  return filter==='all'?'event':filter
}
