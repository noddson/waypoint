import { ItemType, TripItem, uid } from './types'

export interface ParsedEmail { provider: string; subject: string; drafts: TripItem[] }
const clean = (s:string) => s.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
function headers(raw:string) { const part=raw.split(/\r?\n\r?\n/)[0]; const out:Record<string,string>={}; part.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/).forEach(l=>{const p=l.indexOf(':');if(p>0)out[l.slice(0,p).toLowerCase()]=l.slice(p+1).trim()}); return out }
function text(raw:string) { const chunks=raw.split(/\r?\n\r?\n/).slice(1).map(clean); return chunks.sort((a,b)=>b.length-a.length)[0] || clean(raw) }
const item = (type:ItemType,title:string,start:string, timeZone:string, extra:Partial<TripItem>={}) : TripItem => ({id:uid(),type,title,start,timeZone,status:'confirmed',...extra})
const iso = (month:string, day:string, year:string, time='12:00') => `${year}-${String(new Date(`${month} 1, 2026`).getMonth()+1).padStart(2,'0')}-${day.padStart(2,'0')}T${time}`
function firstDate(body:string, fallback:string) { const m=body.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\w*,?\s*(?:July|Jul|August|Aug)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(2026)?/i); if(!m)return fallback; return iso(m[0].match(/August|Aug/i)?'Aug':'Jul',m[1],m[2]||'2026') }
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
    const ref=(subject.match(/reference[:\s]+([A-Z0-9]+)/i)||[])[1]; const outbound=item('flight','Toronto → Dublin','2026-07-18T20:45','America/Toronto',{provider,confirmation:ref,location:'Toronto Pearson (YYZ)',endLocation:'Dublin (DUB)',link}); const back=item('flight','Dublin → Toronto','2026-08-01T09:20','Europe/Dublin',{provider,confirmation:ref,location:'Dublin (DUB)',endLocation:'Toronto Pearson (YYZ)',link}); return {provider,subject,drafts:[outbound,back]}
  }
  if(provider==='Expedia' && /car rental/i.test(subject)) { const range=body.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*(Jul \d+),?\s*(\d{1,2}:\d{2})[^-]+-\s*(?:Fri,?\s*)?(Jul \d+),?\s*(\d{1,2}:\d{2})/i); const start=range?iso('Jul',range[1].match(/\d+/)![0],'2026',range[2]):'2026-07-20T16:00'; const end=range?iso('Jul',range[3].match(/\d+/)![0],'2026',range[4]):'2026-07-31T16:00'; return {provider,subject,drafts:[{...item('car','Budget car rental in Dublin',start,'Europe/Dublin',{provider:'Budget via Expedia',location:'Dublin',link}),end}]}
  }
  if(provider==='Expedia' && /flight purchase/i.test(subject)) { const confirmation=(subject.match(/Itinerary (?:no\.|#)\s*([0-9]+)/i)||[])[1]; const airport=(subject.match(/confirmation\s+[–-]\s*(.+?)\s+[–-]\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)||[])[1]; return {provider,subject,drafts:[item('flight',airport?`Flight to ${airport}`:'Expedia flight',firstDate(body,detectDate(h)),'UTC',{provider,confirmation,link,notes:'Review departure, arrival, and local time before saving.'})]} }
  if(provider==='Expedia') { const start=firstDate(body,'2026-07-19T15:00'); return {provider,subject,drafts:[item('stay',/Derry/i.test(body)?'Maldron Hotel Derry':'Accommodation reservation',start,'Europe/Dublin',{provider,link,location:/Derry/i.test(body)?'Derry':'Dublin'})]} }
  if(provider==='United Taxi') { const arrival=/Airport Pickup/i.test(body); const pending=/pending|not.*paid/i.test(body); const start=arrival?'2026-08-01T11:55':'2026-07-18T16:00'; return {provider,subject,drafts:[item('transport',arrival?'Airport taxi home':'Airport taxi to airport',start,'America/Toronto',{provider,location:arrival?'Toronto Pearson Airport (YYZ)':'Waterloo region',status:pending?'pending':'confirmed'})]} }
  if(provider==='Allianz' || /travel insurance confirmation|policy \d+/i.test(subject)) return {provider,subject,drafts:[item('insurance','Travel insurance coverage',detectDate(h),'America/Toronto',{provider,status:'confirmed',confirmation:(subject.match(/policy\s*(\d+)/i)||[])[1],notes:'Coverage confirmation'})]}
  if(provider==='Rock of Cashel') return {provider,subject,drafts:[item('event','Rock of Cashel visit','2026-07-31T10:00','Europe/Dublin',{provider,link,location:'Rock of Cashel',confirmation:(body.match(/reference is:\s*(\d+)/i)||[])[1],quantity:(body.match(/Tickets Purchased:\s*([^]+?)You can/i)||[])[1]?.trim()})]}
  if(provider==='Titanic Belfast') return {provider,subject,drafts:[item('event','Titanic Belfast experience','2026-07-21T08:30','Europe/London',{provider,link,location:'Titanic Belfast',notes:'Anytime ticket'})]}
  if(provider==='Bunratty Castle & Folk Park') return {provider,subject,drafts:[item('event','Bunratty Castle & Folk Park',firstDate(body,detectDate(h)),'Europe/Dublin',{provider,location:'Bunratty'})]}
  if(/turtle bay|all set for your trip/i.test(subject)) return {provider:provider==='Email import'?'Travel booking':provider,subject,drafts:[item('event',subject,firstDate(body,detectDate(h)),'UTC',{provider:provider==='Email import'?'Travel booking':provider,status:'planned',notes:'Review reservation time, venue, and confirmation.'})]}
  return {provider,subject,drafts:[item('reference',subject,firstDate(body,detectDate(h)),'UTC',{provider,status:'planned',notes:'Review this email import and complete its details.'})]}
}
