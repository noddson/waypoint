import { TripItem } from './types'

export function itemFromEditor(item:TripItem):TripItem {
  if(item.type!=='stay')return item
  return {...item,endLocation:item.location||undefined}
}
