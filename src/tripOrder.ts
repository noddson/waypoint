import { Trip } from './types'

export const tripFirstTravelDate = (trip:Pick<Trip,'items'>) => trip.items.reduce((earliest,item)=>{
  const date=item.start.slice(0,10)
  return !earliest||date<earliest?date:earliest
},'')

export const tripLastTravelDate = (trip:Pick<Trip,'items'>) => trip.items.reduce((latest,item)=>{
  const date=(item.end||item.start).slice(0,10)
  return date>latest?date:latest
},'')

type TripDateSummary = {name:string;travelStart?:string;travelEnd?:string;updatedAt?:string;modifiedTime?:string}

const localToday = () => {
  const now=new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

const tripPeriod = ({travelStart='',travelEnd=''}:TripDateSummary,today:string) => !travelStart&&!travelEnd?3:travelStart&&travelEnd&&travelStart<=today&&travelEnd>=today?0:(travelStart||travelEnd)>today?1:2
const summaryUpdatedAt = (summary:TripDateSummary) => summary.updatedAt||summary.modifiedTime||''

export function compareTripDateSummaries(left:TripDateSummary,right:TripDateSummary,today=localToday()) {
  const period=tripPeriod(left,today)-tripPeriod(right,today)
  if(period)return period
  const category=tripPeriod(left,today)
  const dateOrder=category===0
    ? (left.travelEnd||'').localeCompare(right.travelEnd||'')||(right.travelStart||'').localeCompare(left.travelStart||'')
    : category===1
      ? (left.travelStart||left.travelEnd||'').localeCompare(right.travelStart||right.travelEnd||'')
      : category===2
        ? (right.travelEnd||right.travelStart||'').localeCompare(left.travelEnd||left.travelStart||'')
        : 0
  return dateOrder||summaryUpdatedAt(right).localeCompare(summaryUpdatedAt(left))||left.name.localeCompare(right.name)
}

export const sortTripsByTravelDate = (trips:Trip[],today=localToday()) => [...trips].sort((left,right)=>compareTripDateSummaries(
  {name:left.name,travelStart:tripFirstTravelDate(left),travelEnd:tripLastTravelDate(left),updatedAt:left.updatedAt},
  {name:right.name,travelStart:tripFirstTravelDate(right),travelEnd:tripLastTravelDate(right),updatedAt:right.updatedAt},
  today,
))
