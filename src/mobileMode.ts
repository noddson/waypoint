const MOBILE_PARAM_ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on'])
const MOBILE_PARAM_DISABLED_VALUES = new Set(['0', 'false', 'no', 'off'])
const MOBILE_SHORT_EDGE_MAX = 1024
const MOBILE_LONG_EDGE_MAX = 1368
const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPad|iPod|Mobile|IEMobile/i

export type MobileEnvironment = {
  search: string
  maxTouchPoints: number
  userAgent: string
  coarsePointer: boolean
  hoverNone: boolean
  width: number
  height: number
}

export function getMobileEnvironment(win: Window = window): MobileEnvironment {
  return {
    search: win.location.search,
    maxTouchPoints: win.navigator.maxTouchPoints,
    userAgent: win.navigator.userAgent,
    coarsePointer: win.matchMedia('(pointer: coarse)').matches,
    hoverNone: win.matchMedia('(hover: none)').matches,
    width: win.innerWidth,
    height: win.innerHeight,
  }
}

export function shouldEnableMobileExperience(environment: MobileEnvironment = getMobileEnvironment()) {
  const params = new URLSearchParams(environment.search)
  const override = params.get('mobile')?.trim().toLowerCase()
  if (override && MOBILE_PARAM_ENABLED_VALUES.has(override)) return true
  if (override && MOBILE_PARAM_DISABLED_VALUES.has(override)) return false

  const shortEdge = Math.min(environment.width, environment.height)
  const longEdge = Math.max(environment.width, environment.height)
  const mobileSizedViewport = shortEdge > 0
    && longEdge > 0
    && shortEdge <= MOBILE_SHORT_EDGE_MAX
    && longEdge <= MOBILE_LONG_EDGE_MAX
  const hasTouch = environment.maxTouchPoints > 0
  const likelyMobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(environment.userAgent)

  return (hasTouch || environment.coarsePointer)
    && mobileSizedViewport
    && (environment.coarsePointer || environment.hoverNone || likelyMobileUserAgent)
}
