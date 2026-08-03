export type MapProvider = 'google'|'apple'

export const MAP_PROVIDER_SESSION_KEY = 'waypoint-map-provider'

export function readMapProvider(storage?:Pick<Storage,'getItem'>):MapProvider {
  try {
    const value=(storage||sessionStorage).getItem(MAP_PROVIDER_SESSION_KEY)
    return value==='apple'?'apple':'google'
  } catch {
    return 'google'
  }
}

export function saveMapProvider(provider:MapProvider,storage?:Pick<Storage,'setItem'>) {
  try {
    (storage||sessionStorage).setItem(MAP_PROVIDER_SESSION_KEY,provider)
  } catch {
    // Session storage can be unavailable in private browsing modes.
  }
}
