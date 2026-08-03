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

  it('starts with one broad travel-and-event evidence search', () => {
    expect(prompt).toContain('INITIAL FULL-WINDOW DISCOVERY')
    expect(prompt).toContain('one received-mail seed search across the full permitted mailbox date range')
    expect(prompt).toContain('single grouped search for: confirmation, reservation, booking, reference, itinerary, trip, journey')
    expect(prompt).toContain('ticket (including e-ticket, eTicket, and e ticket variants)')
    expect(prompt).toContain('voucher, admission, pass, experience, tour, attraction, receipt, or invoice')
    expect(prompt).toContain('one conceptual search spanning travel and scheduled events')
    expect(prompt).toContain('Do not require a destination, provider, traveller, or known venue')
    expect(prompt).toContain('do not turn each term into a separate mandatory full-window search')
  })

  it('screens metadata without requiring every in-window email body to be opened', () => {
    expect(prompt).toContain('If the connector naturally exposes all in-window message summaries')
    expect(prompt).toContain('Do not require enumeration of the entire mailbox window')
    expect(prompt).toContain('do not open every message body')
    expect(prompt).toContain('Screen the returned sender, subject, snippet, date, and attachment metadata')
    expect(prompt).toContain('A generic subject or unfamiliar provider is not enough to reject a candidate')
  })

  it('searches outward from forwarder and provider hits inside the authorized range', () => {
    expect(prompt).toContain('SEARCH OUTWARD FROM EACH HIT')
    expect(prompt).toContain('inclusive 11-day neighborhood centered on that evidence email\'s received date')
    expect(prompt).toContain('five calendar days before through five calendar days after')
    expect(prompt).toContain('clipped to the permitted mailbox range')
    expect(prompt).toContain('Apply no destination, provider, travel-keyword, or other content constraint')
    expect(prompt).toContain('full permitted mailbox date range for that forwarding sender')
    expect(prompt).toContain('provider name, sending address, and recognizable sending domain')
  })

  it('reconciles booking lifecycles without collapsing sibling reservations', () => {
    expect(prompt).toContain('confirmation, payment, dispatch, receipt, completion, change, cancellation, void, refund, reissue, or replacement')
    expect(prompt).toContain('same provider, venue, thread, booking date, or nearby service dates are not duplicates')
    expect(prompt).toContain('Distinct references, products, routes, service dates or times, or quantities imply separate candidate reservations')
    expect(prompt).toContain('Messages sharing the same reference normally represent lifecycle updates')
    expect(prompt).toContain('each independently useful plane, train, rail, bus, coach, or other transport leg')
  })

  it('uses route continuity as a search hypothesis rather than booking evidence', () => {
    expect(prompt).toContain('A flight creates hypotheses for transport to its departure airport and from its arrival airport')
    expect(prompt).toContain('An airport arrival or departure creates hypotheses for a car rental, train or rail journey, coach or bus, shuttle or transfer, taxi or rideshare, and lodging')
    expect(prompt).toContain('Arrival in another country or region creates the same onward-transport hypotheses')
    expect(prompt).toContain('If the itinerary begins or ends with a flight or train')
    expect(prompt).toContain('These hypotheses are reasons to search, not evidence that a reservation exists')
    expect(prompt).toContain('only from supporting received-message or attachment evidence')
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
    expect(prompt).toContain('one additional received-mail search across the full permitted mailbox date range for booking-related attachments')
    expect(prompt).toContain('PDFs, calendar/ICS files, e-tickets')
    expect(prompt).toContain('even when the message subject or body is generic')
    expect(prompt).toContain('only reservation identity, complete schedule')
    expect(prompt).toContain('Use document extraction or OCR')
    expect(prompt).toContain('Do not execute scripts, macros, active content')
    expect(prompt).toContain('ask me for it rather than guessing')
  })

  it('avoids the audit-heavy completion workflow that previously reduced recall', () => {
    expect(prompt).toContain("Use a connector's readily available continuation mechanism when practical")
    expect(prompt).toContain('Do not make exhaustive pagination, date subdivision, a candidate ledger, or a separate discovery-audit file a prerequisite')
    expect(prompt).not.toContain('MANDATORY DISCOVERY LANES')
    expect(prompt).not.toContain('COMPLETION GATE')
    expect(prompt).not.toContain('discoveryQueries')
    expect(prompt).not.toContain('OUTPUT FILES')
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
