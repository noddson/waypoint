import { describe, expect, it } from 'vitest'
import { TripItem, overlappingEventIds } from './types'

const item=(id:string,type:TripItem['type'],start:string,end?:string,timeZone='Europe/Dublin'):TripItem=>({id,type,title:id,start,end,timeZone,status:'confirmed'})

describe('schedule overlap warnings',()=>{
  it('flags overlapping events',()=>{
    const overlaps=overlappingEventIds([
      item('museum','event','2026-07-20T10:00','2026-07-20T12:00'),
      item('tour','event','2026-07-20T11:30','2026-07-20T13:00'),
    ])
    expect([...overlaps].sort()).toEqual(['museum','tour'])
  })

  it('does not compare events with stays or car rentals',()=>{
    const overlaps=overlappingEventIds([
      item('hotel','stay','2026-07-19T15:00','2026-07-22T11:00'),
      item('car','car','2026-07-20T09:00','2026-07-25T16:00'),
      item('museum','event','2026-07-20T10:00','2026-07-20T12:00'),
    ])
    expect([...overlaps]).toEqual([])
  })

  it('does not flag adjacent events or events in different time zones',()=>{
    const overlaps=overlappingEventIds([
      item('first','event','2026-07-20T10:00','2026-07-20T11:00'),
      item('next','event','2026-07-20T11:00','2026-07-20T12:00'),
      item('elsewhere','event','2026-07-20T10:30','2026-07-20T11:30','America/Toronto'),
    ])
    expect([...overlaps]).toEqual([])
  })
})
