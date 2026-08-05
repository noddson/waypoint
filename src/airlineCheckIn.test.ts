import { describe, expect, it } from 'vitest'
import { AIRLINE_CHECK_IN_MAPPINGS, AIRLINE_CHECK_IN_OMISSIONS, airlineCheckInForItem, airlineCodeFromFlightNumber } from './airlineCheckIn'
import { TripItem } from './types'

const flight = (flightNumber?:string,provider?:string):TripItem => ({
  id:flightNumber||provider||'flight',
  type:'flight',
  title:'Origin → destination',
  flightNumber,
  provider,
  start:'2026-08-05T12:00',
  timeZone:'America/Toronto',
  status:'confirmed',
})

describe('airline check-in mappings', () => {
  it('exports the 141 verified airline-brand mappings with unique, valid IATA codes and HTTPS URLs', () => {
    expect(AIRLINE_CHECK_IN_MAPPINGS).toHaveLength(141)
    const codes=AIRLINE_CHECK_IN_MAPPINGS.flatMap(mapping=>mapping.iataCodes)
    expect(new Set(codes).size).toBe(codes.length)
    for(const mapping of AIRLINE_CHECK_IN_MAPPINGS){
      expect(mapping.iataCodes.length).toBeGreaterThan(0)
      expect(mapping.iataCodes.every(code=>/^[A-Z0-9]{2}$/.test(code))).toBe(true)
      expect(new URL(mapping.checkInUrl).protocol).toBe('https:')
    }
  })

  it('documents and excludes the four candidates without a verified web check-in URL', () => {
    expect(AIRLINE_CHECK_IN_OMISSIONS.map(omission=>omission.iataCode)).toEqual(['MF','3U','9C','JT'])
    const mappedCodes=AIRLINE_CHECK_IN_MAPPINGS.flatMap(mapping=>mapping.iataCodes)
    expect(AIRLINE_CHECK_IN_OMISSIONS.every(omission=>!mappedCodes.includes(omission.iataCode))).toBe(true)
  })

  it.each([
    ['WS 123','WestJet','https://www.westjet.com/en-ca/manage/check-in'],
    ['AC800','Air Canada','https://www.aircanada.com/home/ca/en/aco/checkin'],
    ['LH-470','Lufthansa','https://www.lufthansa.com/ca/en/online-check-in'],
    ['DL 183','Delta Air Lines','https://www.delta.com/PCCOciWeb/findBy.action'],
    ['FI602','Icelandair','https://www.icelandair.com/support/pre-flight/check-in/'],
    ['FR 145','Ryanair','https://www.ryanair.com/gb/en/lp/check-in'],
    ['BA93','British Airways','https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb'],
    ['PD 2240','Porter Airlines','https://www.flyporter.com/en-ca/manage-flights/check-in'],
  ])('matches %s to %s', (flightNumber,name,url) => {
    expect(airlineCheckInForItem(flight(flightNumber))).toMatchObject({name,checkInUrl:url})
  })

  it('prefers the flight-number code over a conflicting provider name', () => {
    expect(airlineCheckInForItem(flight('WS123','Air Canada'))?.name).toBe('WestJet')
  })

  it('falls back to normalized provider names for legacy flights without a number', () => {
    expect(airlineCheckInForItem(flight(undefined,'Air Canada'))?.iataCodes).toContain('AC')
    expect(airlineCheckInForItem(flight(undefined,'Luftansa Airlines'))?.iataCodes).toContain('LH')
  })

  it('does not map unknown codes, providers, or non-flight items', () => {
    expect(airlineCheckInForItem(flight('ZZ123','Unknown Air'))).toBeUndefined()
    expect(airlineCheckInForItem({...flight('AC800'),type:'event'})).toBeUndefined()
  })

  it.each([
    ['WS123','WS'],
    [' ac 800 ','AC'],
    ['LH-470','LH'],
    ['7C 101','7C'],
    ['6E203','6E'],
  ])('extracts the IATA prefix from %s', (value,code) => {
    expect(airlineCodeFromFlightNumber(value)).toBe(code)
  })
})
