import { describe, expect, it } from 'vitest'
import { MobileEnvironment, shouldEnableMobileExperience } from './mobileMode'

const environment = (overrides: Partial<MobileEnvironment> = {}): MobileEnvironment => ({
  search: '',
  maxTouchPoints: 0,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  coarsePointer: false,
  hoverNone: false,
  width: 1440,
  height: 900,
  ...overrides,
})

describe('mobile experience detection', () => {
  it('enables the mobile experience on an iPhone', () => {
    expect(shouldEnableMobileExperience(environment({
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      coarsePointer: true,
      hoverNone: true,
      width: 390,
      height: 844,
    }))).toBe(true)
  })

  it('keeps the desktop experience on a desktop browser', () => {
    expect(shouldEnableMobileExperience(environment())).toBe(false)
  })

  it('allows mobile mode to be forced for diagnosis', () => {
    expect(shouldEnableMobileExperience(environment({ search: '?mobile=1' }))).toBe(true)
    expect(shouldEnableMobileExperience(environment({
      search: '?mobile=0',
      maxTouchPoints: 5,
      coarsePointer: true,
      hoverNone: true,
      width: 390,
      height: 844,
    }))).toBe(false)
  })
})
