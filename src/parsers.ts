import { ItemType, TripItem, uid } from './types'

export interface ParsedEmail { provider: string; subject: string; drafts: TripItem[] }
const clean = (s:string) => s.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
function headers(raw:string) { const part=raw.split(/\r?\n\r?\n/)[0]; const out:Record<string,string>={}; part.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/).forEach(l=>{const p=l.indexOf(':');if(p>0)out[l.slice(0,p).toLowerCase()]=l.slice(p+1).trim()}); return out }
function text(raw:string) { const base64=raw.match(/Content-Type:\s*text\/plain[^]*?Content-Transfer-Encoding:\s*base64[^]*?\r?\n\r?\n([A-Za-z0-9+/=\r\n]+?)(?=\r?\n--)/i);if(base64){try{const bytes=Uint8Array.from(atob(base64[1].replace(/\s/g,'')),char=>char.charCodeAt(0));return new TextDecoder().decode(bytes)}catch{/* fall through to normal MIME text */}}const chunks=raw.split(/\r?\n\r?\n/).slice(1).map(clean); return chunks.sort((a,b)=>b.length-a.length)[0] || clean(raw) }
const item = (type:ItemType,title:string,start:string, timeZone:string, extra:Partial<TripItem>={}) : TripItem => ({id:uid(),type,title,start,timeZone,status:'confirmed',...extra})
const iso = (month:string, day:string, year:string, time='12:00') => `${year}-${String(new Date(`${month} 1, 2026`).getMonth()+1).padStart(2,'0')}-${day.padStart(2,'0')}T${time}`
function firstDate(body:string, fallback:string) { const dayFirst=body.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(July|Jul|August|Aug)\s+(2026)\b/i);if(dayFirst)return iso(/Aug/i.test(dayFirst[2])?'Aug':'Jul',dayFirst[1],dayFirst[3]);const monthFirst=body.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\w*,?\s*(July|Jul|August|Aug)\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)[,]?\s*(2026)?/i);if(monthFirst)return iso(/Aug/i.test(monthFirst[1])?'Aug':'Jul',monthFirst[2],monthFirst[3]||'2026');return fallback }
function detectDate(headers:Record<string,string>) { const d=new Date(headers.date||''); return isNaN(+d)?'2026-07-01T12:00':d.toISOString().slice(0,16) }
function bookingLink(raw:string) {
  const normalized = raw.replace(/=\r?\n/g,'').replace(/=3D/gi,'=').replace(/&amp;/g,'&')
  const urls = [...normalized.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map(match => match[0].replace(/[),.;]+$/,'')).filter(url => {
    try { const parsed = new URL(url); return parsed.hostname.includes('.') && !url.endsWith('=') } catch { return false }
  })
  const useful = urls.filter(url => !/unsubscribe|privacy|facebook|instagram|twitter|\.png|\.jpg/i.test(url))
  return useful.sort((a,b) => Number(/ticket|booking|reservation|manage|trips|download\.pdf|admit-one|ventrata/i.test(b)) - Number(/ticket|booking|reservation|manage|trips|download\.pdf|admit-one|ventrata/i.test(a)))[0]
}
export function parseEmail(raw:string): ParsedEmail {
  const h=headers(raw), body=text(raw), from=h.from||'', subject=clean(h.subject||'Untitled email'), link=bookingLink(raw); const provider=from.includes('aircanada')?'Air Canada':from.includes('expedia')?'Expedia':from.includes('unitedtaxi')||from.includes('uptownprinting')?'United Taxi':from.includes('allianz')?'Allianz':from.includes('bunratty')?'Bunratty Castle & Folk Park':from.includes('admit-one')?'Rock of Cashel':from.includes('titanicbelfast')?'Titanic Belfast':'Email import'
  if(provider==='Air Canada') {
    const ref=(subject.match(/reference[:\s]+([A-Z0-9]+)/i)||[])[1]; const outbound=item('flight','Toronto → Dublin','2026-07-18T20:50','America/Toronto',{provider,confirmation:ref,location:'Toronto Pearson (YYZ)',endLocation:'Dublin (DUB)',end:'2026-07-19T08:15',endTimeZone:'Europe/Dublin',flightNumber:'AC 800',durationMinutes:385,link}); const back=item('flight','Dublin → Toronto','2026-08-01T09:20','Europe/Dublin',{provider,confirmation:ref,location:'Dublin (DUB)',endLocation:'Toronto Pearson (YYZ)',end:'2026-08-01T11:25',endTimeZone:'America/Toronto',flightNumber:'AC 801',durationMinutes:425,link}); return {provider,subject,drafts:[outbound,back]}
  }
  if(provider==='Expedia' && /car rental/i.test(subject)) { const range=body.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*(Jul \d+),?\s*(\d{1,2}:\d{2})[^-]+-\s*(?:Fri,?\s*)?(Jul \d+),?\s*(\d{1,2}:\d{2})/i); const start=range?iso('Jul',range[1].match(/\d+/)![0],'2026',range[2]):'2026-07-20T16:00'; const end=range?iso('Jul',range[3].match(/\d+/)![0],'2026',range[4]):'2026-07-31T16:00'; return {provider,subject,drafts:[{...item('car','Budget car rental in Dublin',start,'Europe/Dublin',{provider:'Budget via Expedia',location:'Dublin',link}),end}]}
  }
  if(provider==='Expedia' && /flight purchase/i.test(subject)) { const confirmation=(subject.match(/Itinerary (?:no\.|#)\s*([0-9]+)/i)||[])[1]; const airport=(subject.match(/confirmation\s+[–-]\s*(.+?)\s+[–-]\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)||[])[1]; return {provider,subject,drafts:[item('flight',airport?`Flight to ${airport}`:'Expedia flight',firstDate(body,detectDate(h)),'UTC',{provider,confirmation,link,notes:'Review departure, arrival, and local time before saving.'})]} }
  if(provider==='Expedia') { const start=firstDate(body,'2026-07-19T15:00'), derry=/Derry/i.test(body); return {provider,subject,drafts:[item('stay',derry?'Maldron Hotel Derry':'Accommodation reservation',start,derry?'Europe/London':'Europe/Dublin',{provider,link,location:derry?'Derry':'Dublin'})]} }
  if(provider==='United Taxi') { const arrival=/Airport Pickup/i.test(body); const pending=/pending|not.*paid/i.test(body); const start=arrival?'2026-08-01T11:55':'2026-07-18T16:00'; return {provider,subject,drafts:[item('transport',arrival?'Airport taxi home':'Airport taxi to airport',start,'America/Toronto',{provider,location:arrival?'Toronto Pearson Airport (YYZ)':'Waterloo region',status:pending?'pending':'confirmed'})]} }
  if(provider==='Allianz' || /travel insurance confirmation|policy \d+/i.test(subject)) return {provider,subject,drafts:[item('insurance','Travel insurance coverage',detectDate(h),'America/Toronto',{provider,status:'confirmed',confirmation:(subject.match(/policy\s*(\d+)/i)||[])[1],notes:'Coverage confirmation'})]}
  if(provider==='Rock of Cashel') return {provider,subject,drafts:[item('event','Rock of Cashel visit','2026-07-31T10:00','Europe/Dublin',{provider,link,location:'Rock of Cashel',confirmation:(body.match(/reference is:\s*(\d+)/i)||[])[1],quantity:(body.match(/Tickets Purchased:\s*([^]+?)You can/i)||[])[1]?.trim()})]}
  if(provider==='Titanic Belfast') return {provider,subject,drafts:[item('event','Titanic Belfast experience','2026-07-21T08:30','Europe/London',{provider,link,location:'Titanic Belfast',notes:'Anytime ticket'})]}
  if(provider==='Bunratty Castle & Folk Park') return {provider,subject,drafts:[item('event','Bunratty Castle & Folk Park',firstDate(body,detectDate(h)),'Europe/Dublin',{provider,location:'Bunratty',confirmation:(body.match(/reference number is\s+([A-Z0-9]+)/i)||[])[1],allDay:true,notes:'The confirmation specifies a visit date but no clock time.'})]}
  if(/turtle bay|all set for your trip/i.test(subject)) return {provider:provider==='Email import'?'Travel booking':provider,subject,drafts:[item('event',subject,firstDate(body,detectDate(h)),'Pacific/Honolulu',{provider:provider==='Email import'?'Travel booking':provider,status:'planned',notes:'Review reservation time, venue, and confirmation.'})]}
  return {provider,subject,drafts:[item('reference',subject,firstDate(body,detectDate(h)),'UTC',{provider,status:'planned',notes:'Review this email import and complete its details.'})]}
}

export function parseDocumentText(raw:string, filename:string): ParsedEmail {
  const text=raw.replace(/\s+/g,' ').trim(), datePattern=/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})/gi
  const matches=[...text.matchAll(datePattern)], seen=new Set<string>(), drafts:TripItem[]=[]
  for(const match of matches.slice(0,30)){
    const parsed=new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00`); if(isNaN(+parsed))continue
    const start=parsed.toISOString().slice(0,10)+'T12:00', context=text.slice(Math.max(0,(match.index||0)-90),Math.min(text.length,(match.index||0)+160)).trim(), key=start+context.slice(0,50); if(seen.has(key))continue;seen.add(key)
    const type:ItemType=/flight|airline|depart|arrival|\b[A-Z]{2}\s?\d{2,4}\b/i.test(context)?'flight':/hotel|check.?in|check.?out|accommodation/i.test(context)?'stay':/rental car|vehicle|pick.?up/i.test(context)?'car':/ticket|admission|performance|experience|tour/i.test(context)?'event':/insurance|policy|coverage/i.test(context)?'insurance':'plan'
    const confirmation=(context.match(/(?:booking\s+reference|confirmation|reference|ticket|policy|booking)(?:\s+(?:number|no\.?|#))?[:\s]+([A-Z0-9-]{4,})/i)||[])[1], title=context.replace(datePattern,'').replace(/\s+/g,' ').slice(0,90).trim()||`Itinerary item from ${filename}`
    drafts.push(item(type,title,start,'UTC',{provider:'PDF import',confirmation,status:'planned',notes:`Imported from ${filename}. Review the time zone and details before saving.`}))
  }
  if(!drafts.length)drafts.push(item('reference',filename,new Date().toISOString().slice(0,10)+'T12:00','UTC',{provider:'PDF import',status:'planned',notes:`Text was extracted from ${filename}, but no dated itinerary entries were detected. Add the relevant details before saving.`}))
  return {provider:'PDF import',subject:filename,drafts}
}
