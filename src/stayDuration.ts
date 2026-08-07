import type { TripItem } from './types'
import { currentLanguage, LanguageCode, uiMessage } from './i18n'

const millisecondsPerDay=86_400_000

function calendarDay(value:string) {
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if(!match)return undefined
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
  const date=new Date(Date.UTC(year,month-1,day))
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return undefined
  return date.getTime()/millisecondsPerDay
}

export function stayNightCount(start:string,end?:string) {
  if(!end)return undefined
  const first=calendarDay(start),last=calendarDay(end)
  if(first===undefined||last===undefined||last<=first)return undefined
  return last-first
}

export function multiNightStayLabel(item:Pick<TripItem,'type'|'start'|'end'>,language:LanguageCode=currentLanguage()) {
  if(item.type!=='stay')return undefined
  const nights=stayNightCount(item.start,item.end)
  return nights&&nights>1?uiMessage(nights===1?'{count} night':'{count} nights',language,{count:nights}):undefined
}
