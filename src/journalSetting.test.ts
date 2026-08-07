import {afterEach,describe,expect,it,vi} from 'vitest'
import {journalEnabledFromStorage,journalEnabledStorageKey,loadJournalEnabled,saveJournalEnabled} from './journalSetting'

class MemoryStorage {
  values=new Map<string,string>()
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
}

afterEach(()=>vi.unstubAllGlobals())

describe('journal setting',()=>{
  it('is opt-in',()=>{
    expect(journalEnabledFromStorage(null)).toBe(false)
    expect(journalEnabledFromStorage('disabled')).toBe(false)
    expect(journalEnabledFromStorage('enabled')).toBe(true)
  })

  it('loads and saves the browser preference',()=>{
    const storage=new MemoryStorage();vi.stubGlobal('localStorage',storage)
    expect(loadJournalEnabled()).toBe(false)
    saveJournalEnabled(true)
    expect(storage.getItem(journalEnabledStorageKey)).toBe('enabled')
    expect(loadJournalEnabled()).toBe(true)
  })
})
