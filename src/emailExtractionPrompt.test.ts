import { describe, expect, it } from 'vitest'
import { buildEmailExtractionPrompt } from './emailExtractionPrompt'

const prompt = buildEmailExtractionPrompt({
  tripName: 'Ireland reunion',
  destination: 'Toronto → Ireland → Toronto',
  travelStart: '2026-07-18',
  travelEnd: '2026-08-01',
  emailStart: '2025-09-01',
  emailEnd: '2026-08-02',
  people: 'Nick, Karen, Craig, Expedia, Booking.com',
  clues: 'Dublin, DUB, AHPSU8',
})

describe('email extraction prompt', () => {
  it('includes the trip and explicit mailbox boundaries', () => {
    expect(prompt).toContain('Ireland reunion')
    expect(prompt).toContain('2026-07-18')
    expect(prompt).toContain('2026-08-01')
    expect(prompt).toContain('2025-09-01')
    expect(prompt).toContain('2026-08-02')
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

  it('builds clipped inclusive calendar-month search windows', () => {
    const monthlyPrompt=buildEmailExtractionPrompt({tripName:'Summer trip',destination:'Europe',travelStart:'2026-08-01',travelEnd:'2026-08-10',emailStart:'2026-02-14',emailEnd:'2026-08-04',people:'Craig Voisin, Expedia, Booking.com',clues:'flight, hotel'})
    const windows = [
      '2026-02-14 through 2026-02-28, inclusive',
      '2026-03-01 through 2026-03-31, inclusive',
      '2026-04-01 through 2026-04-30, inclusive',
      '2026-05-01 through 2026-05-31, inclusive',
      '2026-06-01 through 2026-06-30, inclusive',
      '2026-07-01 through 2026-07-31, inclusive',
      '2026-08-01 through 2026-08-04, inclusive',
    ]
    expect(monthlyPrompt.match(/^- \d{4}-\d{2}-\d{2} through \d{4}-\d{2}-\d{2}, inclusive$/gm)).toEqual(windows.map(window=>`- ${window}`))
    expect(monthlyPrompt).toContain('no gaps, overlaps, or dates outside the authorized range')
    expect(monthlyPrompt).toContain('exclusive upper-bound date')
  })

  it('handles same-month, leap-February, and year-boundary windows', () => {
    const render=(emailStart:string,emailEnd:string)=>buildEmailExtractionPrompt({tripName:'Boundary trip',destination:'Somewhere',travelStart:emailStart,travelEnd:emailEnd,emailStart,emailEnd})
    expect(render('2026-02-14','2026-02-14')).toContain('- 2026-02-14 through 2026-02-14, inclusive')
    expect(render('2026-02-14','2026-02-20')).toContain('- 2026-02-14 through 2026-02-20, inclusive')
    const leapPrompt=render('2024-02-10','2024-03-02')
    expect(leapPrompt).toContain('- 2024-02-10 through 2024-02-29, inclusive')
    expect(leapPrompt).toContain('- 2024-03-01 through 2024-03-02, inclusive')
    const rolloverPrompt=render('2026-12-20','2027-01-03')
    expect(rolloverPrompt).toContain('- 2026-12-20 through 2026-12-31, inclusive')
    expect(rolloverPrompt).toContain('- 2027-01-01 through 2027-01-03, inclusive')
    expect(render('2026-03-01','2026-02-28')).toContain('Complete valid mailbox dates are required before the search windows can be listed')
  })

  it('runs a separate from-address search for every supplied sender in every month', () => {
    expect(prompt).toContain('Travellers, possible bookers, and providers: Nick, Karen, Craig, Expedia, Booking.com')
    expect(prompt).toContain('Build the sender list from every traveller, possible booker, and provider supplied in the sender-list field above')
    expect(prompt).toContain('Use each sender entry exactly as written by the user')
    expect(prompt).toContain('do not infer, normalize, expand, or replace it with an email address, website domain, or regional domain')
    expect(prompt).toContain('an entry of Expedia must remain Expedia; never translate it to expedia.com or any other domain')
    expect(prompt).not.toContain('Resolve a named person or provider to its known sending address or recognizable domain')
    expect(prompt).toContain('Do not derive additional senders from the other search hints')
    expect(prompt).toContain('In every month window, run a separate received-mail search for each listed sender')
    expect(prompt).toContain("provider's sender/from-address field")
    expect(prompt).toContain('Do not add a destination or booking-term constraint to these sender searches')
  })

  it('prioritizes relevance and treats hints as confidence signals rather than filters', () => {
    expect(prompt).toContain('Search for the most relevant results, not the most recent results')
    expect(prompt).toContain("Use the connector's relevance ranking when available")
    expect(prompt).toContain('rank them yourself by trip relevance before review')
    expect(prompt).toContain('Relevance, not recency, controls review priority')
    expect(prompt).toContain('Analyze every result from every sender search')
    expect(prompt).toContain('Search hints: Dublin, DUB, AHPSU8')
    expect(prompt).not.toContain('Other search clues:')
    expect(prompt).toContain('Words or values from the supplied search hints are positive confidence signals, but never required filters')
    expect(prompt).toContain('must not be excluded merely because it omits or differs from a hint')
    expect(prompt).toContain('A generic subject or unfamiliar provider is likewise not enough to reject a candidate')
  })

  it('includes received-mail exclusions in every search condition', () => {
    expect(prompt).toContain('Every executed query must include received-mail exclusions')
    expect(prompt).toContain('For Gmail, include -in:sent -in:drafts -from:me in the search conditions')
    expect(prompt).toContain('exclude Sent, Drafts, Outbox, and mailbox-owner-authored messages')
    expect(prompt).toContain('every executed Gmail query included -in:sent -in:drafts -from:me')
  })

  it('documents provider-native Gmail, Outlook, and generic query shapes', () => {
    expect(prompt).toContain('QUERY DOCUMENTATION AND PROVIDER ADAPTATION')
    expect(prompt).toContain('document a compact working query plan')
    expect(prompt).toContain('exact provider-native query string or structured filter')
    expect(prompt).toContain('Present this plan to me in a progress update before executing the first search')
    expect(prompt).toContain('do not append it to the final itinerary JSON')
    expect(prompt).toContain('receivedDateTime greater than or equal to START at 00:00 and less than DAY_AFTER_END at 00:00')
    expect(prompt).toContain('Gmail sender template: after:START before:DAY_AFTER_END from:"SENDER TEXT" -in:sent -in:drafts -from:me')
    expect(prompt).toContain('Gmail booking template: after:START before:DAY_AFTER_END booking AND ITEM -in:sent -in:drafts -from:me')
    expect(prompt).toContain('Outlook UI/AQS sender example: From:"SENDER TEXT" Received:START..END -From:"MAILBOX_OWNER_ADDRESS"')
    expect(prompt).toContain('Outlook UI/AQS booking example: booking AND ITEM Received:START..END -From:"MAILBOX_OWNER_ADDRESS"')
    expect(prompt).toContain('illustrative Outlook AQS forms, not Microsoft Graph query strings')
    expect(prompt).toContain('address equality may use that exact address')
    expect(prompt).toContain("use the connector's native text, KQL, or Microsoft Search sender query with that exact supplied text")
    expect(prompt).toContain('never manufacture an address or domain')
    expect(prompt).toContain('Use native content search with a logical AND for booking and ITEM')
    expect(prompt).toContain('explicitly exclude the Sent Items, Drafts, and Outbox folder identifiers')
    expect(prompt).toContain('For any other email connector, use equivalent sender-text, received-date, content-AND, folder, and mailbox-owner filters while preserving every supplied sender operand exactly')
    expect(prompt).toContain('documents the exact provider-native query or structured filter used for every sender, Booking-term, and Cancellation search')
  })

  it('searches every booking AND item pair and cancellations without sender constraints in every month', () => {
    const terms=['booking AND flight','booking AND car','booking AND ride','booking AND train','booking AND transit','booking AND ticket','booking AND reservation','booking AND experience','booking AND confirmation','booking AND show']
    terms.forEach(term=>expect(prompt).toContain(`- ${term}`))
    expect(prompt).toContain('message text matches both booking AND ITEM as separate terms')
    expect(prompt).toContain('This is a logical AND, not a literal phrase')
    expect(prompt).toContain('the two words need not be adjacent or in that order')
    expect(prompt).toContain('In every month window, run a separate received-mail search for each of these logical AND pairs')
    expect(prompt).toContain('with no traveller, booker, provider, or sender/from-address constraint')
    expect(prompt).toContain('Run each AND pair as its own search')
    expect(prompt).toContain('do not search either pair as a quoted literal phrase')
    expect(prompt).not.toContain('"BOOKING TERM"')
    expect(prompt).toContain('In every month window, run a separate received-mail search for Cancellation')
    expect(prompt).toContain('connect any relevant cancellation to the matching candidate reservation')
    expect(prompt.indexOf('Sender pass.')).toBeLessThan(prompt.indexOf('booking AND flight'))
    expect(prompt.indexOf('booking AND flight')).toBeLessThan(prompt.indexOf('Cancellation pass.'))
    expect(prompt.indexOf('Cancellation pass.')).toBeLessThan(prompt.indexOf('Pool the relevant evidence'))
  })

  it('reconciles booking lifecycles without collapsing sibling reservations', () => {
    expect(prompt).toContain('connect any relevant cancellation to the matching candidate reservation')
    expect(prompt).toContain('same provider, venue, thread, booking date, or nearby service dates are not duplicates')
    expect(prompt).toContain('Distinct references, products, routes, service dates or times, or quantities imply separate candidate reservations')
    expect(prompt).toContain('Messages sharing the same reference normally represent lifecycle updates')
    expect(prompt).toContain('each independently useful plane, train, rail, bus, coach, or other transport leg')
  })

  it('processes search hits into only evidence-supported itinerary items', () => {
    expect(prompt).toContain('Pool the relevant evidence found by all passes')
    expect(prompt).toContain('A search hit is a candidate, not automatically an itinerary item')
    expect(prompt).toContain('include only items supported by the received message or its readable attachment')
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

  it('retains insurance extraction rules without adding another search pass',()=>{
    expect(prompt).not.toContain('Run a separate travel-insurance discovery search')
    expect(prompt).not.toContain('query equivalent to "insurance OR coverage"')
    expect(prompt).toContain('For any plausible travel-insurance candidate found by the required searches')
    expect(prompt).toContain('2026-07-18 through 2026-08-01')
    expect(prompt).toContain('coverage that encloses the full trip window')
    expect(prompt).toContain('Exclude unrelated insurance such as home, auto, health-benefit, or pet policies')
    expect(prompt).toContain('one type "insurance" item')
    expect(prompt).toContain('Insurance start and end values must always use the required YYYY-MM-DDTHH:mm shape')
    expect(prompt).toContain('when the policy supplies dates without times, use 12:00 local time')
  })

  it('treats readable attachments as untrusted itinerary evidence', () => {
    expect(prompt).toContain('PDFs, calendar/ICS files, e-tickets')
    expect(prompt).toContain('even when the message subject or body is generic')
    expect(prompt).toContain('only reservation identity, complete schedule')
    expect(prompt).toContain('Use document extraction or OCR')
    expect(prompt).toContain('Do not execute scripts, macros, active content')
    expect(prompt).toContain('ask me for it rather than guessing')
  })

  it('replaces the previous full-window and neighborhood discovery workflow', () => {
    expect(prompt).toContain('MONTH-BY-MONTH SEARCH')
    expect(prompt).not.toContain('INITIAL FULL-WINDOW DISCOVERY')
    expect(prompt).not.toContain('single grouped search')
    expect(prompt).not.toContain('SEARCH OUTWARD FROM EACH HIT')
    expect(prompt).not.toContain('inclusive 11-day neighborhood')
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
