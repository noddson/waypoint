import { describe, expect, it } from 'vitest'
import { confirmationCodeValue, confirmationCodesEnabledFromStorage, confirmationCodesStorageValue, nextConfirmationCodeFormat } from './confirmationCodeFormat'

describe('confirmation code',()=>{
  it('normalizes non-empty confirmation values',()=>{
    expect(confirmationCodeValue('  ABC123  ')).toBe('ABC123')
    expect(confirmationCodeValue('   ')).toBeUndefined()
    expect(confirmationCodeValue()).toBeUndefined()
  })

  it('toggles between QR and Code 128 formats',()=>{
    expect(nextConfirmationCodeFormat('qr')).toBe('code128')
    expect(nextConfirmationCodeFormat('code128')).toBe('qr')
  })

  it('defaults confirmation-code display to enabled and persists explicit choices',()=>{
    expect(confirmationCodesEnabledFromStorage(null)).toBe(true)
    expect(confirmationCodesEnabledFromStorage('enabled')).toBe(true)
    expect(confirmationCodesEnabledFromStorage('disabled')).toBe(false)
    expect(confirmationCodesStorageValue(true)).toBe('enabled')
    expect(confirmationCodesStorageValue(false)).toBe('disabled')
  })
})
