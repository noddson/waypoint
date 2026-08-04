export const localDateKey = (date:Date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export function initialTripDayIndex(days:string[],today:string=localDateKey()) {
  if(!days.length||today<days[0]||today>days[days.length-1])return 0
  const todayOrNext=days.findIndex(day=>day>=today)
  return todayOrNext<0?0:todayOrNext
}
