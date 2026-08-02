import { Trip, TripItem, sortTripItems } from './types'
import { tripDestinations } from './destinations'

const same = (a:unknown,b:unknown) => JSON.stringify(a)===JSON.stringify(b)
const byId = (items:TripItem[]) => new Map(items.map(item=>[item.id,item]))

const chooseField = <T,>(base:T,local:T,remote:T) => {
  if(local===remote)return local
  if(local===base)return remote
  return local
}

export function mergeTripVersions(base:Trip,local:Trip,remote:Trip) {
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

  const sortedItems=sortTripItems(items)
  return {
    trip:{...remote,name:chooseField(base.name,local.name,remote.name),destination:tripDestinations(sortedItems).map(stop=>stop.label).join(' → '),archivedAt:chooseField(base.archivedAt,local.archivedAt,remote.archivedAt),updatedAt:new Date().toISOString(),items:sortedItems},
    conflicts,
  }
}
