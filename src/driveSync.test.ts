import { describe, expect, it } from 'vitest'
import { hasIncomingDriveUpdates, isRecentDriveSyncCheckpoint } from './driveSync'

describe('Google Drive update detection',()=>{
  it('treats a changed Drive object modification time as an incoming update',()=>{
    expect(hasIncomingDriveUpdates(
      {driveModifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},
      {modifiedTime:'2026-08-06T10:05:00.000Z',version:'5'},
    )).toBe(true)
  })

  it('skips incoming work when the observed Drive object is unchanged',()=>{
    expect(hasIncomingDriveUpdates(
      {driveModifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},
      {modifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},
    )).toBe(false)
  })

  it('uses the Drive head revision as the authoritative content identity',()=>{
    expect(hasIncomingDriveUpdates(
      {headRevisionId:'head-4',driveModifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},
      {headRevisionId:'head-5',modifiedTime:'2026-08-06T10:05:00.000Z',version:'5'},
    )).toBe(true)
    expect(hasIncomingDriveUpdates(
      {headRevisionId:'head-4',driveModifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},
      {headRevisionId:'head-4',modifiedTime:'2026-08-06T10:00:00.000Z',version:'5'},
    )).toBe(false)
  })

  it('checks legacy records once and uses Drive version as a timestamp fallback',()=>{
    expect(hasIncomingDriveUpdates({version:'4'},{modifiedTime:'2026-08-06T10:00:00.000Z',version:'4'})).toBe(true)
    expect(hasIncomingDriveUpdates({driveModifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},{version:'4'})).toBe(false)
    expect(hasIncomingDriveUpdates({driveModifiedTime:'2026-08-06T10:00:00.000Z',version:'4'},{version:'5'})).toBe(true)
  })

  it('reuses only a recent checkpoint for the same local updatedAt',()=>{
    const now=Date.parse('2026-08-06T10:01:00.000Z')
    expect(isRecentDriveSyncCheckpoint('2026-08-06T10:00:00.000Z','trip-4','trip-4',now)).toBe(true)
    expect(isRecentDriveSyncCheckpoint('2026-08-06T09:59:00.000Z','trip-4','trip-4',now)).toBe(false)
    expect(isRecentDriveSyncCheckpoint('2026-08-06T10:00:00.000Z','trip-3','trip-4',now)).toBe(false)
    expect(isRecentDriveSyncCheckpoint(undefined,'trip-4','trip-4',now)).toBe(false)
  })
})
