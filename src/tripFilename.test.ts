import { describe, expect, it } from 'vitest'
import { tripJsonFilename } from './tripFilename'

describe('trip JSON filenames',()=>{
  it('uses a single destination with the travel month and year',()=>{
    expect(tripJsonFilename({name:'Family holiday',destination:'Ireland',start:'2026-07-18'})).toBe('Ireland-July-2026.json')
  })

  it('uses the destination between a repeated origin and return',()=>{
    expect(tripJsonFilename({name:'Summer trip',destination:'Toronto → Ireland → Toronto',start:'2026-07-18'})).toBe('Ireland-July-2026.json')
  })

  it('uses the trip name for a complex route and creates a safe filename',()=>{
    expect(tripJsonFilename({name:'Alpine friends / 2027',destination:'Paris → Lyon → Geneva',start:'2027-02-03'})).toBe('Alpine-friends-February-2027.json')
  })
})
