import type { ParsedEmail } from './emailParser'
import { ItemType, TripItem, uid } from './types'

const item=(type:ItemType,title:string,start:string,timeZone:string,extra:Partial<TripItem>={}):TripItem=>({id:uid(),type,title,start,timeZone,status:'confirmed',...extra})

export function parseDocumentText(raw:string,filename:string):ParsedEmail{
  const text=raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/[\u202A-\u202E\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim().slice(0,250_000)
  const datePattern=/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})/gi
  const matches=[...text.matchAll(datePattern)],seen=new Set<string>(),drafts:TripItem[]=[]
  for(const match of matches.slice(0,30)){
    const parsed=new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00`)
    if(Number.isNaN(+parsed))continue
    const start=parsed.toISOString().slice(0,10)+'T12:00',context=text.slice(Math.max(0,(match.index||0)-90),Math.min(text.length,(match.index||0)+160)).trim(),key=start+context.slice(0,50)
    if(seen.has(key))continue
    seen.add(key)
    const type:ItemType=/flight|airline|depart|arrival|\b[A-Z]{2}\s?\d{2,4}\b/i.test(context)?'flight':/hotel|check.?in|check.?out|accommodation/i.test(context)?'stay':/rental car|vehicle|pick.?up/i.test(context)?'car':/ticket|admission|performance|experience|tour/i.test(context)?'event':/insurance|policy|coverage/i.test(context)?'insurance':'plan'
    const confirmation=(context.match(/(?:booking\s+reference|confirmation|reference|ticket|policy|booking)(?:\s+(?:number|no\.?|#))?[:\s]+([A-Z0-9-]{4,})/i)||[])[1],title=context.replace(datePattern,'').replace(/\s+/g,' ').slice(0,90).trim()||`Itinerary item from ${filename}`
    drafts.push(item(type,title,start,'UTC',{provider:'PDF import',confirmation,status:'planned',notes:`Imported from ${filename.slice(0,180)}. Review the time zone and details before saving.`}))
  }
  if(!drafts.length)drafts.push(item('reference',filename.slice(0,180),new Date().toISOString().slice(0,10)+'T12:00','UTC',{provider:'PDF import',status:'planned',notes:`Text was extracted from ${filename.slice(0,180)}, but no dated itinerary entries were detected. Add the relevant details before saving.`}))
  return {provider:'PDF import',subject:filename.slice(0,180),drafts}
}
