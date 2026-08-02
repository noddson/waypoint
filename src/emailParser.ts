import { ItemType, TripItem, uid } from './types'

export interface ParsedEmail { provider: string; subject: string; drafts: TripItem[] }

const MAX_EMAIL_LENGTH=2_000_000, MAX_BODY_LENGTH=250_000
const MONTHS:Record<string,number>={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12}
const MONTH_PATTERN=Object.keys(MONTHS).sort((a,b)=>b.length-a.length).join('|')
const limit=(value:string,length:number)=>value.slice(0,length)
const safeText=(value:string)=>limit(value.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/[\u202A-\u202E\u2066-\u2069]/g,'').replace(/[^\S\r\n]+/g,' ').replace(/ *\r?\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim(),MAX_BODY_LENGTH)
const decodeEntities=(value:string)=>value.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const point=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):parseInt(code,10);try{return point>0&&point<=0x10ffff?String.fromCodePoint(point):''}catch{return ''}}).replace(/&(nbsp|amp|lt|gt|quot|apos);/gi,(_,name)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[name.toLowerCase()]||'')
const inertHtmlText=(value:string)=>safeText(decodeEntities(value.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<\/(?:td|th)>\s*<(?:td|th)\b[^>]*>/gi,': ').replace(/<\/?(?:br|p|div|li|tr|table|section|article|h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')))

function decodeBytes(binary:string,charset='utf-8'){const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0)&255);try{return new TextDecoder(charset).decode(bytes)}catch{return new TextDecoder().decode(bytes)}}
function decodeQuotedPrintable(value:string,charset?:string){return decodeBytes(value.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))),charset)}
function decodeBase64(value:string,charset?:string){try{return decodeBytes(atob(value.replace(/\s/g,'')),charset)}catch{return ''}}
function decodeEncodedWords(value:string){return value.replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi,(_,charset,encoding,data)=>encoding.toLowerCase()==='b'?decodeBase64(data,charset):decodeQuotedPrintable(data.replace(/_/g,' '),charset))}

function messageParts(raw:string){
  const match=raw.match(/\r?\n\r?\n/),headerText=match?raw.slice(0,match.index):'',body=match?raw.slice((match.index||0)+match[0].length):raw,headers:Record<string,string>={}
  for(const line of headerText.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/)){const separator=line.indexOf(':');if(separator>0)headers[line.slice(0,separator).trim().toLowerCase()]=decodeEncodedWords(line.slice(separator+1).trim())}
  return {headers,body}
}

type TextPart={kind:'plain'|'html';text:string}
function extractTextParts(raw:string,depth=0):TextPart[]{
  if(depth>6)return []
  const {headers,body}=messageParts(raw),contentType=headers['content-type']||'text/plain',disposition=headers['content-disposition']||''
  if(/attachment/i.test(disposition))return []
  const boundaryMatch=contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i),boundary=boundaryMatch?.[1]||boundaryMatch?.[2]
  if(/^multipart\//i.test(contentType)&&boundary)return body.split(`--${boundary}`).slice(1).filter(part=>part.trim()&&part.trim()!=='--').flatMap(part=>extractTextParts(part.replace(/\r?\n--\s*$/,''),depth+1))
  if(/^message\/rfc822/i.test(contentType))return extractTextParts(body,depth+1)
  if(!/^text\/(?:plain|html)/i.test(contentType))return []
  const charsetMatch=contentType.match(/charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/i),charset=charsetMatch?.[1]||charsetMatch?.[2],encoding=(headers['content-transfer-encoding']||'').toLowerCase()
  const decoded=encoding.includes('base64')?decodeBase64(body,charset):encoding.includes('quoted-printable')?decodeQuotedPrintable(body,charset):body
  return [{kind:/text\/html/i.test(contentType)?'html':'plain',text:decoded}]
}
function emailBody(raw:string){const parts=extractTextParts(raw),plain=parts.filter(part=>part.kind==='plain').map(part=>safeText(part.text)).sort((a,b)=>b.length-a.length)[0];return plain||parts.filter(part=>part.kind==='html').map(part=>inertHtmlText(part.text)).sort((a,b)=>b.length-a.length)[0]||safeText(messageParts(raw).body)}

function bookingLink(raw:string){
  const normalized=raw.slice(0,MAX_EMAIL_LENGTH).replace(/=\r?\n/g,'').replace(/=3D/gi,'=').replace(/&amp;/gi,'&').replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<(?:script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>/gi,' ')
  return [...normalized.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map(match=>match[0].replace(/[),.;]+$/,'')).filter(value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.includes('.')&&value.length<=2048}catch{return false}}).filter(value=>!/unsubscribe|privacy|facebook|instagram|twitter|\.png(?:\?|$)|\.jpe?g(?:\?|$)/i.test(value)).sort((a,b)=>Number(/ticket|booking|reservation|manage|trips|download\.pdf|admit-one|ventrata/i.test(b))-Number(/ticket|booking|reservation|manage|trips|download\.pdf|admit-one|ventrata/i.test(a)))[0]
}

const normalizedLabel=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
function fieldsFrom(text:string){const fields=new Map<string,string>();for(const line of text.split('\n')){const match=line.match(/^\s*([A-Za-z][A-Za-z0-9 /()._#-]{1,48})\s*:\s*(.+?)\s*$/);if(match){const key=normalizedLabel(match[1]);if(!fields.has(key))fields.set(key,limit(safeText(match[2]),500))}}return fields}
function field(fields:Map<string,string>,aliases:string[]){for(const alias of aliases){const key=normalizedLabel(alias);for(const [candidate,value] of fields)if(candidate===key||candidate.startsWith(`${key} `))return value}return undefined}
function exactField(fields:Map<string,string>,aliases:string[]){for(const alias of aliases){const value=fields.get(normalizedLabel(alias));if(value)return value}return undefined}

type Moment={value:string;hasTime:boolean}
const pad=(value:number)=>String(value).padStart(2,'0')
function parseMoment(input:string|undefined,fallbackYear:number):Moment|undefined{
  if(!input)return undefined
  const lower=safeText(input).toLowerCase();let year:number|undefined,month:number|undefined,day:number|undefined,match=lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if(match){year=Number(match[1]);month=Number(match[2]);day=Number(match[3])}
  if(!match){match=lower.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,|\\s)+(20\\d{2})?\\b`,'i'));if(match){month=MONTHS[match[1].toLowerCase()];day=Number(match[2]);year=Number(match[3]||fallbackYear)}}
  if(!match){match=lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:,|\\s)+(20\\d{2})?\\b`,'i'));if(match){day=Number(match[1]);month=MONTHS[match[2].toLowerCase()];year=Number(match[3]||fallbackYear)}}
  if(!match){match=lower.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);if(match){const first=Number(match[1]),second=Number(match[2]);month=first>12?second:first;day=first>12?first:second;year=Number(match[3])}}
  if(!year||!month||!day||month>12||day>31)return undefined
  const twelveHour=lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i),twentyFour=twelveHour?undefined:lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);let hours=12,minutes=0,hasTime=false
  if(twelveHour){hours=Number(twelveHour[1])%12+(twelveHour[3].startsWith('p')?12:0);minutes=Number(twelveHour[2]||0);hasTime=true}else if(twentyFour){hours=Number(twentyFour[1]);minutes=Number(twentyFour[2]);hasTime=true}
  return {value:`${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`,hasTime}
}
function headerYear(headers:Record<string,string>){const value=new Date(headers.date||'');return Number.isNaN(+value)?new Date().getFullYear():value.getFullYear()}
function combinedMoment(fields:Map<string,string>,dateAliases:string[],timeAliases:string[],combinedAliases:string[],fallbackYear:number){const combined=exactField(fields,combinedAliases),date=field(fields,dateAliases),time=field(fields,timeAliases);return parseMoment(combined,fallbackYear)||parseMoment([date,time].filter(Boolean).join(' '),fallbackYear)||parseMoment(date,fallbackYear)}
function firstMoment(text:string,fallbackYear:number){for(const line of text.split('\n').filter(value=>/\b20\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value))){const parsed=parseMoment(line,fallbackYear);if(parsed)return parsed}return undefined}

function inferType(subject:string,body:string):ItemType{const content=`${subject}\n${body}`;if(/\bflight\b|\bboarding\b|\bairline\b|\bdepart(?:ure|ing) airport\b|\b[A-Z]{2}\s?\d{2,4}\b/i.test(content))return 'flight';if(/\bhotel\b|\baccommodation\b|\bcheck[ -]?in\b|\bcheck[ -]?out\b|\blodging\b/i.test(content))return 'stay';if(/\bcar rental\b|\brental vehicle\b|\bvehicle collection\b/i.test(content))return 'car';if(/\btaxi\b|\bnew ride booking\b|\bpick[ -]?up\b|\bdrop[ -]?off\b|\bshuttle\b|\bairport transfer\b/i.test(content))return 'transport';if(/\binsurance\b|\bpolicy number\b|\bcoverage\b/i.test(content))return 'insurance';if(/\bticket\b|\badmission\b|\bevent\b|\btour\b|\bexperience\b|\bperformance\b/i.test(content))return 'event';return 'reference'}
function providerName(from:string,fields:Map<string,string>){const explicit=field(fields,['provider','company','operator','airline','hotel','property']);if(explicit)return limit(inertHtmlText(explicit),100);const decoded=safeText(decodeEncodedWords(from)),display=inertHtmlText(decoded.replace(/<[^>]*@[^>]*>/g,'')).replace(/^"|"$/g,'').trim();if(display&&!/^(?:no[ -]?reply|notifications?|bookings?)$/i.test(display))return limit(display,100);const address=(decoded.match(/<?([^\s<>]+@[^\s<>]+)>?/)||[])[1],host=address?.split('@')[1]?.toLowerCase().replace(/^mail\./,''),name=host?.split('.').slice(-2,-1)[0]?.replace(/[-_]+/g,' ');return name?name.replace(/\b\w/g,letter=>letter.toUpperCase()):'Email import'}
function confirmationFrom(subject:string,body:string,fields:Map<string,string>){
  const direct=field(fields,['booking confirmation','confirmation number','confirmation no','booking reference','booking number','booking no','reservation number','reservation id','ride number','ride id','itinerary number','itinerary no','policy number','order number','reference number']),sources=[direct,subject,body].filter(Boolean) as string[]
  if(direct&&/^[A-Z0-9-]{3,}$/i.test(direct))return limit(direct,100)
  const pattern=/(?=(?:ride\s+booking|booking\s+confirmation|booking\s+reference|booking|confirmation|reference|reservation|itinerary|policy|order|ticket)(?:\s+(?:number|no\.?|id|reference))?\s*(?:is\s*)?(?:[-:#]+\s*)?#?\s*([A-Z0-9][A-Z0-9-]{2,}))/gi
  for(const source of sources){
    for(const match of source.matchAll(pattern)){const candidate=match[1];if(!/^(?:THE|YOUR|NUMBER|PENDING|CONFIRMED|CONFIRMATION|FOR|ITINERARY|POLICY|ORDER|TICKET|REFERENCE|BOOKING|RESERVATION)$/i.test(candidate))return limit(candidate,100)}
    const hash=source===subject?(source.match(/#\s*([A-Z0-9-]{3,})/i)||[])[1]:undefined
    if(hash)return limit(hash,100)
  }
  return undefined
}
function statusFrom(subject:string,body:string):TripItem['status']{const content=`${subject}\n${body}`;return /\bpending\b|\bnot\s+(?:yet\s+)?paid\b|\bawaiting\b|\bpayment required\b/i.test(content)?'pending':/\bconfirmed\b|\bconfirmation\b|\bpaid\b|\bcompleted\b/i.test(content)?'confirmed':'planned'}
function timeZoneFrom(content:string){const iana=(content.match(/\b(?:Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_+-]+\b/)||[])[0];if(iana)return iana;if(/\b(?:Eastern Time|E[DS]T)\b/i.test(content))return 'America/Toronto';if(/\b(?:Irish Time|Dublin Time)\b/i.test(content))return 'Europe/Dublin';if(/\b(?:British Time|London Time|GMT|BST)\b/i.test(content))return 'Europe/London';if(/\b(?:Hawaii Time|HST)\b/i.test(content))return 'Pacific/Honolulu';return 'UTC'}

const startDateAliases=['pickup date','pick up date','departure date','depart date','check in date','check-in date','collection date','start date','event date','visit date','date'],startTimeAliases=['pickup time','pick up time','departure time','depart time','check in time','check-in time','collection time','start time','event time','time'],startCombinedAliases=['pickup','pick up','departure','departing','check in','check-in','collection','starts','start','event date and time','date and time'],endDateAliases=['dropoff date','drop off date','arrival date','return date','check out date','check-out date','end date'],endTimeAliases=['dropoff time','drop off time','arrival time','return time','check out time','check-out time','end time'],endCombinedAliases=['dropoff','drop off','arrival','arriving','return','check out','check-out','ends','end']

function makeDraft(content:string,headers:Record<string,string>,subject:string,provider:string,link:string|undefined,type:ItemType,sharedConfirmation?:string,flightNumber?:string):TripItem{
  const fields=fieldsFrom(content),year=headerYear(headers),start=combinedMoment(fields,startDateAliases,startTimeAliases,startCombinedAliases,year)||firstMoment(content,year),end=combinedMoment(fields,endDateAliases,endTimeAliases,endCombinedAliases,year)
  const origin=field(fields,type==='transport'?['pickup location','pickup address','pick up location','from','origin']:['departure airport','from','origin','location','venue','address']),destination=field(fields,type==='transport'?['dropoff location','drop off location','dropoff address','destination','to']:['arrival airport','to','destination'])
  const confirmation=confirmationFrom(subject,content,fields)||sharedConfirmation,timeZone=timeZoneFrom(`${field(fields,['time zone','timezone'])||''}\n${origin||''}\n${content}`),missing=[!start?'date and time':start&&!start.hasTime?'exact time':timeZone==='UTC'&&!/\b(?:UTC|GMT)\b/.test(content)?'time zone':undefined].filter(Boolean),notes=missing.length?`Imported from email. Review ${missing.join(' and ')} before saving.`:'Imported from email content.',title=type==='flight'&&flightNumber?`${origin||'Flight'} → ${destination||flightNumber}`:subject
  const headerDate=new Date(headers.date||'')
  return {id:uid(),type,title:limit(safeText(title),180),start:start?.value||(Number.isNaN(+headerDate)?new Date():headerDate).toISOString().slice(0,10)+'T12:00',end:end?.value,timeZone,endTimeZone:type==='flight'&&end?timeZone:undefined,provider:limit(provider,100),confirmation,status:statusFrom(subject,content),location:origin?limit(safeText(origin),300):undefined,endLocation:destination?limit(safeText(destination),300):undefined,link,flightNumber,allDay:type==='event'&&!!start&&!start.hasTime,notes}
}
function flightBlocks(body:string){const lines=body.split('\n'),markers=lines.map((line,index)=>({index,number:(line.match(/\b(?:flight(?:\s+(?:number|no\.?|#))?\s*[:#-]?\s*)?([A-Z]{2}\s?\d{2,4})\b/i)||[])[1]})).filter(marker=>marker.number&&/\bflight\b/i.test(lines[marker.index]));if(markers.length<2)return [];return markers.map((marker,index)=>({number:marker.number!.replace(/\s+/g,' ').toUpperCase(),content:lines.slice(marker.index,markers[index+1]?.index||lines.length).join('\n')}))}

export function parseEmail(raw:string):ParsedEmail{
  if(raw.length>MAX_EMAIL_LENGTH)throw new Error('This email is too large to import safely. The maximum size is 2 MB.')
  const {headers}=messageParts(raw),body=emailBody(raw),subject=limit(inertHtmlText(headers.subject||'Untitled email'),180),baseFields=fieldsFrom(body),provider=providerName(headers.from||'',baseFields),link=bookingLink(raw),type=inferType(subject,body),confirmation=confirmationFrom(subject,body,baseFields),segments=type==='flight'?flightBlocks(body):[]
  const drafts=segments.length?segments.map(segment=>makeDraft(segment.content,headers,subject,provider,link,'flight',confirmation,segment.number)):[makeDraft(body,headers,subject,provider,link,type,confirmation)]
  return {provider,subject,drafts}
}
