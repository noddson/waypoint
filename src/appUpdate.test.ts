import { describe, expect, it } from 'vitest'
import { deployedEntryUrl, sameAppEntry } from './appUpdate'

describe('app update helpers', () => {
  it('resolves the deployed Vite entry relative to the served page', () => {
    const html='<!doctype html><script type="module" crossorigin src="./assets/index-new.js"></script>'
    expect(deployedEntryUrl(html,'https://example.test/waypoint/')).toBe('https://example.test/waypoint/assets/index-new.js')
  })

  it('ignores query strings when comparing the same entry asset', () => {
    expect(sameAppEntry('https://example.test/assets/index.js?v=1','https://example.test/assets/index.js?v=2')).toBe(true)
    expect(sameAppEntry('https://example.test/assets/index-old.js','https://example.test/assets/index-new.js')).toBe(false)
  })
})
