export type MapProvider = 'google' | 'apple'

const mapProviderStorageKey = 'waypoint-map-provider'

export const mapProviderFromStorage = (value:string|null):MapProvider => value==='apple'?'apple':'google'

export function loadMapProvider():MapProvider {
  try{return mapProviderFromStorage(localStorage.getItem(mapProviderStorageKey))}
  catch{return 'google'}
}

export function saveMapProvider(provider:MapProvider) {
  try{localStorage.setItem(mapProviderStorageKey,provider)}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}
