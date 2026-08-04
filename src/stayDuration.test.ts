import { describe, expect, it } from 'vitest'
import { multiNightStayLabel, stayNightCount } from './stayDuration'

describe('stay duration',()=>{
  it('counts local calendar nights rather than elapsed hours',()=>{
    expect(stayNightCount('2026-07-23T15:00','2026-07-25T11:00')).toBe(2)
    expect(stayNightCount('2026-03-07T23:30','2026-03-09T07:00')).toBe(2)
  })

  it('handles calendar boundaries',()=>{
    expect(stayNightCount('2026-12-30T15:00','2027-01-02T11:00')).toBe(3)
  })

  it('labels only multi-night stays',()=>{
    expect(multiNightStayLabel({type:'stay',start:'2026-07-23T15:00',end:'2026-07-25T11:00'})).toBe('2 nights')
    expect(multiNightStayLabel({type:'stay',start:'2026-07-23T15:00',end:'2026-07-24T11:00'})).toBeUndefined()
    expect(multiNightStayLabel({type:'event',start:'2026-07-23T15:00',end:'2026-07-25T11:00'})).toBeUndefined()
  })

  it('omits incomplete or invalid ranges',()=>{
    expect(stayNightCount('2026-07-23T15:00')).toBeUndefined()
    expect(stayNightCount('2026-07-25T15:00','2026-07-23T11:00')).toBeUndefined()
    expect(stayNightCount('not-a-date','2026-07-25T11:00')).toBeUndefined()
  })
})
