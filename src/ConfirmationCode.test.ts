import { describe, expect, it } from 'vitest'
import { confirmationCodeValue, nextConfirmationCodeFormat } from './confirmationCodeFormat'

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
})
