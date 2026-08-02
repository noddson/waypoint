import { Trip, TripItem, uid } from './types'
const i = (type:TripItem['type'], title:string, start:string, end:string|undefined, timeZone:string, extras:Partial<TripItem> = {}):TripItem => ({id:uid(), type,title,start,end,timeZone,status:'confirmed',...extras})
export function irelandSample(): Trip { const now=new Date().toISOString(); return { id:uid(), name:'Ireland summer escape', destination:'Ireland', createdAt:now, updatedAt:now, items:[
  i('transport','Airport taxi to Toronto Pearson','2026-07-18T16:00','2026-07-18T17:00','America/Toronto',{provider:'United Taxi',location:'Waterloo region',endLocation:'Toronto Pearson Airport (YYZ)'}),
  i('flight','Toronto → Dublin','2026-07-18T20:45','2026-07-19T08:15','America/Toronto',{provider:'Air Canada',confirmation:'SANITIZED',location:'Toronto Pearson (YYZ)',endLocation:'Dublin (DUB)',notes:'Overnight flight; arrival shown in destination local time in details.'}),
  i('stay','Dublin accommodation','2026-07-19T15:00','2026-07-20T11:00','Europe/Dublin',{provider:'Expedia',location:'Dublin'}),
  i('car','Collect rental car','2026-07-20T16:00','2026-07-31T16:00','Europe/Dublin',{provider:'Budget via Expedia',location:'Dublin',notes:'Sanitized rental confirmation'}),
  i('event','Titanic Belfast experience','2026-07-21T08:30','2026-07-21T17:50','Europe/London',{provider:'Titanic Belfast',location:'Titanic Belfast',quantity:'Sanitized ticket quantity'}),
  i('event','Bunratty Castle & Folk Park','2026-07-22T10:00',undefined,'Europe/Dublin',{provider:'Bunratty Castle & Folk Park',location:'Bunratty'}),
  i('stay','Derry accommodation','2026-07-23T15:00','2026-07-25T11:00','Europe/London',{provider:'Expedia',location:'Derry'}),
  i('event','Rock of Cashel visit','2026-07-31T10:00',undefined,'Europe/Dublin',{provider:'Rock of Cashel',location:'Cashel'}),
  i('flight','Dublin → Toronto','2026-08-01T09:20','2026-08-01T11:25','Europe/Dublin',{provider:'Air Canada',confirmation:'SANITIZED',location:'Dublin (DUB)',endLocation:'Toronto Pearson (YYZ)'}),
  i('transport','Airport taxi home','2026-08-01T11:55',undefined,'America/Toronto',{provider:'United Taxi',location:'Toronto Pearson Airport (YYZ)',endLocation:'Waterloo region'})
] } }
