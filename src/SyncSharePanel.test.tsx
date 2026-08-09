// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CALENDAR_SHARE_POLICY, DEFAULT_NAMED_SHARE_POLICY, DEFAULT_PUBLIC_SHARE_POLICY } from './sharePolicy'
import { SyncSharePanel, type SyncSharePanelProps } from './SyncSharePanel'
import type { DrivePermissionSnapshot, SharePolicyV1 } from './types'

afterEach(cleanup)

const policy=(source:SharePolicyV1):SharePolicyV1=>({...source,itemTypes:[...source.itemTypes],fields:[...source.fields]})
const action=()=>vi.fn()

function panelProps(overrides:Partial<SyncSharePanelProps>={}):SyncSharePanelProps {
  return {
    connected:false,linked:false,canShare:false,isOwner:true,busy:false,
    publicEnabled:false,namedEnabled:false,calendarEnabled:false,
    publicPolicy:policy(DEFAULT_PUBLIC_SHARE_POLICY),namedPolicy:policy(DEFAULT_NAMED_SHARE_POLICY),calendarPolicy:policy(DEFAULT_CALENDAR_SHARE_POLICY),
    namedViewers:[],collaborators:[],
    onPublicPolicyChange:action(),onNamedPolicyChange:action(),onCalendarPolicyChange:action(),
    onStartSync:action(),onSync:action(),onStopSync:action(),onSnapshot:action(),
    onSetPublicEnabled:action(),onCopyPublicLink:action(),onSetNamedEnabled:action(),onPublishNamed:action(),
    onAddNamedViewer:action(),onAddCollaborator:action(),onRevokeNamed:action(),onRemoveAllNamed:action(),
    onCalendarSnapshot:action(),onSetCalendarEnabled:action(),onCopyCalendarLink:action(),
    onBack:action(),onClose:action(),
    ...overrides,
  }
}

const disabled=(button:HTMLElement)=>(button as HTMLButtonElement).disabled
const section=(heading:string)=>screen.getByRole('heading',{name:heading}).closest('section') as HTMLElement

describe('SyncSharePanel connection and access gating',()=>{
  it('shows only status and Sync and Update for Drive connection handling',async()=>{
    const user=userEvent.setup(),onStartSync=vi.fn(),onSync=vi.fn(),onStopSync=vi.fn()
    const view=render(<SyncSharePanel {...panelProps({onStartSync,onSync,onStopSync})}/>)

    expect(screen.queryByRole('button',{name:'(Re)Connect to Google Drive'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Disconnect from Google Drive'})).toBeNull()
    expect(screen.getByText('Disconnected')).toBeTruthy()
    expect(disabled(screen.getByRole('button',{name:'Sync and Update'}))).toBe(true)
    await user.click(screen.getByRole('button',{name:'Start syncing this trip'}))
    expect(onStartSync).toHaveBeenCalledOnce()

    view.rerender(<SyncSharePanel {...panelProps({connected:false,linked:true,canShare:true,onStartSync,onSync,onStopSync})}/>)
    expect(screen.queryByRole('button',{name:'Start syncing this trip'})).toBeNull()
    expect(screen.getByRole('button',{name:'Stop syncing this trip'})).toBeTruthy()
    await user.click(screen.getByRole('button',{name:'Sync and Update'}))
    await user.click(screen.getByRole('button',{name:'Stop syncing this trip'}))
    expect(onSync).toHaveBeenCalledOnce()
    expect(onStopSync).toHaveBeenCalledOnce()
  })

  it('allows sync but gates every sharing and ACL mutation without canShare',()=>{
    const named:DrivePermissionSnapshot={id:'reader-1',type:'user',role:'reader',emailAddress:'reader@example.com'}
    const collaborator:DrivePermissionSnapshot={id:'writer-1',type:'user',role:'writer',emailAddress:'writer@example.com'}
    render(<SyncSharePanel {...panelProps({connected:true,linked:true,isOwner:false,canShare:false,namedViewers:[named],collaborators:[collaborator]})}/>)

    expect(disabled(screen.getByRole('button',{name:'Sync and Update'}))).toBe(false)
    expect(screen.queryByRole('button',{name:'Start syncing this trip'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Stop syncing this trip'})).toBeNull()
    expect(disabled(screen.getByRole('button',{name:'Create a Trip Snapshot'}))).toBe(true)
    expect(disabled(within(section('Public Live Trip')).getByRole('button',{name:'Publish public trip'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Add viewer'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Add collaborator'}))).toBe(true)
    expect(screen.getAllByRole('button',{name:'Revoke'}).every(disabled)).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Download calendar snapshot'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Publish live calendar'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Remove all named access'}))).toBe(true)
  })

  it('disables the complete panel while an operation is busy',()=>{
    const {container}=render(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:true,busy:true})}/>)
    expect(screen.getByRole('button',{name:'Working…'})).toBeTruthy()
    const operationButtons=[...container.querySelectorAll<HTMLButtonElement>('.sync-share-section button, .remove-all-access')]
    expect(operationButtons.length).toBeGreaterThan(0)
    expect(operationButtons.every(button=>button.disabled)).toBe(true)
  })

  it('keeps the access-audit action available when cached top-level lists are empty',()=>{
    render(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:true,namedViewers:[],collaborators:[]})}/>)
    expect(disabled(screen.getByRole('button',{name:'Remove all named access'}))).toBe(false)
  })

  it('allows an owner to configure snapshot policies while Drive is disconnected',()=>{
    render(<SyncSharePanel {...panelProps({connected:false,linked:false,canShare:true,isOwner:true})}/>)
    for(const name of ['Public Trip policy','Named Trip policy','Public Calendar policy'])expect(disabled(screen.getByRole('combobox',{name}))).toBe(false)
    expect(screen.queryByText('Visible itinerary types')).toBeNull()
    expect(disabled(within(section('Public Live Trip')).getByRole('button',{name:'Publish public trip'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Create a Trip Snapshot'}))).toBe(false)
  })

  it('only selects a policy preset and leaves detailed policy editing elsewhere',async()=>{
    const user=userEvent.setup(),onPublicPolicyChange=vi.fn()
    render(<SyncSharePanel {...panelProps({onPublicPolicyChange})}/>)
    await user.selectOptions(screen.getByRole('combobox',{name:'Public Trip policy'}),'full')
    expect(onPublicPolicyChange).toHaveBeenCalledWith(expect.objectContaining({audience:'public-trip',preset:'full'}))
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('keeps local snapshots available but requires positive canShare for Drive sharing',()=>{
    render(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:false,isOwner:true})}/>)

    expect(disabled(screen.getByRole('button',{name:'Create a Trip Snapshot'}))).toBe(false)
    expect(disabled(screen.getByRole('button',{name:'Download calendar snapshot'}))).toBe(false)
    expect(disabled(within(section('Public Live Trip')).getByRole('button',{name:'Publish public trip'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Add viewer'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Add collaborator'}))).toBe(true)
    expect(disabled(screen.getByRole('button',{name:'Publish live calendar'}))).toBe(true)
  })
})

describe('SyncSharePanel sharing workflows',()=>{
  it('normalizes named viewer emails and clears the input after a successful add',async()=>{
    const user=userEvent.setup(),onAddNamedViewer=vi.fn()
    render(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:true,onAddNamedViewer})}/>)

    const input=screen.getByRole('textbox',{name:'Named viewer email'}) as HTMLInputElement
    await user.type(input,'Viewer@Example.COM')
    await user.click(screen.getByRole('button',{name:'Add viewer'}))
    await waitFor(()=>expect(onAddNamedViewer).toHaveBeenCalledWith('viewer@example.com'))
    expect(input.value).toBe('')
  })

  it('shows stale-publication update actions and republishes the existing audience',async()=>{
    const user=userEvent.setup(),onSetPublicEnabled=vi.fn(),onPublishNamed=vi.fn(),onSetCalendarEnabled=vi.fn()
    render(<SyncSharePanel {...panelProps({
      connected:true,linked:true,canShare:true,
      publicEnabled:true,namedEnabled:true,calendarEnabled:true,
      publicStale:true,namedStale:true,calendarStale:true,
      publicPublishedAt:'2026-08-09T12:00:00.000Z',namedPublishedAt:'2026-08-09T12:00:00.000Z',calendarPublishedAt:'2026-08-09T12:00:00.000Z',
      onSetPublicEnabled,onPublishNamed,onSetCalendarEnabled,
    })}/>)

    expect(screen.getAllByText('Update needed')).toHaveLength(3)
    await user.click(within(section('Public Live Trip')).getByRole('button',{name:'Publish update'}))
    await user.click(screen.getByRole('button',{name:'Publish named-viewer update'}))
    await user.click(within(section('Calendar')).getByRole('button',{name:'Publish update'}))
    expect(onSetPublicEnabled).toHaveBeenCalledWith(true)
    expect(onPublishNamed).toHaveBeenCalledOnce()
    expect(onSetCalendarEnabled).toHaveBeenCalledWith(true)
  })

  it('turns the named live artifact on and off through its lifecycle control',async()=>{
    const user=userEvent.setup(),onSetNamedEnabled=vi.fn()
    const view=render(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:true,onSetNamedEnabled})}/>)
    await user.click(screen.getByRole('button',{name:'Create named sharing link'}))
    expect(onSetNamedEnabled).toHaveBeenCalledWith(true)
    view.rerender(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:true,namedEnabled:true,onSetNamedEnabled})}/>)
    await user.click(screen.getByRole('button',{name:'Turn off named sharing'}))
    expect(onSetNamedEnabled).toHaveBeenCalledWith(false)
  })

  it('labels broader pending policies as requiring explicit sensitive review',()=>{
    render(<SyncSharePanel {...panelProps({
      connected:true,linked:true,canShare:true,publicEnabled:true,namedEnabled:true,calendarEnabled:true,
      publicStale:true,namedStale:true,calendarStale:true,
      publicReviewRequired:true,namedReviewRequired:true,calendarReviewRequired:true,
    })}/>)

    expect(screen.getAllByText('Sensitive review required')).toHaveLength(3)
    expect(screen.getAllByRole('button',{name:/Publish (?:update|named-viewer update)/})).toHaveLength(3)
  })

  it('keeps sharing controls concise',()=>{
    render(<SyncSharePanel {...panelProps({connected:true,linked:true,canShare:true})}/>)
    expect(screen.getByText('Collaborators can edit the canonical trip and its media.')).toBeTruthy()
    expect(screen.queryByText(/without duplicating/)).toBeNull()
    expect(screen.queryByText(/cannot guarantee exclusive control/)).toBeNull()
  })
})
