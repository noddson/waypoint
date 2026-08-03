import { Trip } from './types'

export const tripLastTravelDate = (trip:Pick<Trip,'items'>) => trip.items.reduce((latest,item)=>{
  const date=(item.end||item.start).slice(0,10)
  return date>latest?date:latest
},'')

export const compareLastTravelDates = (left='',right='') => {
  if(!left||!right)return left?1:right?-1:0
  return right.localeCompare(left)
}

export const sortTripsByLastTravelDate = (trips:Trip[]) => [...trips].sort((left,right)=>
  compareLastTravelDates(tripLastTravelDate(left),tripLastTravelDate(right))
  ||right.updatedAt.localeCompare(left.updatedAt)
  ||left.name.localeCompare(right.name)
)
