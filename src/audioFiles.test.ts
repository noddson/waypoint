import { describe, expect, it } from 'vitest'
import { AUDIO_FILE_ACCEPT, audioMimeType } from './audioFiles'

describe('audio file selection',()=>{
  it('explicitly includes the iOS m4a extension and MIME types',()=>{
    expect(AUDIO_FILE_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.m4a','audio/x-m4a','audio/mp4','audio/*']))
  })

  it('recognizes iOS m4a files even when their MIME type is missing or misclassified',()=>{
    expect(audioMimeType({name:'Voice Memo.m4a',type:''})).toBe('audio/x-m4a')
    expect(audioMimeType({name:'Voice Memo.M4A',type:'video/mp4'})).toBe('audio/x-m4a')
    expect(audioMimeType({name:'Voice Memo.m4a',type:'audio/mp4'})).toBe('audio/mp4')
  })

  it('does not accept a non-audio file based on an unrelated MIME type',()=>{
    expect(audioMimeType({name:'notes.txt',type:'text/plain'})).toBeUndefined()
  })
})
