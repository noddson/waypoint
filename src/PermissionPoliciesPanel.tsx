import type { SharePolicyV1 } from './types'
import { SharePolicyEditor } from './SharePolicyEditor'
import { UnifiedMenuPanel } from './UnifiedMenu'

export interface PermissionPoliciesPanelProps {
  publicPolicy: SharePolicyV1
  namedPolicy: SharePolicyV1
  calendarPolicy: SharePolicyV1
  disabled?: boolean
  onPublicPolicyChange: (policy:SharePolicyV1)=>void
  onNamedPolicyChange: (policy:SharePolicyV1)=>void
  onCalendarPolicyChange: (policy:SharePolicyV1)=>void
  onBack: ()=>void
  onClose: ()=>void
}

export function PermissionPoliciesPanel(props:PermissionPoliciesPanelProps) {
  return <UnifiedMenuPanel title="Permission Policies" onBack={props.onBack} onClose={props.onClose} className="permission-policies-panel">
   <div className="settings-list">
    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Public Trip</h3><span className="sharing-state">Anonymous</span></div>
      <SharePolicyEditor policy={props.publicPolicy} onChange={props.onPublicPolicyChange} disabled={props.disabled}/>
    </section>
    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Named Trip Viewers</h3><span className="sharing-state">Named readers</span></div>
      <SharePolicyEditor policy={props.namedPolicy} onChange={props.onNamedPolicyChange} disabled={props.disabled}/>
    </section>
    <section className="sync-share-section setting-group">
      <div className="unified-menu-subheading"><h3>Public Calendar</h3><span className="sharing-state">Anonymous</span></div>
      <SharePolicyEditor policy={props.calendarPolicy} onChange={props.onCalendarPolicyChange} disabled={props.disabled}/>
    </section>
   </div>
  </UnifiedMenuPanel>
}
