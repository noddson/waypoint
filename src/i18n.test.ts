import {afterEach,describe,expect,it,vi} from 'vitest'
import {browserLanguage,currentLocale,languageCodes,languageMetadata,languageStorageKey,loadLanguage,saveLanguage,uiText} from './i18n'

class MemoryStorage {
  values=new Map<string,string>()
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
}

afterEach(()=>vi.unstubAllGlobals())

describe('UI language selection',()=>{
  it('offers the same nine language codes as Luggage Check',()=>{
    expect(languageCodes).toEqual(['en','de','el','es','fr','is','it','jp','xx'])
  })

  it('matches the first supported browser language and maps Japanese',()=>{
    expect(browserLanguage(['pt-BR','ja-JP','fr-CA'])).toBe('jp')
    expect(browserLanguage(['pt-BR','fr-CA'])).toBe('fr')
    expect(browserLanguage(['pt-BR'])).toBe('en')
  })

  it('prefers a valid saved language over the browser',()=>{
    const storage=new MemoryStorage();storage.setItem(languageStorageKey,'is')
    vi.stubGlobal('localStorage',storage)
    vi.stubGlobal('navigator',{languages:['de-DE'],language:'de-DE'})
    expect(loadLanguage()).toBe('is')
    expect(currentLocale()).toBe('is-IS')
  })

  it('ignores invalid saved values and persists explicit selections',()=>{
    const storage=new MemoryStorage();storage.setItem(languageStorageKey,'nope')
    vi.stubGlobal('localStorage',storage)
    vi.stubGlobal('navigator',{languages:['el-GR'],language:'el-GR'})
    expect(loadLanguage()).toBe('el')
    saveLanguage('xx')
    expect(storage.getItem(languageStorageKey)).toBe('xx')
  })

  it('uses standards-compliant formatting and HTML language tags',()=>{
    expect(languageMetadata.jp).toMatchObject({locale:'ja-JP',htmlLang:'ja'})
    expect(languageMetadata.xx).toMatchObject({locale:'en-CA',htmlLang:'en-x-pirate'})
  })

  it('translates core interface copy and can switch from an existing translation',()=>{
    expect(uiText('Settings','de')).toBe('Einstellungen')
    expect(uiText('Settings','jp')).toBe('設定')
    expect(uiText('Einstellungen','fr')).toBe('Réglages')
  })
})
