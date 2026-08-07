import { JournalEntry, Trip, TripItem, sortTripItems } from './types'
import { tripRouteStops } from './destinations'

const same = (a:unknown,b:unknown) => JSON.stringify(a)===JSON.stringify(b)
const byId = <T extends {id:string}>(items:T[]) => new Map(items.map(item=>[item.id,item]))
const journalConflictCopy = (entry:JournalEntry,id:string,source:'local'|'drive'):JournalEntry => ({...entry,id,conflictOf:entry.id,conflictSource:source,photos:entry.photos.map(photo=>({...photo,id:crypto.randomUUID()}))})

const chooseField = <T,>(base:T,local:T,remote:T) => {
  if(local===remote)return local
  if(local===base)return remote
  return local
}

export function mergeTripVersions(base:Trip,local:Trip,remote:Trip) {
  if(base.id!==local.id||base.id!==remote.id)throw new Error('Cannot merge different trips.')
  const baseItems=byId(base.items),localItems=byId(local.items),remoteItems=byId(remote.items)
  const ids=new Set([...baseItems.keys(),...localItems.keys(),...remoteItems.keys()])
  const items:TripItem[]=[]
  let conflicts=0

  for(const id of ids){
    const before=baseItems.get(id),ours=localItems.get(id),theirs=remoteItems.get(id)
    if(!before){
      if(ours&&theirs&&!same(ours,theirs)){
        conflicts++
        items.push({...ours,title:`${ours.title} (local conflict)`,conflictOf:id,conflictSource:'local'})
        items.push({...theirs,id:crypto.randomUUID(),title:`${theirs.title} (Drive conflict)`,conflictOf:id,conflictSource:'drive'})
      }else if(ours||theirs)items.push((ours||theirs)!)
      continue
    }
    if(!ours&&!theirs)continue
    if(!ours){if(!same(theirs,before))items.push(theirs!);continue}
    if(!theirs){if(!same(ours,before))items.push(ours);continue}
    const localChanged=!same(ours,before),remoteChanged=!same(theirs,before)
    if(localChanged&&remoteChanged&&!same(ours,theirs)){
      conflicts++
      items.push({...ours,title:`${ours.title} (local conflict)`,conflictOf:id,conflictSource:'local'})
      items.push({...theirs,id:crypto.randomUUID(),title:`${theirs.title} (Drive conflict)`,conflictOf:id,conflictSource:'drive'})
    }else items.push(remoteChanged?theirs:ours)
  }

  const baseEntries=byId(base.journalEntries||[]),localEntries=byId(local.journalEntries||[]),remoteEntries=byId(remote.journalEntries||[])
  const entryIds=new Set([...baseEntries.keys(),...localEntries.keys(),...remoteEntries.keys()])
  const journalEntries:JournalEntry[]=[]
  for(const id of entryIds){
    const before=baseEntries.get(id),ours=localEntries.get(id),theirs=remoteEntries.get(id)
    if(!before){
      if(ours&&theirs&&!same(ours,theirs)){
        conflicts++
        journalEntries.push({...ours,conflictOf:id,conflictSource:'local'})
        journalEntries.push(journalConflictCopy(theirs,crypto.randomUUID(),'drive'))
      }else if(ours||theirs)journalEntries.push((ours||theirs)!)
      continue
    }
    if(!ours&&!theirs)continue
    if(!ours){if(!same(theirs,before))journalEntries.push(theirs!);continue}
    if(!theirs){if(!same(ours,before))journalEntries.push(ours);continue}
    const localChanged=!same(ours,before),remoteChanged=!same(theirs,before)
    if(localChanged&&remoteChanged&&!same(ours,theirs)){
      conflicts++
      journalEntries.push({...ours,conflictOf:id,conflictSource:'local'})
      journalEntries.push(journalConflictCopy(theirs,crypto.randomUUID(),'drive'))
    }else journalEntries.push(remoteChanged?theirs:ours)
  }

  const sortedItems=sortTripItems(items)
  journalEntries.sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))
  return {
    trip:{...remote,name:chooseField(base.name,local.name,remote.name),destination:tripRouteStops(sortedItems).map(stop=>stop.label).join(' → '),archivedAt:chooseField(base.archivedAt,local.archivedAt,remote.archivedAt),updatedAt:new Date().toISOString(),items:sortedItems,journalEntries},
    conflicts,
  }
}
