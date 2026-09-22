import { describe, expect, it } from 'vitest'
import { buildEmailExtractionPrompt, validExtractionParameters, type EmailExtractionPromptInput } from './emailExtractionPrompt'
import { createTripExportV2, migrateTripExportToV2, validTripExport } from './tripImport'
import { mergeTripVersions } from './tripMerge'
import { buildShareProjection, DEFAULT_PUBLIC_SHARE_POLICY, DEFAULT_NAMED_SHARE_POLICY } from './sharePolicy'
import type { Trip } from './types'

const parameters:EmailExtractionPromptInput={tripName:'Summer trip',destination:'Dublin',travelStart:'2025-07-01',travelEnd:'2025-07-15',emailStart:'2025-01-01',emailEnd:'2025-04-30',people:'Private provider hint',clues:'Private booking hint',searchCategories:{flight:false,train:true}}
const trip:Trip={id:'trip',name:'Summer trip',destination:'Dublin',createdAt:'2025-01-01T00:00:00Z',updatedAt:'2025-01-01T00:00:00Z',items:[],extractionParameters:parameters}
const later={...parameters,emailStart:'2025-05-01',emailEnd:'2025-06-01'}

describe('saved extraction parameters',()=>{
  it('round trips all settings through private export and import without sharing references',()=>{
    const exported=createTripExportV2(trip,trip.updatedAt)
    const imported=migrateTripExportToV2(JSON.parse(JSON.stringify(exported)))!
    expect(imported.trip.extractionParameters).toEqual(parameters)
    exported.trip.extractionParameters!.searchCategories!.flight=true
    expect(parameters.searchCategories!.flight).toBe(false)
    expect(validTripExport(createTripExportV2({...trip,extractionParameters:undefined},trip.updatedAt))).toBe(true)
  })

  it.each([
    {emailStart:'2025-02-30'}, {emailStart:'2025-05-01'}, {travelEnd:'2025-06-30'},
    {people:42}, {clues:'x'.repeat(12001)}, {searchCategories:{flight:'yes'}},
    {searchCategories:{unknown:true}}, {extra:'unexpected'},
  ])('rejects invalid imported settings: %j',change=>{
    const value={...parameters,...change}
    expect(validExtractionParameters(value)).toBe(false)
    expect(validTripExport({schemaVersion:2,exportedAt:trip.updatedAt,trip:{...trip,extractionParameters:value}})).toBe(false)
  })

  it('embeds the exact settings in the requested output JSON',()=>{
    const prompt=buildEmailExtractionPrompt(later)
    const schema=JSON.parse(prompt.slice(prompt.indexOf('{\n  "schemaVersion"'),prompt.indexOf('\n\nOmit optional keys')))
    expect(schema.trip.extractionParameters).toEqual(later)
  })

  it('merges settings by value when another device edits the window',()=>{
    const unchanged=JSON.parse(JSON.stringify(trip)) as Trip
    expect(mergeTripVersions(trip,unchanged,{...trip,extractionParameters:later}).trip.extractionParameters).toEqual(later)
    expect(mergeTripVersions(trip,{...trip,extractionParameters:later},unchanged).trip.extractionParameters).toEqual(later)
  })

  it('excludes extraction settings from every shared view',()=>{
    for(const accessMode of ['snapshot','public-viewer','named-viewer'] as const){
      const projection=buildShareProjection(trip,accessMode==='named-viewer'?DEFAULT_NAMED_SHARE_POLICY:DEFAULT_PUBLIC_SHARE_POLICY,{accessMode,publishedAt:trip.updatedAt})
      expect(projection.trip).not.toHaveProperty('extractionParameters')
      expect(JSON.stringify(projection)).not.toContain('Private provider hint')
    }
  })
})
