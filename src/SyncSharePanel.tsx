import { FormEvent, useState } from 'react'
import type { DrivePermissionSnapshot, SharePolicyV1 } from './types'
import { sharePolicyForPreset } from './sharePolicy'
import { UnifiedMenuPanel } from './UnifiedMenu'

type AsyncAction = ()=>Promise<void>|void

export interface SyncSharePanelProps {
  connected:boolean; linked:boolean; canShare:boolean; isOwner:boolean; busy:boolean
  publicEnabled:boolean; namedEnabled:boolean; calendarEnabled:boolean
  publicPolicy:SharePolicyV1; namedPolicy:SharePolicyV1; calendarPolicy:SharePolicyV1
  publicPublishedAt?:string; namedPublishedAt?:string; calendarPublishedAt?:string
  publicStale?:boolean; namedStale?:boolean; calendarStale?:boolean
  publicReviewRequired?:boolean; namedReviewRequired?:boolean; calendarReviewRequired?:boolean
  namedViewers:DrivePermissionSnapshot[]; collaborators:DrivePermissionSnapshot[]
  onPublicPolicyChange:(policy:SharePolicyV1)=>void; onNamedPolicyChange:(policy:SharePolicyV1)=>void; onCalendarPolicyChange:(policy:SharePolicyV1)=>void
  onStartSync:AsyncAction; onSync:AsyncAction; onStopSync:AsyncAction; onSnapshot:AsyncAction
  onSetPublicEnabled:(enabled:boolean)=>Promise<void>|void; onCopyPublicLink:AsyncAction
  onSetNamedEnabled:(enabled:boolean)=>Promise<void>|void; onPublishNamed:AsyncAction
  onAddNamedViewer:(email:string)=>Promise<void>|void; onAddCollaborator:(email:string)=>Promise<void>|void
  onRevokeNamed:(permission:DrivePermissionSnapshot,kind:'viewer'|'collaborator')=>Promise<void>|void; onRemoveAllNamed:AsyncAction
  onCalendarSnapshot:AsyncAction; onSetCalendarEnabled:(enabled:boolean)=>Promise<void>|void; onCopyCalendarLink:AsyncAction
  onBack:()=>void; onClose:()=>void
}

const dateLabel=(value?:string)=>value?new Date(value).toLocaleString():'Not published yet'

export function SyncSharePanel(props:SyncSharePanelProps) {
  const [viewerEmail,setViewerEmail]=useState(''),[collaboratorEmail,setCollaboratorEmail]=useState('')
  const submit=async(event:FormEvent,email:string,setEmail:(value:string)=>void,action:(email:string)=>Promise<void>|void)=>{event.preventDefault();if(!email.trim())return;await action(email.trim().toLowerCase());setEmail('')}
  const disabled=props.busy||!props.connected||!props.canShare
  const policyDisabled=props.busy||!props.isOwner
  return <UnifiedMenuPanel title="Sync & Share" onBack={props.onBack} onClose={props.onClose} className="sync-share-panel">
   <div className="settings-list sync-share-settings">
    <section className="sync-share-section setting-group connection-section">
      <div className="unified-menu-subheading"><h3>Google Drive</h3><span className={`sharing-state${props.connected?' enabled':''}`}>{props.connected?'Connected':'Disconnected'}</span></div>
      <button type="button" disabled={!props.linked||props.busy} onClick={props.onSync}>{props.busy?'Working…':'Sync and Update'}</button>
      {!props.linked&&props.isOwner&&<button type="button" disabled={props.busy} onClick={props.onStartSync}>Start syncing this trip</button>}
      {props.linked&&props.isOwner&&<button type="button" className="text-action" disabled={props.busy} onClick={props.onStopSync}>Stop syncing this trip</button>}
    </section>

    <section className="sync-share-section setting-group"><button type="button" className="secondary" disabled={props.busy||!props.isOwner} onClick={props.onSnapshot}>Create a Trip Snapshot</button></section>

    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Public Live Trip</h3><span className={`sharing-state${props.publicEnabled?' enabled':''}`}>{props.publicEnabled?'On':'Off'}</span></div>
      <PolicySelector label="Public Trip policy" policy={props.publicPolicy} disabled={policyDisabled} onChange={props.onPublicPolicyChange}/>
      <div className="publication-actions">{props.publicEnabled&&props.publicStale&&<button type="button" disabled={disabled} onClick={()=>props.onSetPublicEnabled(true)}>Publish update</button>}<button type="button" className={props.publicEnabled&&props.publicStale?'secondary':undefined} disabled={disabled} onClick={()=>props.onSetPublicEnabled(!props.publicEnabled)}>{props.publicEnabled?'Unpublish public trip':'Publish public trip'}</button><button type="button" className="secondary" disabled={!props.publicEnabled||props.busy} onClick={props.onCopyPublicLink}>Copy link</button></div>
      <PublicationStatus publishedAt={props.publicPublishedAt} stale={props.publicStale} reviewRequired={props.publicReviewRequired}/>
    </section>

    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Named Trip Viewers</h3><span className={`sharing-state${props.namedEnabled?' enabled':''}`}>{props.namedViewers.length} viewer{props.namedViewers.length===1?'':'s'}</span></div>
      <PolicySelector label="Named Trip policy" policy={props.namedPolicy} disabled={policyDisabled} onChange={props.onNamedPolicyChange}/>
      <div className="publication-actions">{props.namedEnabled&&props.namedStale&&<button type="button" disabled={disabled} onClick={props.onPublishNamed}>Publish named-viewer update</button>}<button type="button" className={props.namedEnabled&&props.namedStale?'secondary':undefined} disabled={disabled} onClick={()=>props.onSetNamedEnabled(!props.namedEnabled)}>{props.namedEnabled?'Turn off named sharing':'Create named sharing link'}</button></div>
      <form className="named-access-form" onSubmit={event=>void submit(event,viewerEmail,setViewerEmail,props.onAddNamedViewer)}><input type="email" required aria-label="Named viewer email" placeholder="viewer@example.com" value={viewerEmail} onChange={event=>setViewerEmail(event.target.value)}/><button type="submit" disabled={disabled}>Add viewer</button></form>
      <AccessList people={props.namedViewers} kind="viewer" disabled={disabled} onRevoke={props.onRevokeNamed}/>
      <PublicationStatus publishedAt={props.namedPublishedAt} stale={props.namedStale} reviewRequired={props.namedReviewRequired}/>
    </section>

    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Collaborators</h3><span className={`sharing-state${props.collaborators.length?' enabled':''}`}>{props.collaborators.length} collaborator{props.collaborators.length===1?'':'s'}</span></div>
      <p>Collaborators can edit the canonical trip and its media.</p>
      <form className="named-access-form" onSubmit={event=>void submit(event,collaboratorEmail,setCollaboratorEmail,props.onAddCollaborator)}><input type="email" required aria-label="Collaborator email" placeholder="collaborator@example.com" value={collaboratorEmail} onChange={event=>setCollaboratorEmail(event.target.value)}/><button type="submit" disabled={disabled}>Add collaborator</button></form>
      <AccessList people={props.collaborators} kind="collaborator" disabled={disabled} onRevoke={props.onRevokeNamed}/>
    </section>

    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Calendar</h3><span className={`sharing-state${props.calendarEnabled?' enabled':''}`}>{props.calendarEnabled?'Live subscription on':'Live subscription off'}</span></div>
      <PolicySelector label="Public Calendar policy" policy={props.calendarPolicy} disabled={policyDisabled} onChange={props.onCalendarPolicyChange}/>
      <div className="publication-actions"><button type="button" className="secondary" disabled={props.busy||!props.isOwner} onClick={props.onCalendarSnapshot}>Download calendar snapshot</button>{props.calendarEnabled&&props.calendarStale&&<button type="button" disabled={disabled} onClick={()=>props.onSetCalendarEnabled(true)}>Publish update</button>}<button type="button" className={props.calendarEnabled&&props.calendarStale?'secondary':undefined} disabled={disabled} onClick={()=>props.onSetCalendarEnabled(!props.calendarEnabled)}>{props.calendarEnabled?'Unpublish live calendar':'Publish live calendar'}</button><button type="button" className="secondary" disabled={!props.calendarEnabled||props.busy} onClick={props.onCopyCalendarLink}>Copy subscription URL</button></div>
      <PublicationStatus publishedAt={props.calendarPublishedAt} stale={props.calendarStale} reviewRequired={props.calendarReviewRequired}/>
    </section>

    <button type="button" className="danger remove-all-access" disabled={disabled} onClick={props.onRemoveAllNamed}>Remove all named access</button>
   </div>
  </UnifiedMenuPanel>
}

function PolicySelector({label,policy,disabled,onChange}:{label:string;policy:SharePolicyV1;disabled:boolean;onChange:(policy:SharePolicyV1)=>void}) {
  const select=(preset:SharePolicyV1['preset'])=>{const selected=sharePolicyForPreset(policy.audience,preset);onChange(policy.audience==='named-trip'&&selected.itemTypes.includes('journal')?{...selected,includePhotos:policy.includePhotos,includeAudio:policy.includeAudio}:selected)}
  return <label className="sync-policy-selector"><span>{label}</span><select aria-label={label} value={policy.preset} disabled={disabled} onChange={event=>select(event.target.value as SharePolicyV1['preset'])}><option value="simplified">Simplified</option><option value="full">Full</option><option value="custom">Custom</option></select></label>
}

function PublicationStatus({publishedAt,stale,reviewRequired}:{publishedAt?:string;stale?:boolean;reviewRequired?:boolean}) {
  return <p className={`publication-status${stale?' stale':''}`}><strong>{reviewRequired?'Sensitive review required':stale?'Update needed':'Publication status'}</strong><span>{dateLabel(publishedAt)}</span></p>
}

function AccessList({people,kind,disabled,onRevoke}:{people:DrivePermissionSnapshot[];kind:'viewer'|'collaborator';disabled:boolean;onRevoke:SyncSharePanelProps['onRevokeNamed']}) {
  if(!people.length)return <p className="empty-access-list">No {kind==='viewer'?'named viewers':'collaborators'}.</p>
  return <div className="access-role-list">{people.map(person=><article key={person.id}><span><strong>{person.displayName||person.emailAddress||person.domain||'Named Google account'}</strong><small>{person.emailAddress||person.role}</small></span><button type="button" className="danger compact-button" disabled={disabled} onClick={()=>onRevoke(person,kind)}>Revoke</button></article>)}</div>
}
