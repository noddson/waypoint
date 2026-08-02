export const SCHEMA_VERSION = 1 as const
export type ItemType = 'flight' | 'stay' | 'car' | 'transport' | 'insurance' | 'event' | 'plan' | 'reference'
export type Status = 'confirmed' | 'pending' | 'planned'
export interface TripItem {
  id: string; type: ItemType; title: string; provider?: string; confirmation?: string
  start: string; end?: string; timeZone: string; endTimeZone?: string; location?: string; endLocation?: string
  notes?: string; link?: string; status: Status; quantity?: string; flightNumber?: string; durationMinutes?: number
}
export interface Trip { id: string; name: string; destination: string; createdAt: string; updatedAt: string; items: TripItem[] }
export interface TripExport { schemaVersion: typeof SCHEMA_VERSION; exportedAt: string; trip: Trip }
export const types: ItemType[] = ['flight','stay','car','transport','insurance','event','plan','reference']
export const typeLabels: Record<ItemType,string> = { flight:'Flight', stay:'Stay', car:'Car rental', transport:'Transport', insurance:'Insurance', event:'Event', plan:'Plan', reference:'Reference' }
export const uid = () => crypto.randomUUID()
