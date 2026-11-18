import { useEffect, useState } from 'react'
import { DriveTripIdentityError, inspectDriveTripCopy, type DriveTripIdentityFile } from './googleDrive'
import type { Trip } from './types'

export function DriveTripCopies({issue,busy,onChoose}:{issue:DriveTripIdentityError;busy:boolean;onChoose:(file:DriveTripIdentityFile)=>void}) {
  const [copies,setCopies]=useState<Record<string,{trip?:Trip;error?:string}>>({})
  useEffect(()=>{
    let cancelled=false
    setCopies({})
    for(const file of issue.files)void inspectDriveTripCopy(issue.tripId,file).then(({trip})=>{if(!cancelled)setCopies(current=>({...current,[file.id]:{trip}}))}).catch(error=>{if(!cancelled)setCopies(current=>({...current,[file.id]:{error:error instanceof Error?error.message:'Could not read this copy.'}}))})
    return()=>{cancelled=true}
  },[issue])
  return <section className="importer drive-trip-copies" role="region" aria-label="Choose the current trip copy">
    <h2>{issue.preferredFileId?'Open the current trip copy':'Choose one trip copy for all devices'}</h2>
    <p>{issue.preferredFileId?'Another device selected the current Drive file. Open it before syncing this device.':'These files share the same trip ID. Sync is paused until you choose the copy to use.'} Existing Drive copies are kept. Different local details are saved as a separate local backup when you open the chosen copy.</p>
    {issue.files.map(file=>{const copy=copies[file.id],trip=copy?.trip;return <article key={file.id}>
      <h3>{file.name.replace(/\.waypoint\.json$/i,'')}{file.id===issue.preferredFileId?' (current copy)':''}</h3>
      {trip?<><p>{trip.items.length} {trip.items.length===1?'item':'items'} · Last edited {new Date(trip.updatedAt).toLocaleString()}</p><ul>{trip.items.map(item=><li key={item.id}>{item.start.slice(0,10)} — {item.title}</li>)}</ul></>:<p>{copy?.error||'Reading this copy…'}</p>}
      {(!issue.preferredFileId||file.id===issue.preferredFileId)&&<button type="button" className="secondary" disabled={busy||!trip} onClick={()=>onChoose(file)}>{issue.preferredFileId?'Open current copy':'Use this copy on all devices'}</button>}
    </article>})}
  </section>
}
