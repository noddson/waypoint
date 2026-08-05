import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calendarActionLabel, calendarDeliveryFromStorage, loadExportedCalendarTripIds, saveExportedCalendarTripIds, stayCalendarTimingFromStorage } from './calendarDelivery'

describe('calendar delivery preference',()=>{
  it('defaults to a portable file export',()=>{
    expect(calendarDeliveryFromStorage(null)).toBe('export')
    expect(calendarDeliveryFromStorage('unsupported')).toBe('export')
  })

  it('restores calendar subscription mode',()=>{
    expect(calendarDeliveryFromStorage('subscription')).toBe('subscription')
  })

  it('changes a published subscription action from publish to show',()=>{
    expect(calendarActionLabel('subscription',false)).toBe('Publish calendar subscription')
    expect(calendarActionLabel('subscription',true)).toBe('Show published link')
    expect(calendarActionLabel('subscription',true,true)).toBe('Refreshing calendar…')
    expect(calendarActionLabel('export',true)).toBe('Export calendar (.ics)')
  })

  it('defaults stays to their check-in and checkout times',()=>{
    expect(stayCalendarTimingFromStorage(null)).toBe('check-in-out')
    expect(stayCalendarTimingFromStorage('unsupported')).toBe('check-in-out')
    expect(stayCalendarTimingFromStorage('all-day')).toBe('all-day')
  })
})

describe('exported calendar trip markers',()=>{
  const values=new Map<string,string>()

  beforeEach(()=>{
    values.clear()
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>values.set(key,value),
    })
  })

  it('stores unique trip IDs after calendar export',()=>{
    saveExportedCalendarTripIds(['trip-one','trip-two','trip-one'])
    expect(loadExportedCalendarTripIds()).toEqual(['trip-one','trip-two'])
  })

  it('ignores malformed markers',()=>{
    values.set('waypoint-exported-calendar-trips','{"trip":"trip-one"}')
    expect(loadExportedCalendarTripIds()).toEqual([])
  })
})
