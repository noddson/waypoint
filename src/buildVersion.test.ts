import { describe, expect, it } from 'vitest'
import { parseBuildVersion } from './buildVersion'

describe('build version metadata',()=>{
  it('accepts commit-linked version metadata',()=>{
    expect(parseBuildVersion({
      displayVersion:'2026.08.26a6f83',
      fullSha:'26a6f83bbdc6344fc1575a2edd6e341821392bf9',
      githubCommitUrl:'https://github.com/noddson/waypoint/commit/26a6f83bbdc6344fc1575a2edd6e341821392bf9',
    })).toEqual({
      displayVersion:'2026.08.26a6f83',
      fullSha:'26a6f83bbdc6344fc1575a2edd6e341821392bf9',
      githubCommitUrl:'https://github.com/noddson/waypoint/commit/26a6f83bbdc6344fc1575a2edd6e341821392bf9',
    })
  })

  it('rejects incomplete or non-GitHub metadata',()=>{
    expect(parseBuildVersion(null)).toBeNull()
    expect(parseBuildVersion({displayVersion:'2026.08.26a6f83'})).toBeNull()
    expect(parseBuildVersion({displayVersion:'2026.08.26a6f83',fullSha:'26a6f83',githubCommitUrl:'javascript:alert(1)'})).toBeNull()
  })
})
