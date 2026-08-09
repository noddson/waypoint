// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileV1 } from './profile'
import { ProfilePanel } from './ProfilePanel'

afterEach(cleanup)

const profile:ProfileV1={
  schemaVersion:1,
  profileId:'profile-alex',
  name:'Alex Traveller',
  email:'alex@example.com',
  homeBase:'Toronto, Canada',
  updatedAt:'2026-08-09T12:00:00.000Z',
}

const noop=()=>{}

describe('ProfilePanel',()=>{
  it('loads a saved profile without extra metadata or explanatory copy',()=>{
    render(<ProfilePanel profile={profile} busy={false} onSave={noop} onBack={noop} onClose={noop}/>)

    expect((screen.getByRole('textbox',{name:'Name'}) as HTMLInputElement).value).toBe('Alex Traveller')
    expect((screen.getByRole('textbox',{name:'Email'}) as HTMLInputElement).value).toBe('alex@example.com')
    expect((screen.getByRole('textbox',{name:'Home base'}) as HTMLInputElement).value).toBe('Toronto, Canada')
    expect(screen.queryByText(/Profile ID/)).toBeNull()
    expect(screen.queryByText(/viewer projections/)).toBeNull()
    expect(screen.getByRole('button',{name:'Back to Settings'})).toBeTruthy()
  })

  it('validates name and email before invoking profile persistence',async()=>{
    const onSave=vi.fn()
    render(<ProfilePanel busy={false} onSave={onSave} onBack={noop} onClose={noop}/>)
    const form=screen.getByRole('button',{name:'Save profile'}).closest('form') as HTMLFormElement

    fireEvent.submit(form)
    expect((await screen.findByRole('alert')).textContent).toContain('Enter your name to save your profile.')
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox',{name:'Name'}),{target:{value:'Alex'}})
    fireEvent.change(screen.getByRole('textbox',{name:'Email'}),{target:{value:'not-an-email'}})
    fireEvent.submit(form)
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a valid email address or leave it blank.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves entered profile details and presents persistence errors',async()=>{
    const user=userEvent.setup(),onSave=vi.fn().mockRejectedValueOnce(new Error('Drive profile write failed.'))
    render(<ProfilePanel busy={false} onSave={onSave} onBack={noop} onClose={noop}/>)

    await user.type(screen.getByRole('textbox',{name:'Name'}),'Taylor')
    await user.type(screen.getByRole('textbox',{name:'Email'}),'taylor@example.com')
    await user.type(screen.getByRole('textbox',{name:'Home base'}),'Montréal, Canada')
    await user.click(screen.getByRole('button',{name:'Save profile'}))

    await waitFor(()=>expect(onSave).toHaveBeenCalledWith({name:'Taylor',email:'taylor@example.com',homeBase:'Montréal, Canada'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Drive profile write failed.')
  })

  it('refreshes fields when a newer reconciled profile arrives and gates duplicate saves while busy',async()=>{
    const updated={...profile,name:'Alex Updated',homeBase:'Ottawa, Canada',updatedAt:'2026-08-09T13:00:00.000Z'}
    const view=render(<ProfilePanel profile={profile} busy={false} onSave={noop} onBack={noop} onClose={noop}/>)
    view.rerender(<ProfilePanel profile={updated} busy={true} onSave={noop} onBack={noop} onClose={noop}/>)

    await waitFor(()=>expect((screen.getByRole('textbox',{name:'Name'}) as HTMLInputElement).value).toBe('Alex Updated'))
    expect((screen.getByRole('textbox',{name:'Home base'}) as HTMLInputElement).value).toBe('Ottawa, Canada')
    const button=screen.getByRole('button',{name:'Saving profile…'}) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
