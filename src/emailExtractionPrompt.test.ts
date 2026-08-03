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
    expect(prompt).toContain('assume the person who sent that forward is the booker')
    expect(prompt).toContain('Accept only absolute https:// URLs')
  })

  it('uses received mail as evidence and excludes mailbox-owner sent copies',()=>{
    expect(prompt).toContain('Search received mail only')
    expect(prompt).toContain('Explicitly exclude Sent, Drafts, Outbox')
    expect(prompt).toContain('Never use a sent-mail copy as evidence')
    expect(prompt).toContain('assume the person who sent that forward is the booker unless')
    expect(prompt).toContain('assume the person who directly received it is the booker unless')
    expect(prompt).toContain('Do not attribute a received forward to the authorized mailbox owner')
  })

  it('separates rental endpoints and preserves distinct route stops',()=>{
    expect(prompt).toContain('one pickup item')
    expect(prompt).toContain('one return item')
    expect(prompt).toContain('Do not represent the whole rental as one item with an end time')
    expect(prompt).toContain('actual make and model')
    expect(prompt).toContain('automatic or manual transmission')
    expect(prompt).toContain('fuel type (unleaded, diesel, or EV)')
    expect(prompt).not.toContain('powertrain')
    expect(prompt).toContain('mileage or kilometre allowance (including unlimited mileage)')
    expect(prompt).toContain('registration/license plate')
    expect(prompt).toContain('distance driven and fuel/charge return status')
    expect(prompt).toContain('Never combine separate stops with a slash')
  })

  it('requests a separate deep link to the primary received source email',()=>{
    expect(prompt).toContain('emailLink')
    expect(prompt).toContain('specific received message used as the primary evidence')
    expect(prompt).toContain('Do not put a mailbox search-results URL')
  })

  it('requires a dedicated insurance search matched to the trip coverage window',()=>{
    expect(prompt).toContain('Run a separate travel-insurance discovery search')
    expect(prompt).toContain('query equivalent to "insurance OR coverage"')
    expect(prompt).toContain('Do not require an insurance message to mention the destination')
    expect(prompt).toContain('Compare every plausible travel-insurance candidate\'s coverage dates')
    expect(prompt).toContain('2026-07-18 through 2026-08-01')
    expect(prompt).toContain('coverage that encloses the full trip window')
    expect(prompt).toContain('Exclude unrelated insurance such as home, auto, health-benefit, or pet policies')
    expect(prompt).toContain('one type "insurance" item')
    expect(prompt).toContain('Insurance start and end values must always use the required YYYY-MM-DDTHH:mm shape')
    expect(prompt).toContain('when the policy supplies dates without times, use 12:00 local time')
    expect(prompt).toContain('the dedicated travel-insurance search was completed')
  })

  it('treats readable attachments as untrusted itinerary evidence', () => {
    expect(prompt).toContain('PDFs, calendar/ICS files, e-tickets')
    expect(prompt).toContain('Use document extraction or OCR')
    expect(prompt).toContain('Do not execute scripts, macros, active content')
    expect(prompt).toContain('ask me for it rather than guessing')
  })

  it('asks for importable Waypoint JSON without prose', () => {
    expect(prompt).toContain('Ireland-July-2026.json')
    expect(prompt).toContain("primary destination plus its travel-start month and year")
    expect(prompt).toContain('"schemaVersion": 1')
    expect(prompt).toContain('"type": "flight | stay | car | transport | insurance | event"')
    expect(prompt).not.toContain('event | plan | reference')
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
    expect(otherTrip).toContain('Tokyo-and-Sapporo-January-2027.json')
    expect(otherTrip).toContain('Do not reuse assumptions, dates, people, providers')
  })
})
