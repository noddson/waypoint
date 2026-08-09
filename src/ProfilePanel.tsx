import { FormEvent, useEffect, useState } from 'react'
import type { ProfileDetails, ProfileV1 } from './profile'
import { UnifiedMenuPanel } from './UnifiedMenu'

export function ProfilePanel({profile,busy,onSave,onBack,onClose}:{
  profile?: ProfileV1
  busy: boolean
  onSave: (details:ProfileDetails)=>Promise<void>|void
  onBack: ()=>void
  onClose: ()=>void
}) {
  const [details,setDetails]=useState<ProfileDetails>({name:profile?.name||'',email:profile?.email||'',homeBase:profile?.homeBase||''})
  const [error,setError]=useState('')
  useEffect(()=>setDetails({name:profile?.name||'',email:profile?.email||'',homeBase:profile?.homeBase||''}),[profile?.profileId,profile?.updatedAt])
  const submit=async(event:FormEvent)=>{
    event.preventDefault()
    setError('')
    if(!details.name.trim()){setError('Enter your name to save your profile.');return}
    if(details.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())){setError('Enter a valid email address or leave it blank.');return}
    try{await onSave(details)}catch(value){setError(value instanceof Error?value.message:'Your profile could not be saved.')}
  }
  return <UnifiedMenuPanel title="Profile" onBack={onBack} onClose={onClose} className="profile-panel" backLabel="Back to Settings">
    <form onSubmit={submit}>
      <label>Name<input autoComplete="name" maxLength={200} required value={details.name} onChange={event=>setDetails(current=>({...current,name:event.target.value}))}/></label>
      <label>Email<input type="email" autoComplete="email" maxLength={320} value={details.email} onChange={event=>setDetails(current=>({...current,email:event.target.value}))}/></label>
      <label>Home base<input autoComplete="address-level2" maxLength={500} placeholder="Toronto, Canada" value={details.homeBase} onChange={event=>setDetails(current=>({...current,homeBase:event.target.value}))}/></label>
      {error&&<p className="profile-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy?'Saving profile…':'Save profile'}</button>
    </form>
  </UnifiedMenuPanel>
}
