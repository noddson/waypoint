import { describe, expect, it } from 'vitest'
import { buildEmailExtractionPrompt } from './emailExtractionPrompt'

const prompt = buildEmailExtractionPrompt({
  tripName: 'Ireland reunion',
  destination: 'Toronto → Ireland → Toronto',
  travelStart: '2026-07-18',
  travelEnd: '2026-08-01',
  emailStart: '2026-01-01',
  emailEnd: '2026-08-03',
  people: 'Nick, Karen, Craig',
  clues: 'Dublin, DUB, AHPSU8',
})

describe('email extraction prompt', () => {
  it('includes the trip and explicit mailbox boundaries', () => {
    expect(prompt).toContain('Ireland reunion')
    expect(prompt).toContain('2026-07-18')
    expect(prompt).toContain('2026-08-01')
    expect(prompt).toContain('2026-01-01')
    expect(prompt).toContain('2026-08-03')
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

  it('uses independent discovery lanes for direct, forwarded, and anchored bookings',()=>{
    expect(prompt).toContain('Finding several convincing reservations is not evidence that discovery is complete')
    expect(prompt).toContain('MANDATORY DISCOVERY LANES')
    expect(prompt).toContain('several small, independent searches rather than one giant combined query')
    expect(prompt).toContain('Direct-provider confirmations and receipts')
    expect(prompt).toContain('Do not let forwarded-message searches replace this lane')
    expect(prompt).toContain('Search each supplied provider, confirmation/ticket/order/policy reference')
    expect(prompt).toContain('Expand every relevant received forward as a possible forwarding burst')
    expect(prompt).toContain('same outer forwarding sender on that same mailbox calendar day')
    expect(prompt).toContain('Do not stop after finding one sibling confirmation')
    expect(prompt).toContain('CANDIDATE CONTROL AND COMPLETION CHECK')
    expect(prompt).toContain('Maintain a private candidate inventory')
    expect(prompt).toContain('EXTRACT WHILE DISCOVERING, THEN RECONCILE')
    expect(prompt).toContain('every relevant forward triggered a same-forwarder, same-calendar-day forwarding-burst search')
    expect(prompt).not.toContain('Read only messages plausibly related to this trip')
  })

  it('guards against capped search results and the direct-event regression',()=>{
    expect(prompt).toContain('tickets, admissions, attractions, tours, experiences, and dining events are itinerary items')
    expect(prompt).toContain('ticket, e-ticket, voucher, admission, tour, experience, attraction, visit, order, receipt, and banquet')
    expect(prompt).toContain('event/admission')
    expect(prompt).toContain('If the connector caps results, omits pagination, or reports a truncated set')
    expect(prompt).toContain('smaller non-overlapping mailbox-date slices')
    expect(prompt).toContain('Never treat the first page or a capped result set as complete')
    expect(prompt).toContain('each confirmed reservation, ticket, order, admission, tour, experience, dining event')
    expect(prompt).toContain('the number of include dispositions reconciles with the final items')
  })

  it('preserves distinct sibling reservations from the same provider',()=>{
    expect(prompt).toContain('Same-provider candidates are not duplicates')
    expect(prompt).toContain('Treat each distinct confirmation, reservation, ticket, order, or policy reference as a separate candidate identity')
    expect(prompt).toContain('Open and reconcile every sibling candidate before deduplicating any of them')
    expect(prompt).toContain('the number of distinct references or evidence-based candidate identities reconciles')
    expect(prompt).toContain('never merge distinct sibling reservations from the same provider')
    expect(prompt).toContain('a timed banquet and a next-day admission ticket from the same attraction are two events')
  })

  it('requires deterministic ground-transport discovery and continuity checks',()=>{
    expect(prompt).toContain('Ground transport and trip continuity')
    expect(prompt).toContain('Run every one of these received-mail search concepts independently')
    expect(prompt).toContain('taxi; cab; limousine; limo; chauffeur')
    expect(prompt).toContain('ride booking; rideshare; Uber; Lyft; Bolt; FREE NOW')
    expect(prompt).toContain('airport pickup; airport drop-off; airport transfer; shuttle; transfer')
    expect(prompt).toContain('train; rail; bus; coach; ferry; transit')
    expect(prompt).toContain('car rental; rental car; car hire; vehicle hire; rental agreement')
    expect(prompt).toContain('Do not exclude a result merely because it is pending, cancelled, from a superseded provider')
    expect(prompt).toContain('GROUND-TRANSPORT RECONCILIATION — REQUIRED')
    expect(prompt).toContain('Include each confirmed, paid, or completed journey as one type "transport" item')
    expect(prompt).toContain('This explicitly includes train and rail tickets or reservations, and bus or coach tickets or reservations')
    expect(prompt).toContain('create one transport item per leg')
    expect(prompt).toContain('do not collapse distinct departures, arrivals, service numbers, or connections')
    expect(prompt).toContain('Do not output a cancelled journey as an itinerary item')
    expect(prompt).toContain("A cancelled reservation from one provider does not cancel or supersede another provider's booking")
    expect(prompt).toContain('trip origin to the departure airport/station')
    expect(prompt).toContain('arrival airport/station back to the trip origin')
    expect(prompt).toContain('no email evidence found after completed transport searches')
  })

  it('uses itinerary implications to expand discovery without inventing bookings',()=>{
    expect(prompt).toContain('derive additional transport hypotheses for every unaccounted connection')
    expect(prompt).toContain('Arrival in another country or region creates car-rental, train, coach/bus, shuttle/transfer, taxi, and rideshare hypotheses')
    expect(prompt).toContain('Sequential stays or activities in different localities create an intercity-transport hypothesis')
    expect(prompt).toContain('across the full authorized mailbox window')
    expect(prompt).toContain('a buffer of at least three calendar days before and after')
    expect(prompt).toContain('must never restrict message received dates to the travel week')
    expect(prompt).toContain('supplement, and never replace, the independent generic concept searches')
    expect(prompt).toContain('Treat itinerary structure as evidence for what to search, never as evidence that a reservation exists')
    expect(prompt).toContain('Do not turn a hypothesis, geographic likelihood, or missing connection into an invented item')
    expect(prompt).toContain('"transportHypotheses"')
    expect(prompt).toContain('including hypotheses that found no evidence')
  })

  it('fails closed and emits an observable discovery audit',()=>{
    expect(prompt).toContain('fail closed: do not produce an itinerary JSON that appears complete')
    expect(prompt).toContain('Ireland-July-2026-discovery-audit.json')
    expect(prompt).toContain('This audit is proof of search coverage and reconciliation')
    expect(prompt).toContain('"groundTransport": "complete"')
    expect(prompt).toContain('"transportQueries"')
    expect(prompt).toContain('"transportHypotheses"')
    expect(prompt).toContain('"tripCandidates"')
    expect(prompt).toContain('"disposition": "included | duplicate | superseded | cancelled"')
    expect(prompt).toContain('Every plausible trip candidate, including cancellations and superseded bookings')
    expect(prompt).toContain('Every laneStatus value must be "complete" before creating the itinerary JSON')
    expect(prompt).toContain('unrelated search results appear only as counts')
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
    expect(prompt).toContain('Run separate received-mail searches for insurance, travel insurance, policy, certificate of insurance, coverage, protection plan, and emergency medical coverage')
    expect(prompt).toContain('Do not rely on one combined OR query')
    expect(prompt).toContain('Do not require an insurance message to mention the destination')
    expect(prompt).toContain('Compare every plausible travel-insurance candidate\'s coverage dates')
    expect(prompt).toContain('2026-07-18 through 2026-08-01')
    expect(prompt).toContain('coverage that encloses the full trip window')
    expect(prompt).toContain('Exclude unrelated insurance such as home, auto, health-benefit, or pet policies')
    expect(prompt).toContain('one type "insurance" item')
    expect(prompt).toContain('Insurance start and end values must always use the required YYYY-MM-DDTHH:mm shape')
    expect(prompt).toContain('when the policy supplies dates without times, use 12:00 local time')
    expect(prompt).toContain('the independent travel-insurance searches were completed')
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
    expect(prompt).toContain('without Markdown fences')
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
