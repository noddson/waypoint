import { describe, expect, it } from 'vitest'
import { formatExifDateTime, formatPhotoSize } from './JournalPhotoViewer'

describe('journal photo details',()=>{
  it('formats an EXIF wall-clock timestamp without shifting its displayed time zone',()=>{
    const formatted=formatExifDateTime('2026:07:18 14:35:12','en-CA')
    expect(formatted).toContain('2026')
    expect(formatted).toMatch(/2:35:12|14:35:12/)
  })

  it('leaves an unrecognized camera timestamp visible instead of discarding it',()=>{
    expect(formatExifDateTime('camera clock unavailable','en-CA')).toBe('camera clock unavailable')
  })

  it('formats photo sizes for the viewer caption',()=>{
    expect(formatPhotoSize(4,'en-CA')).toBe('4 B')
    expect(formatPhotoSize(1536,'en-CA')).toBe('1.5 KB')
    expect(formatPhotoSize(5*1024*1024,'en-CA')).toBe('5 MB')
  })
})
