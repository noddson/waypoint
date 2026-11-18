// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DriveTripCopies } from './DriveTripCopies'
import { DriveTripIdentityError, inspectDriveTripCopy } from './googleDrive'
import type { Trip } from './types'

vi.mock('./googleDrive',async importOriginal=>({...await importOriginal<typeof import('./googleDrive')>(),inspectDriveTripCopy:vi.fn()}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
const files=[{id:'phone',name:'Workshop.waypoint.json',canonical:false},{id:'desktop',name:'Workshop.waypoint.json',canonical:false}]
const trip:Trip={id:'same-trip',name:'Workshop',destination:'Philadelphia',createdAt:'2026-09-22T01:52:00.000Z',updatedAt:'2026-11-18T22:41:00.000Z',items:[{id:'class',type:'event',title:'Hard CORE Staff',start:'2026-11-21T09:40',timeZone:'America/New_York',status:'planned'}]}

describe('duplicate Drive trip recovery',()=>{
  it('shows actual edit dates and contents before an explicit choice',async()=>{
    const user=userEvent.setup(),onChoose=vi.fn()
    vi.mocked(inspectDriveTripCopy).mockImplementation(async(_,file)=>({file,trip:file.id==='phone'?trip:{...trip,items:[],updatedAt:'2026-09-22T02:31:00.000Z'}}))
    render(<DriveTripCopies issue={new DriveTripIdentityError(trip.id,files)} busy={false} onChoose={onChoose}/>)
    await screen.findByText('2026-11-21 — Hard CORE Staff')
    const cards=screen.getAllByRole('article')
    expect(within(cards[0]).getByText(/1 item · Last edited/)).toBeTruthy()
    expect(within(cards[1]).getByText(/0 items · Last edited/)).toBeTruthy()
    expect(onChoose).not.toHaveBeenCalled()
    await user.click(within(cards[0]).getByRole('button',{name:'Use this copy on all devices'}))
    expect(onChoose).toHaveBeenCalledWith(files[0])
  })

  it('only allows opening the copy already chosen on another device',async()=>{
    vi.mocked(inspectDriveTripCopy).mockImplementation(async(_,file)=>({file,trip}))
    render(<DriveTripCopies issue={new DriveTripIdentityError(trip.id,files,'phone')} busy={false} onChoose={vi.fn()}/>)
    await waitFor(()=>expect((screen.getByRole('button',{name:'Open current copy'}) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('prevents selecting an unreadable copy or clicking twice while the choice saves',async()=>{
    vi.mocked(inspectDriveTripCopy).mockImplementation(async(_,file)=>{if(file.id==='desktop')throw new Error('File unreadable');return {file,trip}})
    render(<DriveTripCopies issue={new DriveTripIdentityError(trip.id,files)} busy={true} onChoose={vi.fn()}/>)
    await screen.findByText('File unreadable')
    expect(screen.getAllByRole('button').every(button=>(button as HTMLButtonElement).disabled)).toBe(true)
  })
})
