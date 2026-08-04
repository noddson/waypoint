import { describe, expect, it } from 'vitest'
import { calendarDeliveryFromStorage } from './calendarDelivery'

describe('calendar delivery preference',()=>{
  it('defaults to a portable file export',()=>{
    expect(calendarDeliveryFromStorage(null)).toBe('export')
    expect(calendarDeliveryFromStorage('unsupported')).toBe('export')
  })

  it('restores calendar subscription mode',()=>{
    expect(calendarDeliveryFromStorage('subscription')).toBe('subscription')
  })
})
