// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CALENDAR_SHARE_POLICY, DEFAULT_NAMED_SHARE_POLICY, DEFAULT_PUBLIC_SHARE_POLICY, sharePolicyForPreset } from './sharePolicy'
import { PermissionPoliciesPanel } from './PermissionPoliciesPanel'

afterEach(cleanup)

describe('PermissionPoliciesPanel',()=>{
  it('contains the detailed policy editors outside Sync & Share',()=>{
    render(<PermissionPoliciesPanel publicPolicy={DEFAULT_PUBLIC_SHARE_POLICY} namedPolicy={DEFAULT_NAMED_SHARE_POLICY} calendarPolicy={DEFAULT_CALENDAR_SHARE_POLICY} onPublicPolicyChange={vi.fn()} onNamedPolicyChange={vi.fn()} onCalendarPolicyChange={vi.fn()} onBack={vi.fn()} onClose={vi.fn()}/>)
    expect(screen.getByRole('heading',{name:'Permission Policies'})).toBeTruthy()
    expect(screen.getAllByText('Visible itinerary types')).toHaveLength(3)
    const named=screen.getByRole('heading',{name:'Named Trip Viewers'}).closest('section') as HTMLElement
    expect(within(named).getByText('Original journal media')).toBeTruthy()
  })

  it('keeps named photo and audio choices as additions to the selected preset',async()=>{
    const user=userEvent.setup(),onNamedPolicyChange=vi.fn(),namedFull=sharePolicyForPreset('named-trip','full')
    render(<PermissionPoliciesPanel publicPolicy={DEFAULT_PUBLIC_SHARE_POLICY} namedPolicy={namedFull} calendarPolicy={DEFAULT_CALENDAR_SHARE_POLICY} onPublicPolicyChange={vi.fn()} onNamedPolicyChange={onNamedPolicyChange} onCalendarPolicyChange={vi.fn()} onBack={vi.fn()} onClose={vi.fn()}/>)
    const named=screen.getByRole('heading',{name:'Named Trip Viewers'}).closest('section') as HTMLElement
    await user.click(within(named).getByRole('checkbox',{name:'Photos'}))
    expect(onNamedPolicyChange).toHaveBeenCalledWith(expect.objectContaining({preset:'full',includePhotos:true}))
  })
})
