// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { TripAccessBanner, UnifiedMenuDialog, UnifiedMenuHome, UnifiedMenuPanel } from './UnifiedMenu'

afterEach(cleanup)

describe('UnifiedMenuHome',()=>{
  it('exposes every desktop and mobile destination through one accessible menu',async()=>{
    const user=userEvent.setup(),onSelect=vi.fn(),onClose=vi.fn()
    render(<UnifiedMenuHome tripName="Tokyo spring" driveStatus="Google Drive connected" onSelect={onSelect} onClose={onClose}/>)

    expect(screen.getByRole('navigation',{name:'Waypoint menu'})).toBeTruthy()
    for(const destination of ['Your Trips','Trip Actions','Sync & Share','Permission Policies','Settings']){
      expect(screen.getByRole('button',{name:new RegExp(destination)})).toBeTruthy()
    }
    expect(screen.queryByRole('button',{name:/^Profile/})).toBeNull()
    expect(screen.queryByRole('button',{name:/^Language/})).toBeNull()
    expect(screen.getByText('Tokyo spring')).toBeTruthy()
    expect(screen.getByText('Google Drive connected')).toBeTruthy()

    await user.click(screen.getByRole('button',{name:/Sync & Share/}))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('sync-share')

    await user.click(screen.getByRole('button',{name:'Close menu'}))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the desktop drawer and mobile landscape sheet breakpoints in the shared stylesheet',()=>{
    const css=readFileSync(join(process.cwd(),'src/unifiedMenu.css'),'utf8')
    expect(css).toContain('@media(min-width:721px){.mobile-sheet-backdrop{place-items:stretch end;padding:0}')
    expect(css).toContain('.mobile-sheet{width:min(440px,100%);max-height:100vh;height:100vh')
    expect(css).toContain('@media screen and (orientation:landscape){body.mobile-experience .mobile-landscape-menu-trigger{display:grid!important')
    expect(css).toContain('body.mobile-experience .mobile-sheet-backdrop{display:grid!important;place-items:stretch end!important}')
  })
})

describe('UnifiedMenuDialog',()=>{
  function Harness(){
    const [open,setOpen]=useState(false)
    return <><button type="button" onClick={()=>setOpen(true)}>Open Waypoint menu</button>{open&&<UnifiedMenuDialog onDismiss={()=>setOpen(false)}><UnifiedMenuHome tripName="Trip" driveStatus="Local" onSelect={()=>{}} onClose={()=>setOpen(false)}/></UnifiedMenuDialog>}</>
  }

  it('moves focus into the menu, traps tab focus, and restores the trigger on close',async()=>{
    const user=userEvent.setup();render(<Harness/>)
    const trigger=screen.getByRole('button',{name:'Open Waypoint menu'})
    await user.click(trigger)
    const dialog=screen.getByRole('dialog',{name:'Waypoint menu'}),firstDestination=screen.getByRole('button',{name:/Your Trips/}),close=screen.getByRole('button',{name:'Close menu'})
    expect(document.activeElement).toBe(firstDestination)
    close.focus();await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(screen.getByRole('button',{name:/Settings/}))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog',{name:'Waypoint menu'})).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(dialog.isConnected).toBe(false)
  })
})

describe('UnifiedMenuPanel',()=>{
  it('moves focus to the panel heading and provides named back and close controls',async()=>{
    const user=userEvent.setup(),onBack=vi.fn(),onClose=vi.fn()
    render(<UnifiedMenuPanel title="Profile" onBack={onBack} onClose={onClose}><p>Panel content</p></UnifiedMenuPanel>)

    const heading=screen.getByRole('heading',{name:'Profile',level:2})
    await waitFor(()=>expect(document.activeElement).toBe(heading))
    await user.click(screen.getByRole('button',{name:'Back to menu'}))
    await user.click(screen.getByRole('button',{name:'Close Profile'}))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('TripAccessBanner',()=>{
  it.each([
    ['collaborator','Collaborative trip','co-authoring'],
    ['named-viewer','Shared with you','named, read-only'],
    ['public-viewer','Public live trip','read-only view'],
    ['snapshot','Static snapshot','fixed, read-only'],
  ] as const)('announces %s access clearly', (mode,title,detail)=>{
    render(<TripAccessBanner mode={mode}/>)
    const status=screen.getByRole('status')
    expect(status.textContent).toContain(title)
    expect(status.textContent).toContain(detail)
  })
})
