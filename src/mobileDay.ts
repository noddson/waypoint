export const localDateKey = (date:Date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export function initialTripDayIndex(days:string[],today:string=localDateKey()) {
  if(!days.length||today<days[0]||today>days[days.length-1])return 0
  const todayOrNext=days.findIndex(day=>day>=today)
  return todayOrNext<0?0:todayOrNext
}

export function initialTripEntryIndex(starts:string[],today:string=localDateKey()) {
  if(!starts.length)return 0
  const days=starts.map(start=>start.slice(0,10))
  if(today<days[0]||today>days[days.length-1])return 0
  const todayOrNext=days.findIndex(day=>day>=today)
  return todayOrNext<0?0:todayOrNext
}

export function tripEntryIndexAfterSwipe(current:number,deltaX:number,count:number) {
  if(count<=0||deltaX===0)return 0
  return deltaX>0?Math.min(current+1,count-1):Math.max(current-1,0)
}
