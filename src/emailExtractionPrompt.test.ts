import { describe, expect, it } from 'vitest'
import { buildEmailExtractionPrompt } from './emailExtractionPrompt'

const prompt = buildEmailExtractionPrompt({
  tripName: 'Ireland reunion',
  destination: 'Toronto → Ireland → Toronto',
  travelStart: '2026-07-18',
  travelEnd: '2026-08-01',
  emailStart: '2025-09-01',
  emailEnd: '2026-08-02',
  people: 'Nick, Karen, Craig',
  clues: 'Dublin, DUB, AHPSU8',
})

describe('email extraction prompt', () => {
  it('includes the trip and explicit mailbox boundaries', () => {
    expect(prompt).toContain('Ireland reunion')
    expect(prompt).toContain('2026-07-18')
    expect(prompt).toContain('2026-08-01')
    expect(prompt).toContain('2025-09-01')
    expect(prompt).toContain('Do not search, open, or process messages outside that range')
    expect(prompt).toContain('Never silently search all of my mail')
  })

  it('requires cross-message reconciliation, attribution, and useful safe links', () => {
    expect(prompt).toContain('forwarded chain')
    expect(prompt).toContain('Produce one item per real reservation')
    expect(prompt).toContain('bookedBy')
    expect(prompt).toContain('A traveller, recipient, or person who forwarded')
    expect(prompt).toContain('Accept only absolute https:// URLs')
  })

  it('treats readable attachments as untrusted itinerary evidence', () => {
    expect(prompt).toContain('PDFs, calendar/ICS files, e-tickets')
    expect(prompt).toContain('Use document extraction or OCR')
    expect(prompt).toContain('Do not execute scripts, macros, active content')
    expect(prompt).toContain('ask me for it rather than guessing')
  })

  it('asks for importable Waypoint JSON without prose', () => {
    expect(prompt).toContain('waypoint-trip.json')
    expect(prompt).toContain('"schemaVersion": 1')
    expect(prompt).toContain('Do not use Markdown fences')
    expect(prompt).toContain('start\": \"YYYY-MM-DDTHH:mm')
  })

  it('is reusable without leaking assumptions from another trip', () => {
    const otherTrip=buildEmailExtractionPrompt({tripName:'Japan winter visit',destination:'Tokyo and Sapporo',travelStart:'2027-01-10',travelEnd:'2027-01-24',emailStart:'2026-05-01',emailEnd:'2027-01-25',people:'Avery, Morgan',clues:'ski lesson, HND, CTS'})
    expect(otherTrip).toContain('Japan winter visit')
    expect(otherTrip).toContain('ski lesson, HND, CTS')
    expect(otherTrip).toContain('Avery, Morgan')
    expect(otherTrip).not.toContain('Ireland reunion')
    expect(otherTrip).not.toContain('AHPSU8')
    expect(otherTrip).toContain('Do not reuse assumptions, dates, people, providers')
  })
})
