import { describe,expect,it } from 'vitest'
import {
  DEFAULT_CALENDAR_SHARE_POLICY,
  DEFAULT_NAMED_SHARE_POLICY,
  DEFAULT_PUBLIC_SHARE_POLICY,
  FULL_SHARE_FIELDS,
  PUBLIC_SHARE_FIELDS,
  SHARE_FIELD_CATALOG,
  buildShareProjection,
  canonicalSharePolicyJson,
  isSharePolicyV1,
  isShareProjectionV1,
  normalizeSharePolicy,
  sensitiveCategoriesForSharePolicy,
  sharePolicyForPreset,
  sharePolicyHash,
} from './sharePolicy'
import { type SharePolicyV1,type Trip,types } from './types'

const publishedAt='2026-08-09T15:00:00.000Z'
const author={profileId:'profile-1',displayName:'Alex Traveller'}
const richTrip:Trip={
  id:'private-trip-id',
  name:'Ireland 2026',
  destination:'Dublin → Galway',
  createdAt:'2026-01-01T00:00:00.000Z',
  updatedAt:'2026-08-09T14:00:00.000Z',
  archivedAt:'2026-08-10T00:00:00.000Z',
  createdBy:author,
  updatedBy:author,
  items:[
    {
      id:'private-flight-id',type:'flight',title:'Toronto → Dublin',provider:'Aer Lingus',confirmation:'PRIVATE123',
      start:'2026-09-01T20:00',end:'2026-09-02T08:00',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin',
      location:'Toronto',endLocation:'Dublin',notes:'Private booking note',link:'https://airline.example/manage',emailLink:'https://mail.example/message',
      bookedBy:'Alex',status:'confirmed',quantity:'2',flightNumber:'EI126',durationMinutes:420,allDay:false,
      createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-02-01T00:00:00.000Z',createdBy:author,updatedBy:author,
      conflictOf:'original-flight',conflictSource:'local',
    },
    {id:'stay-id',type:'stay',title:'Dublin Hotel',start:'2026-09-02T15:00',end:'2026-09-04T11:00',timeZone:'Europe/Dublin',location:'Dublin',status:'confirmed'},
    {id:'car-id',type:'car',title:'Rental car',start:'2026-09-04T12:00',timeZone:'Europe/Dublin',status:'confirmed'},
    {id:'event-id',type:'event',title:'Museum',start:'2026-09-03T10:00',timeZone:'Europe/Dublin',status:'planned'},
    {id:'transport-id',type:'transport',title:'Train',start:'2026-09-05T10:00',timeZone:'Europe/Dublin',status:'planned'},
    {id:'insurance-id',type:'insurance',title:'Travel cover',start:'2026-09-01T00:00',timeZone:'Europe/Dublin',status:'confirmed'},
    {
      id:'journal-id',type:'journal',title:'Arrival journal',start:'2026-09-02T12:00',timeZone:'Europe/Dublin',status:'planned',notes:'A private journal entry.',relatedItemId:'private-flight-id',
      photos:[{id:'private-photo-id',driveFileId:'drive-photo-id',resourceKey:'photo-key',name:'arrival.jpg',mimeType:'image/jpeg',size:123,createdAt:'2026-09-02T12:01:00.000Z'}],
      audio:[{id:'private-audio-id',driveFileId:'drive-audio-id',resourceKey:'audio-key',name:'arrival.m4a',mimeType:'audio/mp4',size:456,createdAt:'2026-09-02T12:02:00.000Z'}],
      createdBy:author,updatedBy:author,conflictOf:'old-journal',conflictSource:'drive',
    },
  ],
}

describe('share policy defaults and validation',()=>{
  it('provides the specified public, named, and calendar defaults',()=>{
    expect(DEFAULT_PUBLIC_SHARE_POLICY).toEqual({version:1,audience:'public-trip',preset:'simplified',itemTypes:['flight','stay'],fields:[...PUBLIC_SHARE_FIELDS],includePhotos:false,includeAudio:false})
    expect(DEFAULT_NAMED_SHARE_POLICY.itemTypes).toEqual(['flight','stay','car','event'])
    expect(DEFAULT_NAMED_SHARE_POLICY.fields).toEqual([...FULL_SHARE_FIELDS])
    expect(DEFAULT_NAMED_SHARE_POLICY).toMatchObject({audience:'named-trip',includePhotos:false,includeAudio:false})
    expect(DEFAULT_CALENDAR_SHARE_POLICY).toEqual({...DEFAULT_PUBLIC_SHARE_POLICY,audience:'public-calendar'})
    expect([DEFAULT_PUBLIC_SHARE_POLICY,DEFAULT_NAMED_SHARE_POLICY,DEFAULT_CALENDAR_SHARE_POLICY].every(isSharePolicyV1)).toBe(true)
  })

  it('builds simplified, full, and editable custom presets without enabling media',()=>{
    expect(sharePolicyForPreset('named-trip','simplified')).toMatchObject({audience:'named-trip',preset:'simplified',itemTypes:['flight','stay'],fields:[...PUBLIC_SHARE_FIELDS]})
    expect(sharePolicyForPreset('public-trip','full')).toEqual({version:1,audience:'public-trip',preset:'full',itemTypes:types,fields:[...SHARE_FIELD_CATALOG],includePhotos:false,includeAudio:false})
    expect(sharePolicyForPreset('named-trip','custom')).toEqual({...DEFAULT_NAMED_SHARE_POLICY})
  })

  it('rejects extensions, duplicate or unknown selections, and unsafe media combinations',()=>{
    expect(isSharePolicyV1({...DEFAULT_PUBLIC_SHARE_POLICY,future:true})).toBe(false)
    expect(isSharePolicyV1({...DEFAULT_PUBLIC_SHARE_POLICY,itemTypes:['flight','flight']})).toBe(false)
    expect(isSharePolicyV1({...DEFAULT_PUBLIC_SHARE_POLICY,fields:['title','privateFutureField']})).toBe(false)
    expect(isSharePolicyV1({...DEFAULT_PUBLIC_SHARE_POLICY,includePhotos:true,itemTypes:['flight','journal']})).toBe(false)
    expect(isSharePolicyV1({...DEFAULT_NAMED_SHARE_POLICY,includePhotos:true})).toBe(false)
    expect(isSharePolicyV1({...DEFAULT_NAMED_SHARE_POLICY,itemTypes:[...DEFAULT_NAMED_SHARE_POLICY.itemTypes,'journal'],includePhotos:true})).toBe(true)
  })

  it('normalizes array order and creates stable policy hashes',async()=>{
    const reversed:SharePolicyV1={...DEFAULT_NAMED_SHARE_POLICY,itemTypes:[...DEFAULT_NAMED_SHARE_POLICY.itemTypes].reverse(),fields:[...DEFAULT_NAMED_SHARE_POLICY.fields].reverse()}
    expect(normalizeSharePolicy(reversed)).toEqual(DEFAULT_NAMED_SHARE_POLICY)
    expect(canonicalSharePolicyJson(reversed)).toBe(canonicalSharePolicyJson(DEFAULT_NAMED_SHARE_POLICY))
    const [left,right]=await Promise.all([sharePolicyHash(reversed),sharePolicyHash(DEFAULT_NAMED_SHARE_POLICY)])
    expect(left).toBe(right)
    expect(left).toMatch(/^[a-f0-9]{64}$/)
  })

  it('summarizes sensitive categories in a stable display order',()=>{
    const policy:SharePolicyV1={...sharePolicyForPreset('named-trip','full'),includePhotos:true,includeAudio:true}
    expect(sensitiveCategoriesForSharePolicy(policy)).toEqual(['confirmations','booking-details','notes-and-journal','links','locations','photos','audio'])
    expect(sensitiveCategoriesForSharePolicy(DEFAULT_PUBLIC_SHARE_POLICY)).toEqual(['locations'])
  })

  it('warns when a journal title can expose current or migrated journal text',()=>{
    const journalTitleOnly:SharePolicyV1={version:1,audience:'named-trip',preset:'custom',itemTypes:['journal'],fields:['title'],includePhotos:false,includeAudio:false}
    const journalWithoutText:SharePolicyV1={...journalTitleOnly,fields:['type']}
    const itineraryTitleOnly:SharePolicyV1={...journalTitleOnly,itemTypes:['flight']}
    expect(sensitiveCategoriesForSharePolicy(journalTitleOnly)).toEqual(['notes-and-journal'])
    expect(sensitiveCategoriesForSharePolicy(journalWithoutText)).toEqual([])
    expect(sensitiveCategoriesForSharePolicy(itineraryTitleOnly)).toEqual([])
  })
})

describe('deny-by-default share projections',()=>{
  it('applies the exact simplified public matrix and leaves the source untouched',()=>{
    const before=structuredClone(richTrip)
    ;(richTrip.items[0] as unknown as Record<string,unknown>).futureSecret='must not leak'
    const projection=buildShareProjection(richTrip,DEFAULT_PUBLIC_SHARE_POLICY,{publishedAt})
    delete (richTrip.items[0] as unknown as Record<string,unknown>).futureSecret

    expect(projection.accessMode).toBe('public-viewer')
    expect(projection.trip.items).toHaveLength(2)
    expect(projection.trip.items[0]).toEqual({type:'flight',title:'Toronto → Dublin',provider:'Aer Lingus',start:'2026-09-01T20:00',end:'2026-09-02T08:00',timeZone:'America/Toronto',endTimeZone:'Europe/Dublin',location:'Toronto',endLocation:'Dublin',status:'confirmed',flightNumber:'EI126',durationMinutes:420})
    expect(JSON.stringify(projection)).not.toMatch(/private-trip-id|private-flight-id|PRIVATE123|Private booking note|futureSecret|conflictOf|resourceKey|drive-photo-id|profile-1/)
    expect(isShareProjectionV1(projection)).toBe(true)
    expect(richTrip).toEqual(before)
  })

  it('projects all item types and user-facing fields for Full while still stripping canonical controls and media publicly',()=>{
    const projection=buildShareProjection(richTrip,sharePolicyForPreset('public-trip','full'),{publishedAt})
    expect(projection.trip.items).toHaveLength(types.length)
    const flight=projection.trip.items.find(item=>item.flightNumber==='EI126')!
    expect(flight).toMatchObject({confirmation:'PRIVATE123',notes:'Private booking note',createdBy:author,updatedBy:author})
    expect(flight).not.toHaveProperty('id')
    const journal=projection.trip.items.find(item=>item.type==='journal')!
    expect(journal).toMatchObject({title:'Arrival journal',notes:'A private journal entry.'})
    expect(journal).not.toHaveProperty('photos')
    expect(journal).not.toHaveProperty('audio')
    expect(journal).not.toHaveProperty('relatedItemId')
    expect(JSON.stringify(projection)).not.toMatch(/private-photo-id|drive-photo-id|old-journal|conflictSource/)
  })

  it('allows only named journal projections to carry explicitly enabled media descriptors',()=>{
    const policy:SharePolicyV1={...sharePolicyForPreset('named-trip','full'),includePhotos:true,includeAudio:true}
    const projection=buildShareProjection(richTrip,policy,{publishedAt})
    const journal=projection.trip.items.find(item=>item.type==='journal')!
    expect(projection.accessMode).toBe('named-viewer')
    expect(journal.photos).toEqual([{driveFileId:'drive-photo-id',resourceKey:'photo-key',name:'arrival.jpg',mimeType:'image/jpeg',size:123,createdAt:'2026-09-02T12:01:00.000Z'}])
    expect(journal.audio).toEqual([{driveFileId:'drive-audio-id',resourceKey:'audio-key',name:'arrival.m4a',mimeType:'audio/mp4',size:456,createdAt:'2026-09-02T12:02:00.000Z'}])
    expect(JSON.stringify(journal)).not.toMatch(/private-photo-id|private-audio-id|relatedItemId|conflict/)
    expect(isShareProjectionV1(projection)).toBe(true)

    const titleAndMedia:SharePolicyV1={version:1,audience:'named-trip',preset:'custom',itemTypes:['journal'],fields:['title'],includePhotos:true,includeAudio:false}
    expect(buildShareProjection(richTrip,titleAndMedia,{publishedAt}).trip.items[0]).toMatchObject({type:'journal',title:'Arrival journal',photos:[{driveFileId:'drive-photo-id'}]})
  })

  it('honours custom field/type exclusion, including an intentionally empty item shape',()=>{
    const titleOnly:SharePolicyV1={version:1,audience:'public-trip',preset:'custom',itemTypes:['event'],fields:['title'],includePhotos:false,includeAudio:false}
    const titleProjection=buildShareProjection(richTrip,titleOnly,{publishedAt})
    expect(titleProjection.trip.items).toEqual([{title:'Museum'}])
    expect(titleProjection.trip).not.toHaveProperty('destination')
    const noFields:SharePolicyV1={...titleOnly,fields:[]}
    const projection=buildShareProjection(richTrip,noFields,{publishedAt,accessMode:'snapshot'})
    expect(projection.trip.items).toEqual([{}])
    expect(isShareProjectionV1(projection)).toBe(true)
  })

  it('migrates legacy journal entries into filtered projection items and preserves safe attribution only',()=>{
    const source:Trip={...richTrip,items:[],journalEntries:[{id:'legacy-private-id',date:'2026-09-02',text:'Legacy journal',photos:[],createdAt:'2026-09-02T00:00:00.000Z',updatedAt:'2026-09-02T01:00:00.000Z',createdBy:author,updatedBy:author}]}
    const policy:SharePolicyV1={version:1,audience:'named-trip',preset:'custom',itemTypes:['journal'],fields:['type','title','notes','createdBy','updatedBy'],includePhotos:false,includeAudio:false}
    expect(buildShareProjection(source,policy,{publishedAt}).trip.items).toEqual([{type:'journal',title:'Legacy journal',notes:'Legacy journal',createdBy:author,updatedBy:author}])
    expect(source.journalEntries).toHaveLength(1)
  })

  it('omits malformed web links instead of reflecting them',()=>{
    const source=structuredClone(richTrip)
    source.items[0].link='javascript:alert(1)'
    source.items[0].emailLink='http://mail.example/message'
    const projection=buildShareProjection(source,sharePolicyForPreset('public-trip','full'),{publishedAt})
    expect(projection.trip.items[0]).not.toHaveProperty('link')
    expect(projection.trip.items[0]).not.toHaveProperty('emailLink')
  })

  it('fails closed when malformed in-memory data cannot produce a valid projection',()=>{
    const source=structuredClone(richTrip)
    source.items[0].title='x'.repeat(501)
    expect(()=>buildShareProjection(source,DEFAULT_PUBLIC_SHARE_POLICY,{publishedAt})).toThrow(/safely/)
  })

  it('is deterministic for the same source, policy, and explicit publication time',()=>{
    const policy:SharePolicyV1={...DEFAULT_PUBLIC_SHARE_POLICY,itemTypes:['stay','flight'],fields:[...DEFAULT_PUBLIC_SHARE_POLICY.fields].reverse()}
    expect(buildShareProjection(richTrip,policy,{publishedAt})).toEqual(buildShareProjection(richTrip,normalizeSharePolicy(policy),{publishedAt}))
  })

  it('rejects access-mode mismatches and invalid publication times',()=>{
    expect(()=>buildShareProjection(richTrip,DEFAULT_PUBLIC_SHARE_POLICY,{publishedAt,accessMode:'named-viewer'})).toThrow(/access mode/)
    expect(()=>buildShareProjection(richTrip,DEFAULT_PUBLIC_SHARE_POLICY,{publishedAt:'not a date'})).toThrow(/publication time/)
  })

  it('strictly rejects unknown projection fields, malformed values, and media in anonymous projections',()=>{
    const publicProjection=buildShareProjection(richTrip,DEFAULT_PUBLIC_SHARE_POLICY,{publishedAt})
    expect(isShareProjectionV1({...publicProjection,oauthToken:'secret'})).toBe(false)
    expect(isShareProjectionV1({...publicProjection,trip:{...publicProjection.trip,id:'private'}})).toBe(false)
    expect(isShareProjectionV1({...publicProjection,trip:{...publicProjection.trip,items:[{title:'Flight',futureSecret:'x'}]}})).toBe(false)
    expect(isShareProjectionV1({...publicProjection,trip:{...publicProjection.trip,items:[{link:'javascript:alert(1)'}]}})).toBe(false)
    expect(isShareProjectionV1({...publicProjection,trip:{...publicProjection.trip,items:[{photos:[]}]}})).toBe(false)
    expect(isShareProjectionV1({...publicProjection,accessMode:'named-viewer',trip:{...publicProjection.trip,items:[{type:'flight',photos:[]}]}})).toBe(false)

    const named=buildShareProjection(richTrip,{...sharePolicyForPreset('named-trip','full'),includePhotos:true},{publishedAt})
    const journalIndex=named.trip.items.findIndex(item=>item.type==='journal'),items=structuredClone(named.trip.items)
    ;(items[journalIndex].photos![0] as unknown as Record<string,unknown>).attachmentId='private'
    expect(isShareProjectionV1({...named,trip:{...named.trip,items}})).toBe(false)
  })

  it('strictly validates projection dates, time zones, and total serialized size',()=>{
    const projection=buildShareProjection(richTrip,DEFAULT_PUBLIC_SHARE_POLICY,{publishedAt})
    expect(isShareProjectionV1({...projection,publishedAt:'2026-02-31T12:00:00.000Z'})).toBe(false)
    expect(isShareProjectionV1({...projection,trip:{...projection.trip,items:[{start:'2026-09-31T10:00',timeZone:'Europe/Dublin'}]}})).toBe(false)
    expect(isShareProjectionV1({...projection,trip:{...projection.trip,items:[{start:'2026-09-01T10:00',timeZone:'Mars/Olympus_Mons'}]}})).toBe(false)
    const oversizedItems=Array.from({length:450},()=>({notes:'x'.repeat(12_000)}))
    expect(isShareProjectionV1({...projection,trip:{...projection.trip,items:oversizedItems}})).toBe(false)
  })
})
