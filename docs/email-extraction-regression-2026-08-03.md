# Ireland email-extraction regression — 2026-08-03

## Result

The revised discovery instructions pass the Ireland omission regression at the candidate-discovery and evidence-extraction stages.

- Original extraction: 21 of 22 confirmed itinerary items (95.5% recall).
- Regressed v2 extraction: 17 of 22 confirmed itinerary items (77.3% recall).
- Revised-prompt regression run: 22 of 22 confirmed itinerary items discovered (100% candidate recall).

The 22-item benchmark is the union of the two prior outputs after verifying every disagreement against authoritative received-mail evidence. Its category totals are 2 car endpoints, 6 events, 2 flights, 1 insurance policy, 9 stays, and 2 ground-transport items.

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

Disagreement-set recall was 5/6 for the original extraction, 1/6 for v2, and 6/6 for the revised discovery run.

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

This is an evidence-backed regression run in the same task, not a model-blind A/B trial. The strongest future check is to run the generated prompt in a fresh task with no access to either baseline JSON, then apply the same 22-item benchmark. The current result proves that the revised generic discovery lanes retrieve and expose authoritative evidence for every known Ireland item that differentiated the two prior extractions; it does not prove that every model or connector will obey the prompt perfectly on every run.
