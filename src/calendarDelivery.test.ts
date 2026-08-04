import { describe, expect, it } from 'vitest'
import { calendarActionLabel, calendarDeliveryFromStorage, stayCalendarTimingFromStorage } from './calendarDelivery'

describe('calendar delivery preference',()=>{
  it('defaults to a portable file export',()=>{
    expect(calendarDeliveryFromStorage(null)).toBe('export')
    expect(calendarDeliveryFromStorage('unsupported')).toBe('export')
  })

  it('restores calendar subscription mode',()=>{
    expect(calendarDeliveryFromStorage('subscription')).toBe('subscription')
  })

  it('changes a published subscription action from publish to copy',()=>{
    expect(calendarActionLabel('subscription',false)).toBe('Publish calendar subscription')
    expect(calendarActionLabel('subscription',true)).toBe('Copy published link')
    expect(calendarActionLabel('subscription',true,true)).toBe('Refreshing calendar…')
    expect(calendarActionLabel('export',true)).toBe('Export calendar (.ics)')
  })

  it('defaults stays to their check-in and checkout times',()=>{
    expect(stayCalendarTimingFromStorage(null)).toBe('check-in-out')
    expect(stayCalendarTimingFromStorage('unsupported')).toBe('check-in-out')
    expect(stayCalendarTimingFromStorage('all-day')).toBe('all-day')
  })
})
