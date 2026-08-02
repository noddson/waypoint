import { ItemType, TripItem, uid } from './types'

export interface ParsedEmail { provider: string; subject: string; drafts: TripItem[] }

const MAX_EMAIL_LENGTH=2_000_000, MAX_BODY_LENGTH=250_000
const MONTHS:Record<string,number>={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12}
const MONTH_PATTERN=Object.keys(MONTHS).sort((a,b)=>b.length-a.length).join('|')
const limit=(value:string,length:number)=>value.slice(0,length)
const safeText=(value:string)=>limit(value.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/[\u202A-\u202E\u2066-\u2069]/g,'').replace(/[^\S\r\n]+/g,' ').replace(/ *\r?\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim(),MAX_BODY_LENGTH)
const decodeEntities=(value:string)=>value.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const point=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):parseInt(code,10);try{return point>0&&point<=0x10ffff?String.fromCodePoint(point):''}catch{return ''}}).replace(/&(nbsp|amp|lt|gt|quot|apos);/gi,(_,name)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[name.toLowerCase()]||'')
function safeHttpsUrl(value:string|undefined){if(!value||value.length>2048)return undefined;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.includes('.')?url.toString():undefined}catch{return undefined}}
function htmlToSafeMarkdown(value:string){
  const withoutActive=value.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<(?:script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>/gi,' ')
  const links=withoutActive.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi,(_,attributes,labelHtml)=>{const hrefMatch=String(attributes).match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i),href=safeHttpsUrl(decodeEntities(hrefMatch?.[1]||hrefMatch?.[2]||hrefMatch?.[3]||'')),label=decodeEntities(String(labelHtml).replace(/<[^>]*>/g,' ')).trim();return href?`${label||'Link'} (${href})`:label})
  return safeText(decodeEntities(links.replace(/<h[1-6]\b[^>]*>/gi,'\n## ').replace(/<\/h[1-6]\s*>/gi,'\n').replace(/<\/(?:td|th|dt)>\s*<(?:td|th|dd)\b[^>]*>/gi,': ').replace(/<\/?(?:br|p|div|li|tr|table|section|article|dl|dt|dd)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')))
}

function decodeBytes(binary:string,charset='utf-8'){const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0)&255);try{return new TextDecoder(charset).decode(bytes)}catch{return new TextDecoder().decode(bytes)}}
function decodeQuotedPrintable(value:string,charset?:string){return decodeBytes(value.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))),charset)}
function decodeBase64(value:string,charset?:string){try{return decodeBytes(atob(value.replace(/\s/g,'')),charset)}catch{return ''}}
function decodeEncodedWords(value:string){return value.replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi,(_,charset,encoding,data)=>encoding.toLowerCase()==='b'?decodeBase64(data,charset):decodeQuotedPrintable(data.replace(/_/g,' '),charset))}

function messageParts(raw:string){
  const match=raw.match(/\r?\n\r?\n/),headerText=match?raw.slice(0,match.index):'',body=match?raw.slice((match.index||0)+match[0].length):raw,headers:Record<string,string>={}
  for(const line of headerText.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/)){const separator=line.indexOf(':');if(separator>0)headers[line.slice(0,separator).trim().toLowerCase()]=decodeEncodedWords(line.slice(separator+1).trim())}
  return {headers,body}
}

type TextPart={kind:'plain'|'html'|'calendar';text:string}
function calendarText(value:string){
  const unfolded=value.replace(/\r?\n[ \t]/g,''),events=unfolded.split(/BEGIN:VEVENT/i).slice(1).map(section=>section.split(/END:VEVENT/i)[0]),sections=events.length?events:[unfolded]
  return safeText(sections.slice(0,50).map(section=>{
    const properties=new Map<string,{parameters:string;value:string}>()
    for(const line of section.split(/\r?\n/)){const separator=line.indexOf(':');if(separator<1)continue;const descriptor=line.slice(0,separator),[name,...parameters]=descriptor.split(';'),value=line.slice(separator+1).replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');if(!properties.has(name.toUpperCase()))properties.set(name.toUpperCase(),{parameters:parameters.join(';'),value})}
    const moment=(name:string,label:string)=>{const property=properties.get(name);if(!property)return '';const match=property.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/),zone=(property.parameters.match(/TZID=([^;:]+)/i)||[])[1];return match?`${label}: ${match[1]}-${match[2]}-${match[3]}${match[4]?` ${match[4]}:${match[5]}`:''}${zone?`\n${label} Time Zone: ${zone}`:''}`:''}
    return [properties.get('SUMMARY')?.value?`Summary: ${properties.get('SUMMARY')!.value}`:'',moment('DTSTART','Start'),moment('DTEND','End'),properties.get('LOCATION')?.value?`Location: ${properties.get('LOCATION')!.value}`:'',properties.get('DESCRIPTION')?.value||''].filter(Boolean).join('\n')
  }).join('\n'))
}
function extractTextParts(raw:string,depth=0):TextPart[]{
  if(depth>6)return []
  const {headers,body}=messageParts(raw),contentType=headers['content-type']||'text/plain',disposition=headers['content-disposition']||''
  if(/attachment/i.test(disposition)&&!/^text\/calendar/i.test(contentType))return []
  const boundaryMatch=contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i),boundary=boundaryMatch?.[1]||boundaryMatch?.[2]
  if(/^multipart\//i.test(contentType)&&boundary)return body.split(`--${boundary}`).slice(1).filter(part=>part.trim()&&part.trim()!=='--').flatMap(part=>extractTextParts(part.replace(/\r?\n--\s*$/,''),depth+1))
  if(/^message\/rfc822/i.test(contentType))return extractTextParts(body,depth+1)
  if(!/^text\/(?:plain|html|calendar)/i.test(contentType))return []
  const charsetMatch=contentType.match(/charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/i),charset=charsetMatch?.[1]||charsetMatch?.[2],encoding=(headers['content-transfer-encoding']||'').toLowerCase()
  const decoded=encoding.includes('base64')?decodeBase64(body,charset):encoding.includes('quoted-printable')?decodeQuotedPrintable(body,charset):body
  return [{kind:/text\/html/i.test(contentType)?'html':/text\/calendar/i.test(contentType)?'calendar':'plain',text:decoded}]
}
function itineraryScore(text:string,kind:TextPart['kind']){
  const dates=text.match(/\b(?:20\d{2}-\d{1,2}-\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,|\s)+20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2})\b/gi)?.length||0
  const times=text.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi)?.length||0
  const itineraryTerms=text.match(/\b(?:flight|departure|arrival|check[ -]?in|check[ -]?out|pick[ -]?up|drop[ -]?off|booking|confirmation|reservation|itinerary|policy|ticket)\b/gi)?.length||0
  const labeledFields=[...fieldsFrom(text)].length
  return Math.min(dates,12)*12+Math.min(times,16)*4+Math.min(itineraryTerms,24)*2+Math.min(labeledFields,20)*3+Math.min(text.length/4_000,4)+(kind==='plain'?0.25:0)
}
function emailBody(raw:string){
  const candidates=extractTextParts(raw).map(part=>({kind:part.kind,text:part.kind==='html'?htmlToSafeMarkdown(part.text):part.kind==='calendar'?calendarText(part.text):safeText(part.text)})).filter(part=>part.text)
  return candidates.sort((a,b)=>itineraryScore(b.text,b.kind)-itineraryScore(a.text,a.kind)||b.text.length-a.text.length)[0]?.text||safeText(messageParts(raw).body)
}

function bookingLink(raw:string){
  const normalized=raw.slice(0,MAX_EMAIL_LENGTH).replace(/=\r?\n/g,'').replace(/=3D/gi,'=').replace(/&amp;/gi,'&').replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<(?:script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>/gi,' ')
  return [...normalized.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map(match=>match[0].replace(/[),.;]+$/,'')).filter(value=>safeHttpsUrl(value)).filter(value=>!/unsubscribe|privacy|facebook|instagram|twitter|\.png(?:\?|$)|\.jpe?g(?:\?|$)/i.test(value)).sort((a,b)=>Number(/ticket|booking|reservation|manage|trips|download\.pdf|admit-one|ventrata/i.test(b))-Number(/ticket|booking|reservation|manage|trips|download\.pdf|admit-one|ventrata/i.test(a)))[0]
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
  if(!match){match=lower.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(20\\d{2}))?\\b`,'i'));if(match){month=MONTHS[match[1].toLowerCase()];day=Number(match[2]);year=Number(match[3]||fallbackYear)}}
  if(!match){match=lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s*,?\\s*(20\\d{2}))?\\b`,'i'));if(match){day=Number(match[1]);month=MONTHS[match[2].toLowerCase()];year=Number(match[3]||fallbackYear)}}
  if(!match){match=lower.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);if(match){const first=Number(match[1]),second=Number(match[2]);month=first>12?second:first;day=first>12?first:second;year=Number(match[3])}}
  if(!year||!month||!day||month>12||day>31)return undefined
  const twelveHour=lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i),twentyFour=twelveHour?undefined:lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);let hours=12,minutes=0,hasTime=false
  if(twelveHour){hours=Number(twelveHour[1])%12+(twelveHour[3].startsWith('p')?12:0);minutes=Number(twelveHour[2]||0);hasTime=true}else if(twentyFour){hours=Number(twentyFour[1]);minutes=Number(twentyFour[2]);hasTime=true}
  return {value:`${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`,hasTime}
}
function headerYear(headers:Record<string,string>){const value=new Date(headers.date||'');return Number.isNaN(+value)?new Date().getFullYear():value.getFullYear()}
function combinedMoment(fields:Map<string,string>,dateAliases:string[],timeAliases:string[],combinedAliases:string[],fallbackYear:number){const combined=exactField(fields,combinedAliases),date=field(fields,dateAliases),time=field(fields,timeAliases);return parseMoment(combined,fallbackYear)||parseMoment([date,time].filter(Boolean).join(' '),fallbackYear)||parseMoment(date,fallbackYear)}
function timeOnLine(value:string){const twelve=value.toLowerCase().match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i),twentyFour=twelve?undefined:value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);if(twelve)return {hours:Number(twelve[1])%12+(twelve[3].startsWith('p')?12:0),minutes:Number(twelve[2]||0)};if(twentyFour)return {hours:Number(twentyFour[1]),minutes:Number(twentyFour[2])};return undefined}
function momentsFromText(text:string,fallbackYear:number){
  const lines=text.split('\n'),moments:Moment[]=[]
  for(const [index,line] of lines.entries()){
    if(!/\b20\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line))continue
    const parsed=parseMoment(line,fallbackYear);if(!parsed)continue
    if(!parsed.hasTime){for(const offset of [-1,1,-2,2]){const time=timeOnLine(lines[index+offset]||'');if(time){parsed.value=`${parsed.value.slice(0,11)}${pad(time.hours)}:${pad(time.minutes)}`;parsed.hasTime=true;break}}}
    if(!moments.some(moment=>moment.value===parsed.value))moments.push(parsed)
  }
  return moments
}
function firstMoment(text:string,fallbackYear:number){return momentsFromText(text,fallbackYear)[0]}

function inferType(subject:string,body:string):ItemType{const content=`${subject}\n${body}`;if(/\bflight\b|\bboarding\b|\bairline\b|\bdepart(?:ure|ing) airport\b|\b[A-Z]{2}\s?\d{2,4}\b/i.test(content))return 'flight';if(/\bhotel\b|\baccommodation\b|\bcheck[ -]?in\b|\bcheck[ -]?out\b|\blodging\b/i.test(content))return 'stay';if(/\bcar rental\b|\brental vehicle\b|\bvehicle collection\b/i.test(content))return 'car';if(/\btaxi\b|\bnew ride booking\b|\bpick[ -]?up\b|\bdrop[ -]?off\b|\bshuttle\b|\bairport transfer\b/i.test(content))return 'transport';if(/\binsurance\b|\bpolicy number\b|\bcoverage\b/i.test(content))return 'insurance';if(/\bticket\b|\badmission\b|\bevent\b|\btour\b|\bexperience\b|\bperformance\b/i.test(content))return 'event';return 'reference'}
function providerName(from:string,fields:Map<string,string>){const explicit=field(fields,['provider','company','operator','airline','hotel','property']);if(explicit)return limit(htmlToSafeMarkdown(explicit),100);const decoded=safeText(decodeEncodedWords(from)),display=htmlToSafeMarkdown(decoded.replace(/<[^>]*@[^>]*>/g,'')).replace(/^"|"$/g,'').trim();if(display&&!/^(?:no[ -]?reply|notifications?|bookings?)$/i.test(display))return limit(display,100);const address=(decoded.match(/<?([^\s<>]+@[^\s<>]+)>?/)||[])[1],host=address?.split('@')[1]?.toLowerCase().replace(/^mail\./,''),name=host?.split('.').slice(-2,-1)[0]?.replace(/[-_]+/g,' ');return name?name.replace(/\b\w/g,letter=>letter.toUpperCase()):'Email import'}
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
function subjectRoute(subject:string){const match=subject.match(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_PATTERN})\\s+20\\d{2}\\s*:\\s*(.+?)\\s+(?:-|–|—|→|to)\\s+(.+?)(?:\\s*\\(|$)`,'i'));return match?[safeText(match[1]),safeText(match[2])]:[]}
function usefulLocation(value:string|undefined){if(!value)return undefined;const cleaned=limit(safeText(value),300);return /^(?:\d+\s*(?:min(?:ute)?s?|h(?:ou)?rs?)|connection(?:\s+time)?|layover)$/i.test(cleaned)?undefined:cleaned}
function airportLocations(content:string){const values:string[]=[];for(const line of content.split('\n')){if(line.length>160||!/(?:\([A-Z]{3}\)|\b[A-Z]{3}\s+Airport\b)/.test(line)||/\b(?:UTC|GMT|EDT|EST|PST|HST)\b/.test(line))continue;const value=usefulLocation(line.replace(/^(?:from|to|departure|arrival)(?:\s+(?:airport|location))?\s*:\s*/i,''));if(value&&!values.includes(value))values.push(value)}return values.slice(0,2)}
function durationFrom(fields:Map<string,string>,content:string){const value=exactField(fields,['flight duration','total duration','duration'])||((content.match(/\b(?:flight|total)?\s*duration\s*[: -]?\s*([^\n]+)/i)||[])[1]);if(!value)return undefined;const hours=value.match(/\b(\d{1,2})\s*h(?:ours?)?\b/i),minutes=value.match(/\b(\d{1,3})\s*m(?:in(?:ute)?s?)?\b/i),onlyMinutes=value.match(/^\s*(\d{1,4})\s*(?:min(?:ute)?s?)\s*$/i),total=onlyMinutes?Number(onlyMinutes[1]):Number(hours?.[1]||0)*60+Number(minutes?.[1]||0);return total>0&&total<72*60?total:undefined}

const startDateAliases=['pickup date','pick up date','departure date','depart date','check in date','check-in date','collection date','start date','event date','visit date','date'],startTimeAliases=['pickup time','pick up time','departure time','depart time','check in time','check-in time','collection time','start time','event time','time'],startCombinedAliases=['pickup','pick up','departure','departing','check in','check-in','collection','starts','start','event date and time','date and time'],endDateAliases=['dropoff date','drop off date','arrival date','return date','check out date','check-out date','end date'],endTimeAliases=['dropoff time','drop off time','arrival time','return time','check out time','check-out time','end time'],endCombinedAliases=['dropoff','drop off','arrival','arriving','return','check out','check-out','ends','end']

function makeDraft(content:string,headers:Record<string,string>,subject:string,provider:string,link:string|undefined,type:ItemType,sharedConfirmation?:string,flightNumber?:string):TripItem{
  const fields=fieldsFrom(content),year=headerYear(headers),freeMoments=momentsFromText(content,year),start=combinedMoment(fields,startDateAliases,startTimeAliases,startCombinedAliases,year)||freeMoments[0]||firstMoment(subject,year),end=combinedMoment(fields,endDateAliases,endTimeAliases,endCombinedAliases,year)||((type==='flight'||type==='stay'||type==='car'||type==='transport')?freeMoments.find(moment=>moment.value!==start?.value):undefined),[subjectOrigin,subjectDestination]=subjectRoute(subject),[airportOrigin,airportDestination]=type==='flight'?airportLocations(content):[],resolvedFlightNumber=type==='flight'?(flightNumber||exactField(fields,['flight number','flight no','flight'])||(content.match(/\bflight(?:\s+(?:number|no\.?|#))?\s*[:#-]?\s*([A-Z]{2}\s?\d{2,4})\b/i)||[])[1])?.replace(/\s+/g,' ').toUpperCase():undefined
  if(!start&&type!=='reference')throw new Error(`No travel date was found in this ${type} confirmation. No draft was created; review the email content instead.`)
  const origin=usefulLocation(type==='transport'?field(fields,['pickup location','pickup address','pick up location','from','origin']):field(fields,['departure airport','origin','location','venue','address'])||exactField(fields,['from'])||airportOrigin||subjectOrigin),destination=usefulLocation(type==='transport'?field(fields,['dropoff location','drop off location','dropoff address','destination'])||exactField(fields,['to']):field(fields,['arrival airport','destination'])||exactField(fields,['to'])||airportDestination||subjectDestination)
  const confirmation=confirmationFrom(subject,content,fields)||sharedConfirmation,departureZone=exactField(fields,['departure time zone','departure timezone','start time zone','start timezone','time zone','timezone']),arrivalZone=exactField(fields,['arrival time zone','arrival timezone','end time zone','end timezone']),timeZone=timeZoneFrom(`${departureZone||''}\n${origin||''}\n${content}`),endTimeZone=arrivalZone?timeZoneFrom(arrivalZone):undefined,missing=[!start?'date and time':start&&!start.hasTime?'exact time':timeZone==='UTC'&&!/\b(?:UTC|GMT)\b/.test(content)?'time zone':undefined].filter(Boolean),notes=missing.length?`Imported from email. Review ${missing.join(' and ')} before saving.`:'Imported from email content.',title=type==='flight'&&resolvedFlightNumber?`${origin||'Flight'} → ${destination||resolvedFlightNumber}`:subject
  const headerDate=new Date(headers.date||'')
  return {id:uid(),type,title:limit(safeText(title),180),start:start?.value||(Number.isNaN(+headerDate)?new Date():headerDate).toISOString().slice(0,10)+'T12:00',end:end?.value,timeZone,endTimeZone:type==='flight'&&end?endTimeZone:undefined,provider:limit(provider,100),confirmation,status:statusFrom(subject,content),location:origin,endLocation:destination,link,flightNumber:resolvedFlightNumber,durationMinutes:type==='flight'?durationFrom(fields,content):undefined,allDay:!!start&&!start.hasTime,notes}
}
function flightBlocks(body:string){const lines=body.split('\n'),markers=lines.map((line,index)=>({index,number:(line.match(/\b(?:flight(?:\s+(?:number|no\.?|#))?\s*[:#-]?\s*)?([A-Z]{2}\s?\d{2,4})\b/i)||[])[1]})).filter(marker=>marker.number&&(/\bflight\b/i.test(lines[marker.index])||/^\s*[A-Z]{2}\s?\d{2,4}\b/i.test(lines[marker.index])));if(markers.length<2)return [];return markers.map((marker,index)=>({number:marker.number!.replace(/\s+/g,' ').toUpperCase(),content:lines.slice(marker.index,markers[index+1]?.index||lines.length).join('\n')}))}

export function parseEmail(raw:string):ParsedEmail{
  if(raw.length>MAX_EMAIL_LENGTH)throw new Error('This email is too large to import safely. The maximum size is 2 MB.')
  const {headers}=messageParts(raw),body=emailBody(raw),subject=limit(htmlToSafeMarkdown(headers.subject||'Untitled email'),180),baseFields=fieldsFrom(body),provider=providerName(headers.from||'',baseFields),link=bookingLink(raw),type=inferType(subject,body),confirmation=confirmationFrom(subject,body,baseFields),segments=type==='flight'?flightBlocks(body):[]
  const drafts=segments.length?segments.map(segment=>makeDraft(segment.content,headers,subject,provider,link,'flight',confirmation,segment.number)):[makeDraft(body,headers,subject,provider,link,type,confirmation)]
  return {provider,subject,drafts}
}
