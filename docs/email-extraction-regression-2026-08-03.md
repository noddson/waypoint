# Ireland email-extraction regression — 2026-08-03

## Result

The extra-high-reasoning diagnostic run retrieved all known Ireland candidates, but a subsequent medium-reasoning end-to-end extraction did not preserve that recall. The prompt therefore did not yet pass at the reasoning level used by the real extraction system.

- Original extraction: 21 of 22 confirmed itinerary items (95.5% recall).
- Regressed v2 extraction: 17 of 22 confirmed itinerary items (77.3% recall).
- Extra-high-reasoning revised-prompt diagnostic: 22 of 22 confirmed itinerary items discovered (100% candidate recall).
- Medium-reasoning end-to-end extraction: 19 of 22 confirmed active itinerary items emitted (86.4% recall).

The 22-item benchmark is the union of the two prior outputs after verifying every disagreement against authoritative received-mail evidence. Its category totals are 2 car endpoints, 6 events, 2 flights, 1 insurance policy, 9 stays, and 2 ground-transport items.

## Medium-reasoning follow-up failure

`Dublin-July-2026.json`, exported at 2026-08-03T14:11:04Z, omitted three confirmed active items:

- United Taxi airport drop-off, booking `11137`, fare confirmation `9723`;
- United Taxi airport pickup, booking `11138`, fare confirmation `9726`; and
- Bunratty medieval banquet, reference `B03738074`.

It also contained no observable record for Wright Limousine references `84271` and `84272`. Those two journeys were correctly ineligible for the active itinerary because authoritative cancellation messages exist, but the itinerary JSON alone cannot show whether the extraction found and reconciled them or never searched for them.

Read-only mailbox diagnostics show that a generic `taxi` query returns both United bookings and a generic `limousine` query returns both Wright cancellation chains together with their earlier pending and confirmed messages. The evidence was therefore searchable without using a known provider or reference as the query. The failure was prompt execution and observability at medium reasoning, not absent mailbox evidence.

The prompt now adds, without removing the existing lanes:

- an explicit checklist of independent ground-transport concepts;
- itinerary-derived hypotheses for flight boundaries, foreign or regional arrivals, rental endpoints, and gaps between distinct route stops;
- focused anchor searches over the full mailbox window, plus buffered service-date variants of at least three days on either side;
- mandatory reconciliation of pending, paid, confirmed, completed, changed, refunded, and cancelled states per provider/reference;
- route-continuity checks for both home/airport edges and booked intermediate transfers;
- a separate discovery-audit JSON that exposes completed transport queries and candidate dispositions; and
- fail-closed behavior instead of emitting an apparently complete itinerary when any lane is unfinished.

These hypotheses increase discovery coverage without lowering the evidence threshold. A flight or multi-city route is a reason to search for a likely taxi, rideshare, transfer, rental car, train, or coach; it is never sufficient evidence to create that item. Generic transport searches still run independently, so hypothesis-driven searches cannot displace the broad safety net.

## Fixed scope

- Mailbox dates: January 1 through August 3, 2026, inclusive.
- Travel dates: July 18 through August 1, 2026.
- Received mail only; Sent, Drafts, Spam, and Trash excluded.
- The regression queries used generic terms and the supplied Ireland trip clues. They did not use a missing provider name or confirmation number as a search input.

## Disagreement-set test

This is the discriminating part of the comparison: the five items v2 lost and the one valid item v2 added.

| Confirmed item | Original | v2 | Revised discovery evidence |
| --- | ---: | ---: | --- |
| Allianz Deluxe Package travel insurance, policy `ACA0000117236` | Yes | **No** | Found by the independent `travel insurance` and `emergency medical` lanes. The April 11 confirmation and its PDF state coverage July 18–August 1, 2026. |
| Titanic Experience Anytime Ticket, booking `9DEC5WYN` | Yes | **No** | Found by generic `Ireland booking` and booking-attachment searches; direct provider ticket dated June 21. |
| Bunratty Castle & Folk Park combination ticket, reference `B03738073` | Yes | **No** | Found by generic `confirmation` and `ticket` searches in the June 20–23 date slice; direct provider confirmation states six visitors on July 28. |
| Bunratty medieval banquet, reference `B03738074` | Yes | **No** | Found independently by `banquet`, then again by the June `confirmation`/`ticket` slice; direct provider confirmation states six visitors at 17:30 on July 27. |
| Rock of Cashel visit, reference `577086` | Yes | **No** | Found on the first corrected-scope `ticket` result page; direct provider confirmation states the July 31 visit and six tickets. |
| Brú na Bóinne Tour + Newgrange Chamber, reference `315575` | **No** | Yes | Preserved by the revised `confirmation`, `ticket`, `tour`, and forwarded-confirmation lanes; evidence states July 22 at 10:30 for six adults. |

Disagreement-set recall was 5/6 for the original extraction, 1/6 for v2, and 6/6 for the extra-high-reasoning revised discovery diagnostic. The later medium-reasoning run demonstrates why candidate retrieval must also be proven by an observable audit and final-item reconciliation.

## Why the revision changes the outcome

The regressed prompt concentrated attention on broad query families and forwarding bursts, then delayed extraction until an unobservable completion gate. The lost items were all direct provider bookings for the mailbox owner, while the newly found Brú na Bóinne item was a forwarded booking.

The revised prompt now requires independently checkable lanes for:

1. direct provider confirmations and receipts;
2. tickets, admissions, attractions, tours, experiences, banquets, and other events;
3. supplied and newly discovered anchors;
4. forwarded confirmations and same-day forwarding bursts;
5. booking attachments; and
6. travel insurance using separate searches rather than one combined OR query.

It also requires smaller non-overlapping date slices when a connector caps or truncates results. That fallback was exercised in the clustered June 20–23 booking window and surfaced both separate Bunratty reservations while retaining Titanic, Brú na Bóinne, and Cliffs of Moher.

## Evidence limitations

The initial evidence-backed diagnostic ran at extra-high reasoning in the same task, not as a model-blind medium-reasoning A/B trial. It proved that generic lanes could retrieve the authoritative evidence, but it did not prove that the real medium-reasoning system would execute them completely. The medium follow-up failed that stronger test. Future extraction results should not be accepted as complete unless the separate discovery audit shows every lane and transport query complete, every plausible trip candidate has a disposition, and all included dispositions reconcile with final item IDs. High reasoning remains recommended for broad mailbox ranges.
