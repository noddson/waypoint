import {afterEach,describe,expect,it,vi} from 'vitest'
import {browserLanguage,currentLocale,languageCodes,languageMetadata,languageStorageKey,loadLanguage,localizedItemJsonExample,saveLanguage,uiMessage,uiText} from './i18n'
import {journalPhrases,journalRefinements} from './i18nJournalRefinements'

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
    expect(languageMetadata.jp).toMatchObject({flag:'🇯🇵',locale:'ja-JP',htmlLang:'ja'})
    expect(languageMetadata.xx).toMatchObject({flag:'🏴‍☠️',locale:'en-CA',htmlLang:'en-x-pirate'})
  })

  it('translates core interface copy and can switch from an existing translation',()=>{
    expect(uiText('Settings','de')).toBe('Einstellungen')
    expect(uiText('End time zone','de')).toBe('Endzeitzone')
    expect(uiText('Settings','jp')).toBe('設定')
    expect(uiText('Einstellungen','fr')).toBe('Réglages')
  })

  it('translates variable-bearing summaries, statuses, and routes',()=>{
    expect(uiMessage('Last updated {date}','de',{date:'06.08.2026, 19:00'})).toBe('Zuletzt aktualisiert: 06.08.2026, 19:00')
    expect(uiText('Open Winnipeg in Google Maps ↗','de')).toBe('Route Winnipeg in Google Maps öffnen ↗')
    expect(uiText('v3 of 12','fr')).toBe('v3 sur 12')
    expect(uiText('Local only · this browser','jp')).toBe('ローカルのみ · このブラウザ')
    expect(uiText('Wait for the current Google Drive operation to finish before saving this item.','es')).toBe('Espera a que termine la operación actual de Google Drive y vuelve a intentarlo.')
  })

  it('localizes weather, settings guidance, and the display-only JSON example',()=>{
    expect(uiText('Overcast','de')).toBe('Bedeckt')
    expect(uiText('Historical weather unavailable','de')).toBe('Historische Wetterdaten nicht verfügbar')
    expect(uiText('Show QR and Code 128 confirmation codes beside bookings.','fr')).toContain('codes de confirmation')
    expect(localizedItemJsonExample('de')).toContain('"Typ": "Veranstaltung"')
    expect(localizedItemJsonExample('de')).toContain('"Titel": "Museumsbesuch"')
    expect(localizedItemJsonExample('de')).not.toContain('"type"')
  })

  it('localizes historical weather states in every non-English language',()=>{
    const guidance='Choose a temperature scale or turn day-level weather off. Waypoint never uses your device location, and completed trips from 2022 onward show historical weather.'
    for(const language of languageCodes.filter(language=>language!=='en')){
      expect(uiText('Historical weather unavailable',language)).not.toBe('Historical weather unavailable')
      expect(uiText('Historical weather: Open-Meteo',language)).not.toBe('Historical weather: Open-Meteo')
      expect(uiText(guidance,language)).not.toBe(guidance)
    }
  })

  it('localizes confirmation-code controls with their dynamic values',()=>{
    expect(uiMessage('Confirmation {value}. Enlarge code. Double click or double tap to show {format}','de',{value:'AHPSU8',format:uiText('Code 128 barcode','de')})).toBe('Bestätigung AHPSU8. Code vergrößern. Doppelklicken oder doppeltippen, um Code-128-Barcode anzuzeigen')
  })

  it('localizes the journal controls in every non-English language',()=>{
    for(const language of languageCodes.filter(language=>language!=='en')){
      expect(Object.keys(journalRefinements[language])).toHaveLength(journalPhrases.length)
      for(const phrase of journalPhrases)expect(journalRefinements[language][phrase],`${language}: ${phrase}`).toBeTruthy()
      expect(uiText('Journal',language)).not.toBe('Journal')
      expect(uiText('Add journal entry',language)).not.toBe('Add journal entry')
      expect(uiText('Connect Google Drive to add or view photos. Text entries remain available locally.',language)).not.toContain('Connect Google Drive')
      expect(uiText('Journal · 3',language)).not.toBe('Journal · 3')
      expect(uiText('Add journal entry for 2026-08-07',language)).not.toBe('Add journal entry for 2026-08-07')
    }
  })

  it('localizes empty and transient loading states in every non-English language',()=>{
    for(const language of languageCodes.filter(language=>language!=='en')){
      expect(uiText('No items yet. Add an item or import Waypoint JSON.',language)).not.toBe('No items yet. Add an item or import Waypoint JSON.')
      expect(uiText('Loading Google Drive trips…',language)).not.toBe('Loading Google Drive trips…')
      expect(uiText('Opening your local trip library…',language)).not.toBe('Opening your local trip library…')
    }
  })
})
