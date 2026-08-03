import { ItemType, Status, TripItem, types, uid } from './types'
import { safeHttpsLink } from './tripImport'

const statuses:Status[] = ['confirmed','pending','planned']
const object = (value:unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value:unknown,max:number): value is string => typeof value === 'string' && value.length <= max
const optionalString = (value:unknown,max:number) => value === undefined || string(value,max)
const optionalStringFields = ['provider','confirmation','end','endTimeZone','location','endLocation','notes','bookedBy','quantity','flightNumber'] as const

export type ParsedItemJson = {ok:true;items:TripItem[]}|{ok:false;error:string}

function itemError(value:unknown,index:number) {
  const prefix=`Item ${index+1}`
  if(!object(value))return `${prefix} must be a JSON object.`
  if(!types.includes(value.type as ItemType))return `${prefix} needs a supported type: ${types.join(', ')}.`
  if(!string(value.title,500)||!value.title.trim())return `${prefix} needs a non-empty title of 500 characters or fewer.`
  if(!string(value.start,50)||!value.start.trim())return `${prefix} needs a start value such as 2026-08-04T10:00.`
  if(!string(value.timeZone,100)||!value.timeZone.trim())return `${prefix} needs an IANA time zone such as Europe/Dublin.`
  if(!statuses.includes(value.status as Status))return `${prefix} needs a status: confirmed, pending, or planned.`
  if(value.id!==undefined&&(!string(value.id,200)||!value.id.trim()))return `${prefix} has an invalid id.`
  for(const key of optionalStringFields){
    if(!optionalString(value[key],key==='notes'?12_000:2_000))return `${prefix} has an invalid ${key} value.`
  }
  if(value.link!==undefined&&(!string(value.link,4_000)||!safeHttpsLink(value.link)))return `${prefix} link must be a secure https:// URL.`
  if(value.emailLink!==undefined&&(!string(value.emailLink,4_000)||!safeHttpsLink(value.emailLink)))return `${prefix} emailLink must be a secure https:// URL.`
  if(value.allDay!==undefined&&typeof value.allDay!=='boolean')return `${prefix} allDay must be true or false.`
  if(value.durationMinutes!==undefined&&(!Number.isInteger(value.durationMinutes)||Number(value.durationMinutes)<0))return `${prefix} durationMinutes must be a non-negative whole number.`
  if(value.conflictOf!==undefined&&!string(value.conflictOf,2_000))return `${prefix} has an invalid conflictOf value.`
  if(value.conflictSource!==undefined&&value.conflictSource!=='local'&&value.conflictSource!=='drive')return `${prefix} has an invalid conflictSource value.`
  return ''
}

function normalizedItem(value:Record<string,unknown>,createId:()=>string):TripItem {
  const item:TripItem={
    id:createId(),
    type:value.type as ItemType,
    title:value.title as string,
    start:value.start as string,
    timeZone:value.timeZone as string,
    status:value.status as Status,
  }
  for(const key of optionalStringFields)if(value[key]!==undefined)(item[key] as string|undefined)=value[key] as string
  if(value.link!==undefined)item.link=safeHttpsLink(value.link as string)
  if(value.emailLink!==undefined)item.emailLink=safeHttpsLink(value.emailLink as string)
  if(value.allDay!==undefined)item.allDay=value.allDay as boolean
  if(value.durationMinutes!==undefined)item.durationMinutes=value.durationMinutes as number
  return item
}

export function parseTripItemsJson(text:string,createId:()=>string=uid):ParsedItemJson {
  let parsed:unknown
  try{parsed=JSON.parse(text)}catch{return {ok:false,error:'JSON is not valid. Check its quotes, commas, and brackets.'}}
  const values=Array.isArray(parsed)?parsed:object(parsed)&&Array.isArray(parsed.items)?parsed.items:[parsed]
  if(!values.length)return {ok:false,error:'Paste at least one item.'}
  if(values.length>5000)return {ok:false,error:'A single paste can contain at most 5,000 items.'}
  for(const [index,value] of values.entries()){
    const error=itemError(value,index)
    if(error)return {ok:false,error}
  }
  return {ok:true,items:values.map(value=>normalizedItem(value as Record<string,unknown>,createId))}
}

export const formatTripItemJson = (item:TripItem) => JSON.stringify(item,null,2)
