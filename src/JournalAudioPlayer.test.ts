import { describe, expect, it } from 'vitest'
import { audioTimeAfterSkip, formatAudioTime } from './JournalAudioPlayer'

describe('journal audio playback helpers',()=>{
  it('formats elapsed time for short and long recordings',()=>{
    expect(formatAudioTime(0)).toBe('0:00')
    expect(formatAudioTime(65.9)).toBe('1:05')
    expect(formatAudioTime(3661)).toBe('1:01:01')
  })

  it('rewinds and skips by the requested interval without crossing media bounds',()=>{
    expect(audioTimeAfterSkip(42,120,-15)).toBe(27)
    expect(audioTimeAfterSkip(8,120,-15)).toBe(0)
    expect(audioTimeAfterSkip(112,120,15)).toBe(120)
  })
})
