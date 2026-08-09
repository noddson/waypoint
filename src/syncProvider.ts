import type { ShareProjectionV1, Trip } from './types'

export type SyncPublicationAudience = 'public'|'named'

export interface ProviderSession {
  provider: string
  connected: boolean
  expiresAt?: number
}

export interface ProviderSyncResult<TRecord> {
  record: TRecord
  trip: Trip
  conflicts: number
  changed: boolean
}

/**
 * Provider-neutral boundary used by sync/share UI orchestration. Provider-only
 * features (for example Google Picker recovery) stay behind the implementation.
 */
export interface SyncProvider<TRecord,TPublication,TAclTarget,TPermission> {
  id: string
  label: string
  scope?: string
  session: () => ProviderSession
  connect: (clientId:string) => Promise<void>
  disconnect: () => void
  createTrip: (trip:Trip) => Promise<TRecord>
  syncTrip: (record:TRecord,trip:Trip) => Promise<ProviderSyncResult<TRecord>>
  publishTrip: (tripId:string,tripName:string,audience:SyncPublicationAudience,projection:ShareProjectionV1,options?:{publicEnabled?:boolean;known?:TPublication}) => Promise<TPublication>
  setPublicTripEnabled: (publication:TPublication,enabled:boolean) => Promise<void>
  addNamedViewer: (publication:TPublication,email:string,mediaTargets?:TAclTarget[]) => Promise<TPermission[]>
  addCollaborator: (record:TRecord,email:string) => Promise<TPermission>
  revokePermission: (target:TAclTarget,permissionId:string) => Promise<void>
}
