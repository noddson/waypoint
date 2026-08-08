# Release History

This history summarizes the repository's product changes, newest first. Timestamps are the recorded Git committer timestamps and retain their original UTC offset.

# August 8, 2026

## Centralize public calendar storage

Kept each authoritative itinerary JSON and its collected journal photos within the trip's Google Drive folder, while moving every published `.ics` feed into a public read-only **Published Calendars** folder directly under **Waypoint travel planner**. Owner synchronization now migrates existing feeds without changing their file IDs or subscription URLs and moves obsolete per-trip published-calendar folders to Drive trash.

# August 7, 2026

## Unify journal entries with itinerary items

**Commit:** `02ac604e83391d80329b7b7743f14238e78c2da0` (`02ac604`)
**Committed:** `2026-08-07 20:47:06 -04:00`

Reworked journals from a separate dated-entry experience into the standard itinerary model. **Journal** is now a first-class Add Item type and filter alongside Flight, Stay, Car rental, Event, Transport, and Insurance. Journal rows appear in the normal daily agenda on the day and immediately after the itinerary item they reference, while the Journal filter uses the same agenda layout and leaves the trip route visible at the top. Turning the opt-in journal setting off hides journal controls and rows without deleting saved entries; turning it back on restores them in place.

Removed the standalone journal view, dedicated journal-entry editor, per-day **+ Note** controls, and journal-count actions. This eliminates the mobile gap between a date and its itinerary rows and keeps mobile weather to one intended presentation instead of duplicating it around journal controls. Journal items remain excluded from route derivation and weather requests, so inherited locations do not create extra route stops, forecast cards, or changes to the trip's weather window.

The normal Add/Edit Item dialog now handles the full journal workflow through the same **Details** and **JSON** tabs used by every other item. Details retain Type and Title, replace booking-specific fields with a large Notes editor and Google Drive photo controls, and allow an optional related itinerary item. Related journals dynamically inherit that item's start, end, time zone, and location; unlinked journals expose start, end, time zone, and location for manual entry. Provider, confirmation, booked-by, end-location, ticket/booking-link, source-email-link, and status controls are omitted from journal Details, while JSON editing can still validate and update journal relationships, timestamps, and photo descriptors.

Existing trip-level journal entries migrate automatically into journal itinerary items without losing text, photos, timestamps, itinerary relationships, or merge-conflict history. The same migration runs for local trips, imports, snapshots, historical Drive versions, exports, and synchronization; concurrent journal edits now use the regular item merge path, with copied photo descriptors receiving fresh local IDs. Multi-item JSON pastes also remap a journal's relationship when its referenced itinerary item receives a new imported ID. Regression coverage verifies migration, relationship inheritance, sorting, route and weather isolation, JSON round trips, photo metadata, Drive conflicts, production builds, and responsive mobile behavior.

## Add opt-in trip journals

**Commit:** `c4f7c27e2af5657c87e35202a4e86183898f79e0` (`c4f7c27`)
**Committed:** `2026-08-07 19:56:56 -04:00`

Added an opt-in **Trip journal** setting, disabled by default, that exposes a consolidated Journal view and per-day **+ Note** shortcuts without deleting stored entries when the setting is turned off. Journal entries are dated trip-level objects rather than scheduled itinerary items, can contain local-first text and several entries per day, and may optionally reference an itinerary item that occurs on the same date. They remain outside trip-date, route, weather, overlap, and calendar calculations; archived trips display their journals read-only. Text works without Google Drive, while photo controls become available after Drive is connected. JSON and snapshot exports retain photo descriptors but never embed photo binaries.

Reorganized new synchronized trips into permission-bearing per-trip Drive folders containing the authoritative itinerary, an on-demand `journal-media` folder, and a limited-access calendar subfolder. Journal images use multipart or resumable uploads as appropriate, are loaded through authenticated Drive requests, and move to recoverable Drive trash when their final journal reference is removed. Public `.ics` feeds disable inherited trip collaboration permissions before receiving their own reader permission; when Drive cannot enforce that boundary, Waypoint uses a separately permissioned **Published calendars** folder. Existing flat Drive trips migrate lazily on their owner's next synchronization, preserving itinerary and calendar file IDs so live links and subscription URLs continue working, while collaborators can keep using unmigrated trips until the owner enables folder-backed photo storage.

Extended import validation and three-way synchronization to journal entries and photo descriptors, retaining concurrent edits as labeled conflict copies while giving duplicated descriptors unique local IDs and protecting shared Drive files until their last reference disappears. Every new setting, control, accessibility label, empty state, progress message, confirmation, and Drive error is translated across English, German, Greek, Spanish, French, Icelandic, Italian, Japanese, and Pirate. Regression coverage now includes the opt-in preference, journal import limits, independent and conflicting merges, legacy Drive migration, folder-level permissions and trash behavior, calendar isolation, journal-photo uploads, full production builds, and responsive desktop and mobile browser workflows.

## Keep Code 128 in the mobile landscape rail

**Commit:** `030ef28ee43f76f66dda3956de1683675ed6b5cb` (`030ef28`)
**Committed:** `2026-08-07 12:55:26 -04:00`

Kept confirmation codes in a consistent left-side location when a mobile landscape user double-clicks or double-taps a QR code to switch it to Code 128. The Code 128 presentation now occupies the first itinerary grid column, matching the QR code's left edge instead of moving into a third column at the far right. Its wider 200-pixel rendering remains intact by widening the left rail and shifting the booking details column, while the time and item-specific weather continue to stack above the active confirmation-code format.

## Prevent expanded mobile footer text inflation

**Commit:** `1bc286e2319f8a1db2cfedb249e059cd0db65e3e` (`1bc286e`)
**Committed:** `2026-08-07 12:42:48 -04:00`

Disabled mobile-browser text-size inflation within the footer so opening the landscape disclosure no longer enlarges its disclaimer independently of the version row. The revealed paragraphs, links, and emphasized text now explicitly retain the shared 8-pixel mobile footer size, including in browsers such as Safari that otherwise enlarge landscape prose blocks.

## Finalize responsive mobile footer behavior

**Commit:** `eb5d07b34dbdd2f25b4855f09116190efe246042` (`eb5d07b`)
**Committed:** `2026-08-07 12:38:16 -04:00`

Standardized the mobile footer at 8 pixels while preserving the existing desktop size. Portrait mode now keeps the complete footer genuinely open and non-toggleable while leaving the commit-linked version usable; landscape starts with only the localized version and chevron, expands the supporting notices on demand, and returns to its compact state when the device rotates into landscape. Orientation and resize tracking keep those behaviors synchronized instead of relying on CSS to expose content from a natively closed disclosure.

## Refine mobile landscape footer and QR placement

**Commit:** `bbe088dc612a036aab29d193cbe7f6fe199f778b` (`bbe088d`)
**Committed:** `2026-08-07 12:28:02 -04:00`

Introduced the compact mobile-landscape footer disclosure with a rotating chevron while retaining the full disclaimer, contribution link, and copyright notice one tap away. QR confirmation codes moved back into the left itinerary rail beneath item weather, allowing booking details to use the remaining width; the wider Code 128 format keeps its dedicated right-side column. Desktop and portrait initially retained their complete footer presentation, and the version link remained independently clickable.

## Scope itinerary weather to visible bookings

**Commit:** `ff4b4a079956eca13eefe037a4da715f8736c564` (`ff4b4a0`)
**Committed:** `2026-08-07 10:27:09 -04:00`

Weather now follows the active itinerary filter and the booking that renders it, so Flight views exclude stay-only places, Stay views exclude flight endpoints, stationary entries show their own region, and flights or regional ground transport can show both origin and destination. Overnight routes retain origin weather on the departure date and destination weather on the arrival date, active overnight movements remain eligible when either endpoint is in range, active stays roll forward to the current day, equivalent country-qualified and unqualified places deduplicate without merging forecasts for different dates, and insurance or unlocated entries do not create fallback weather. Desktop keeps weather in the day column, while mobile portrait places item-scoped weather before an optional QR or Code 128 confirmation code and mobile landscape keeps weather on the left with booking details in the centre and the confirmation code at the far right; unused rails collapse cleanly when weather, confirmation codes, both, or neither are enabled. Print output retains the full itinerary, landscape deep links and expanded code overlays remain usable, and regression plus browser coverage verifies filtered Flight and Stay scopes, overnight flights, endpoint-only transport, same-place deduplication, active stays, optional locations, narrow portrait layouts, landscape layouts, both code formats, and all four display-setting combinations.

## Deduplicate itinerary weather locations

**Commit:** `6296f8500fe0294cdeb66c46e45862b0f29c63f0` (`6296f85`)
**Committed:** `2026-08-07 01:12:23 -04:00`

Stopped airport operational details such as terminals, gates, doors, kiosks, parking, and pickup instructions from becoming weather locations, and made airport-only addresses fall back to their airport city instead of querying a literal place such as “Terminal.” Same-day weather targets now use normalized place identities, merge equivalent addresses when one lacks a country hint, and prefer the country-qualified target, while same-name cities in different known countries remain separate. Regression coverage reproduces the Dublin-to-Toronto return day and confirms its rental return, flight endpoints, and taxi pickup produce exactly Dublin, Toronto, and Waterloo rather than repeated Dublin and Terminal cards.

# August 6, 2026

## Add historical weather for completed trips

**Commit:** `51979ec775143ef636cbc4e2cb25346855ef1ce1` (`51979ec`)
**Committed:** `2026-08-06 23:34:31 -04:00`

Completed itineraries dated January 1, 2022 or later now load day-level conditions on demand from Open-Meteo's Historical Forecast API, using the same itinerary-derived locations, high and low temperatures, weather codes, precipitation probabilities, wind values, temperature preferences, and short-lived in-memory caching as the live weather experience. Trips before archive coverage show no historical weather interface, while active and upcoming trips continue to use the live Forecast API unchanged. Historical attribution, failure states, and revised settings guidance are translated across all nine supported language modes, and the feature does not change trip JSON or Google Drive schemas.

## Localize empty and loading itinerary states

**Commit:** `28d802513f1aee4520b1ae4d7f2dae3bfa781e07` (`28d8025`)
**Committed:** `2026-08-06 23:16:47 -04:00`

Completed the remaining empty and transient localization paths across every supported non-English language. The empty agenda, local trip-library startup, Google Drive trip loading, Drive configuration and connection guidance, and local-copy restoration progress now render through explicit translation helpers, with all-language regression coverage preventing those states from reverting to English during React updates.

## Complete internationalized trip interface

**Commit:** `f8c0d692375d03c6d30b21dad9dc3a757f93f46c` (`f8c0d69`)
**Committed:** `2026-08-06 22:48:11 -04:00`

Moved the compact flag language selector into Trip Actions beside Settings and completed localization throughout the itinerary header, date and day-count summaries, Drive and calendar state, route links, agenda and booking metadata, durations, weather, footer, settings, trip chooser, and Add Item JSON interface. Dynamic notices, mutation progress, confirmation-code controls, icon tooltips, accessible labels, and variable-bearing messages now translate while canonical itinerary JSON fields and recognized map, temperature-scale, and product names remain unchanged.

## Add multilingual Waypoint UI

**Commit:** `23c2e616a9e34fc6009afd189133b65ce4ab671f` (`23c2e61`)
**Committed:** `2026-08-06 21:42:13 -04:00`

Added English, German, Greek, Spanish, French, Icelandic, Italian, Japanese, and Pirate interface support with first-visit browser-language detection, an English fallback, and a locally persisted explicit selection. Interface text, accessibility metadata, and date and time formatting became localizable while itinerary data, external links, integrations, JSON and ICS exports, and the generated email-extraction prompt retained their canonical content.

## Align weather forecasts with itinerary events

**Commit:** `010eaeea12e137b70b678737d5ec63106fb846d6` (`010eaee`)
**Committed:** `2026-08-06 19:16:03 -04:00`

Removed automatically generated weather-only agenda days so forecasts appear only beside real itinerary entries. Active multi-night stays now roll their existing weather widget forward to today's forecast when no separate itinerary row exists for today, while future events continue to use their own scheduled dates. Same-day locations follow itinerary time—such as Toronto departure, Winnipeg arrival, then Keewatin stay—with regression coverage for chronological stacking and active-stay behavior.

## Add itinerary-based daily weather forecasts

**Commit:** `3848abb72c03c8275cab7549ddeff25fcf86e5be` (`3848abb`)
**Committed:** `2026-08-06 18:12:23 -04:00`

Added cached Open-Meteo forecasts for a rolling 14-day trip window, deriving one or more daily locations from stays, flights, events, and transport rather than device geolocation. Forecasts now appear responsively beneath itinerary dates with Off, Celsius, Fahrenheit, and Kelvin preferences, graceful handling of partial data, attribution, and documented limitations.

## Update Pages workflow to Node 24

**Commit:** `55130865798f9cf81f198607fec69f077b955bd3` (`5513086`)
**Committed:** `2026-08-06 16:07:01 -04:00`

Updated the GitHub Pages build from Node.js 22 to Node.js 24 and moved the checkout, setup-node, configure-pages, upload-artifact, and deploy-pages actions to their newer major versions. The deployment documentation was revised to match the new runtime.

## Restore Drive versions as local copies

**Commit:** `16e788a9fa761792c40765e84d8d25ca6f52dd8a` (`16e788a`)
**Committed:** `2026-08-06 16:02:34 -04:00`

Changed historical-version restoration to create a fresh, editable local-only trip instead of a new Google Drive file. The restored copy drops its source Drive state while leaving the original remote file intact and tells users they can explicitly save the copy to Drive later.

## Improve trip chooser dates and ordering

**Commit:** `5acaec6554aaf7d80e1f0f903365296e3a555821` (`5acaec6`)
**Committed:** `2026-08-06 14:30:26 -04:00`

Added compact travel ranges, last-updated timestamps, and an accessible cloud-check marker to trip chooser rows, including narrow-screen layouts. Travel bounds are now cached in Drive metadata and local or remote trips share an ordering that prioritizes active trips, then upcoming, completed, and undated trips.

## Clean up bootstrap Drive revisions

**Commit:** `91db6d7e8e542ea7ae19e4779eae54ff1ebf1525` (`91db6d7`)
**Committed:** `2026-08-06 12:14:30 -04:00`

Added safe cleanup for the incomplete bootstrap revision created before a new Drive file can contain its own ID, deleting it only after the complete second revision is confirmed as current. The cleanup is resumable through app metadata, retries without blocking a usable trip, hides the bootstrap revision from history, and includes small title-wrapping and version-copy refinements.

## Add lazy Drive version history

**Commit:** `104f224c381867c86870f0b4265059ffb0ff51fb` (`104f224`)
**Committed:** `2026-08-06 11:16:49 -04:00`

Added an opt-in Google Drive version picker that loads revisions only when opened, numbers them chronologically, retains a selected older revision, and presents it as a temporary read-only view without changing the current trip. The sync layer now checkpoints Drive modification and head-revision metadata to avoid unnecessary downloads, while historical versions can be reviewed, restored as separate trips, or dismissed to resume normal synchronization.

# August 5, 2026

## Fix single-stop route destination filtering

**Commit:** `e3a909cb95fb9ab48301e91f574ef1c092a030ab` (`e3a909c`)
**Committed:** `2026-08-05 23:57:11 -04:00`

Changed one-stop ground-route selections into destination filters so a place such as Tofino shows its local stays and events together with flights touching that destination. Multi-stop route segments keep their independent arrival and departure flight-chain filters, with regression coverage for both behaviors.

## Add commit-linked application footer

**Commit:** `bd9b03037435b845a1f1fdc9569077afee6ba751` (`bd9b030`)
**Committed:** `2026-08-05 12:55:57 -04:00`

Added a responsive footer with a travel-data verification disclaimer, copyright notice, and pay-what-you-want PayPal link. Development and production builds now generate validated `YYYY.MM.<short SHA>` metadata, mark dirty builds, and link deployed versions to their exact GitHub commit.

## Clarify published calendar link label

**Commit:** `26a6f83bbdc6344fc1575a2edd6e341821392bf9` (`26a6f83`)
**Committed:** `2026-08-05 12:39:45 -04:00`

Renamed the existing subscription action from “Show published link” to “Show published calendar link.” The more explicit wording distinguishes the calendar feed URL from other shared or published links in the application.

## Stabilize trip dialogs and surface status

**Commit:** `212ea60a7926cb48ac2d3afa8ef387bb3af0ffd6` (`212ea60`)
**Committed:** `2026-08-05 10:02:44 -04:00`

Made the tabbed trip picker keep a consistent responsive height with fixed headings and independently scrolling results, and reorganized favourite, calendar, archive, and delete actions into stable rows. Trip rows now show updated times plus accessible sharing and calendar icons derived from Drive and local export metadata, with overflow-safe mobile styling.

## Add favourite trip library behavior

**Commit:** `756ae9469e561c8fa12a4731b9347a16b3291ed6` (`756ae94`)
**Committed:** `2026-08-05 09:47:43 -04:00`

Replaced the single persisted startup trip with multiple local favourites and selects the active or nearest non-archived favourite on startup unless an explicit link is present. The trip picker now separates Favourites, Synced, Local-only, and Archived entries, combines cached and remote Drive results, and provides accessible star toggles plus revised action placement.

## Document August 2026 security review

**Commit:** `c662015c2d8472cc3956809c61fc781acf8cc138` (`c662015`)
**Committed:** `2026-08-05 09:03:17 -04:00`

Added an OWASP Top 10:2025 security assessment describing Waypoint’s trust boundaries, positive controls, evidence, limitations, prioritized findings, and remediation order. The review calls out risks around anonymous Drive collaboration, public calendars, recurring sync validation, serialized email links, deployment headers, browser storage, dependency drift, and stale sharing state.

## Add explicit startup trip persistence

**Commit:** `9ed712501f0d7537b24c549127bbbe589ac48607` (`9ed7125`)
**Committed:** `2026-08-05 02:01:22 -04:00`

Added Trip Actions for explicitly persisting or clearing the startup trip, while ordinary browsing, editing, imports, and Drive synchronization leave the preference unchanged. Without a persisted choice the app selects the nearest current or upcoming non-archived trip, while explicit links remain authoritative and deletion clears stale preferences.

## Expand airline check-in provider coverage

**Commit:** `0d710fe640596b4726cb46315b750d36f325adc2` (`0d710fe`)
**Committed:** `2026-08-05 01:03:36 -04:00`

Expanded the airline check-in registry to 173 brands across additional regions and replaced numerous provider destinations with verified direct or user-confirmed check-in URLs. Unsupported airlines without stable web check-in remain explicitly omitted, while tests enforce IATA matching, unique HTTPS mappings, provider selection, and omission safety.

# August 4, 2026

## Add major-airline check-in link registry

**Commit:** `702632934ac70e6ae336eed1e0413418a43bdb8e` (`7026329`)
**Committed:** `2026-08-04 22:42:56 -04:00`

Replaced the Air Canada-only check-in action with a registry of 141 verified airline-brand destinations and documented carriers that lacked a usable official URL. Flights resolve by IATA prefix before normalized provider aliases, retain the 24-hour eligibility window, and copy saved booking references into airline-specific guidance.

## Use standard UI font for enlarged code titles

**Commit:** `9133ffa7082b0906c0357561ee80c86453bd040e` (`9133ffa`)
**Committed:** `2026-08-04 22:16:19 -04:00`

Changed the title beneath enlarged QR and Code 128 views to inherit Waypoint’s standard system font family. The existing bold size, line height, spacing, and below-code placement were preserved.

## Polish landscape fullscreen navigation

**Commit:** `3e923f916852a090b96bc772142e42999f24f9a8` (`3e923f9`)
**Committed:** `2026-08-04 22:01:37 -04:00`

Reversed only the landscape entry gesture so left advances and right moves backward, and added Fullscreen API entry with a first-interaction retry plus clean exit on portrait return. Enlarged QR and Code 128 views now fill the viewport, lock page scrolling, keep codes unstretched, and place the item title in a separate row.

## Refine landscape mobile itinerary navigation

**Commit:** `625d865bf0430f5756de36f48de0837f26b18b9a` (`625d865`)
**Committed:** `2026-08-04 21:45:22 -04:00`

Changed mobile landscape mode to show one flattened itinerary entry at a time with swipe navigation across day boundaries, tall-entry scrolling, and synchronized portrait and landscape selection. Landscape editing is disabled, while confirmation codes gained single-tap enlargement and double-tap QR/Code 128 switching without changing desktop card editing.

## Document detailed flight status behavior

**Commit:** `9e6818fcbac044d5bf35990f4e247f250215ee5f` (`9e6818f`)
**Committed:** `2026-08-04 21:17:49 -04:00`

Expanded the flight-status documentation with eligibility rules, the 12-hour status window, the independent 24-hour Air Canada check-in window, and exact Google query formatting. It also records the AC800 regression scenario, deployed-tab freshness behavior, Google embedding restrictions, and an optional AirLabs design.

## Fix flight status availability in deployed tabs

**Commit:** `b80328a3241534117d79c1a3afb971ff2eb45e57` (`b80328a`)
**Committed:** `2026-08-04 20:10:04 -04:00`

Restored the intended 12-hour pre-departure flight-status window and normalized status searches to compact flight numbers such as `AC800`. Already-open deployed tabs now check the current entry bundle every minute and on visibility changes, presenting a Reload notice when a newer Waypoint build is available.

## Align flight status with check-in window

**Commit:** `052dc87ab8d169ae5afad98b0464dad157176149` (`052dc87`)
**Committed:** `2026-08-04 19:28:41 -04:00`

Temporarily moved flight-status availability from 12 to 24 hours before departure so it appeared alongside the Air Canada check-in action. Arrival-based closing behavior and the 12-hour post-departure fallback for flights without arrival times were retained and covered at their boundaries.

## Add time-gated flight status links

**Commit:** `ebb22be7a3defc5f1cf3c4a844405519bd4e0441` (`ebb22be`)
**Committed:** `2026-08-04 17:36:02 -04:00`

Added Google flight-status search links from 12 hours before departure through scheduled arrival, or until 12 hours after departure when arrival is unavailable. The client-only design and a possible user-supplied AirLabs integration were documented without adding shared credentials, background polling, or scraping.

## Add luggage capacity link to rental cars

**Commit:** `9020b331cc4d5304c0beac957d1c4e183da7e4c3` (`9020b33`)
**Committed:** `2026-08-04 15:11:23 -04:00`

Added a “Check luggage capacity” action to every rental-car itinerary item alongside its booking and source-email actions. The link opens in a separate tab, matches existing action styling, and stops click propagation so the item editor does not open.

## Refine published calendar link handling

**Commit:** `b7483e32f1dcabc1847d0bc672a4c88efbb385b5` (`b7483e3`)
**Committed:** `2026-08-04 14:57:21 -04:00`

Renamed the subscription action to “Show published link,” refreshed the feed before opening it, and replaced unreliable automatic clipboard writes with a focused, selected URL plus an explicit Copy control. Deep-linked itinerary items now use a six-second green card pulse, with a static tint under reduced-motion preferences, instead of a persistent outline.

## Improve itinerary calendar subscriptions

**Commit:** `93244e815a6f4d33da2b75328cf5fc4cb2f56b0e` (`93244e8`)
**Committed:** `2026-08-04 14:34:38 -04:00`

Made existing public subscriptions refresh from authoritative itinerary JSON when Drive connects or the link is shown, including reconnection after expired access. Calendar events gained local stay timing, category-specific alarms, virtual-meeting or exact Waypoint item links, while unreliable QR and barcode attachments were removed.

## Add portable itinerary calendar delivery

**Commit:** `104c21a9f46a6adaee2e9bd8398ec6a177f174b8` (`104c21a`)
**Committed:** `2026-08-04 12:09:03 -04:00`

Added device-local RFC 5545 calendar export and a Google Drive-hosted public read-only subscription mode under Trip Actions. Calendar output preserves time zones, ranges, locations, itinerary details, confirmations, booking URLs, and initially best-effort QR/barcode attachments, while subscription metadata survives Drive sync and is deleted with its trip.

## Add trip settings and focused mobile itinerary views

**Commit:** `c0eefc88e0c63d2f646b3e3d05bddd3e4b08d635` (`c0eefc8`)
**Committed:** `2026-08-04 08:57:31 -04:00`

Moved confirmation-code visibility and persisted Google/Apple Maps choice into a dedicated settings sheet, renamed Ground Routes to Trip Route, and required a double tap to edit mobile cards. Mobile landscape became a chrome-free single-day view with larger codes, and opening a trip now chooses today, the next scheduled in-window entry, or the first entry as appropriate.

## Add confirmation code display setting

**Commit:** `79fb50b4b30633468ad56776ff5bd64ed0af51f4` (`79fb50b`)
**Committed:** `2026-08-04 00:44:08 -04:00`

Added an enabled/disabled confirmation-code control to Trip Actions, defaulting to enabled and persisting the device-level choice in browser storage. Disabling hides QR and Code 128 canvases across editable, archived, and static trips without altering confirmation text, exports, or synchronized data.

## Add toggleable confirmation codes

**Commit:** `e73ea4f4ffbab9eac46bba736c0e795ca8b65df2` (`e73ea4f`)
**Committed:** `2026-08-04 00:34:37 -04:00`

Added locally encoded QR codes for non-empty confirmation values and let users toggle each code between QR and Code 128 without sending data to an external service. Code interactions no longer open the item editor, and responsive sizing, accessible state labels, encoder fallbacks, new dependencies, and regression tests support both formats.

# August 3, 2026

## Separate route display from map waypoints

**Commit:** `a3b31d395b09fca17412c0a13beb02c4d0a34dd8` (`a3b31d3`)
**Committed:** `2026-08-03 21:09:08 -04:00`

Separated compact route chips from a complete `mapStops` sequence so adjacent city labels can be deduplicated in the interface without losing distinct addresses. Google Maps links now retain every chronological venue and flight-boundary airport while route filtering and long-route splitting keep their prior behavior.

## Refine shared itinerary details and ground routes

**Commit:** `58fb6675364c5c1c44adca2378d06b63f8719b48` (`58fb667`)
**Committed:** `2026-08-03 20:39:43 -04:00`

Restricted active source-email links to local trips and Drive files owned by the current user, while preserving the URL as disabled data for shared recipients and allowing JSON-tab overwrites to update existing items safely. Ground routes now keep distinct chronological addresses and independent flight endpoints, and multi-night stays display a derived night count.

## Add scoped travel searches and stay-aware map links

**Commit:** `40a417ddf209549364392b42f28499374261adef` (`40a417d`)
**Committed:** `2026-08-03 18:47:45 -04:00`

Added five default-on booking-category controls so generated mailbox prompts include only the selected search families while retaining a generic ticket query. Google Maps payloads now prefix stay locations with their provider for better hotel matching, and the prompt builder remains usable in a single-column mobile layout.

## Correct email sender and booking search semantics

**Commit:** `434d2d252af24b76898d08f51640908459a62553` (`434d2d2`)
**Committed:** `2026-08-03 17:52:29 -04:00`

Changed generated mailbox searches to use traveller, booker, and provider sender operands exactly as entered instead of inventing domains or addresses. Booking discovery now uses independent booking-and-item term searches across Gmail, Outlook, and generic connectors, while “Search Clues” was renamed “Search Hints” and kept confidence-only.

## Simplify email itinerary search by month

**Commit:** `297382eb392ced8ec4481f1b1ba7477df4a01f34` (`297382e`)
**Committed:** `2026-08-03 17:04:19 -04:00`

Replaced full-window and neighborhood discovery with deterministic inclusive month windows clipped to the authorized mailbox range, including leap years and cross-year ranges. Each month now runs per-sender, ten sender-free booking-term, and cancellation searches with provider-neutral Gmail, Outlook, and structured-filter guidance.

## Match JSON editor height to item form

**Commit:** `bc032ecd6c685fd7790f5605d750a29fded0a947` (`bc032ec`)
**Committed:** `2026-08-03 16:18:09 -04:00`

Measured the rendered Details form before switching tabs and reused that modal height so the JSON editor no longer collapses to a shorter window. The JSON panel and textarea now consume the available responsive space while keeping help, status, and actions visible without hard-coded desktop dimensions.

## Add item JSON import and copy tabs

**Commit:** `02d9a095a9ce0f1163a6aa68b4d91dde83a6e30a` (`02d9a09`)
**Committed:** `2026-08-03 16:11:21 -04:00`

Added a JSON tab beside the normal Details form that accepts one item, an item array, or an object containing `items`, with validation for schema, supported values, size, and HTTPS-only links. Pasted records receive fresh IDs and lose conflict markers, multi-item batches save together, and existing items can be viewed as formatted copyable JSON.

## Improve itinerary email discovery recall

**Commit:** `9fb1b7bfc03fb922af2c1225020997e1c5fb1d9b` (`9fb1b7b`)
**Committed:** `2026-08-03 13:46:09 -04:00`

Built on the restored Version 5 prompt with a destination-independent evidence seed, attachment search, provider and forwarder expansion, lifecycle checks, and route-gap transport hypotheses that do not count as proof. The flow preserves distinct sibling reservations and useful transport legs, produces one Waypoint JSON file, and avoids the former audit-heavy completion contract.

## Update `.gitignore`

**Commit:** `43bb3d571264266370c1af0d1b813defac40ccfe` (`43bb3d5`)
**Committed:** `2026-08-03 12:27:56 -04:00`

Added macOS Finder metadata files to the repository ignore rules. This prevents Finder metadata from appearing as untracked project changes.

## Restore Version 5 email extraction behavior

**Commit:** `ca7e50b3db19a640c3f389a53a8cd81c50a6c970` (`ca7e50b`)
**Committed:** `2026-08-03 12:26:36 -04:00`

Replaced the audit-heavy Version 13 prompt with the exact, more effective Version 5 discovery and extraction flow while retaining evidence reconciliation, booking attribution, source links, split rental events, and the supported item schema. Later lane audits, transport hypotheses, sibling accounting, query proofs, and traversal requirements were removed, and all 13 prompt revisions were preserved in a lossless Markdown history.

## Prefer native continuation before date refinement

**Commit:** `65be4d95fe0e0989949d69acaaa761750c8e9619` (`65be4d9`)
**Committed:** `2026-08-03 11:19:03 -04:00`

Clarified that seed searches should use the connected provider’s native result continuation whenever it is available and practical. Only then should searches fall back to authorized, clipped calendar-month, week, and day refinements, with a regression assertion locking the provider-neutral rule.

## Complete capped searches with bounded refinements

**Commit:** `e09db7a926781d8868e1e799982bd76c5e43eeb4` (`e09db7a`)
**Committed:** `2026-08-03 11:17:30 -04:00`

Made completed output mandatory and generalized capped-result traversal across cursors, tokens, pages, scrolling, or exact month-to-week-to-day refinements inside the authorized scope. The prompt now processes plausible candidates early, exhausts discovered anchors, limits broad receipt and attachment work, and records why a prior strict policy found Bunratty evidence but failed to emit JSON.

## Require query-level proof for every discovery lane

**Commit:** `5e4fd13d9c7bdbd07db7c1c1c749bdfdd6816981` (`5e4fd13`)
**Committed:** `2026-08-03 10:52:00 -04:00`

Required separate full-window searches and detailed audit records for each event and admission concept plus every newly discovered anchor. A lane can now complete only with verifiable query scope, result traversal, candidate counts, and dispositions, and the documented medium-reasoning run reconciled 20 items while exposing two missing Bunratty candidates.

## Preserve distinct sibling reservations

**Commit:** `b065cdc6686fb37cb419884f6eb011fc1fa970dc` (`b065cdc`)
**Committed:** `2026-08-03 10:34:58 -04:00`

Required separate references from the same provider to remain separate candidates unless authoritative evidence proves a replacement, reissue, or cancellation relationship. Provider-level candidate counts must reconcile with dispositions and output, preventing adjacent reservations such as a timed event and next-day admission from being merged.

## Classify trains and buses as transport

**Commit:** `ce7c471766c927487a0287ec52db2d166a02c147` (`ce7c471`)
**Committed:** `2026-08-03 10:28:37 -04:00`

Required confirmed train, rail, bus, and coach bookings to produce `transport` itinerary items. Independently useful legs and connections remain separate instead of being collapsed, with the prompt behavior fixed by regression assertions.

## Make transport discovery auditable and implication-aware

**Commit:** `708095369d881faca0ca48b65f5a05e673791b06` (`7080953`)
**Committed:** `2026-08-03 10:27:16 -04:00`

Added mandatory independent searches for taxis, rideshares, transfers, rail, buses, ferries, and rental cars, plus focused hypotheses from flight and route boundaries that never count as booking evidence. Discovery now reconciles lifecycle states, distinguishes unrelated cancellations, emits a detailed completion audit, fails closed on incomplete coverage, and recommends higher reasoning for broad mailbox work.

## Restore high-recall email extraction

**Commit:** `7ab254b5c4cc31e6f7192045046212157480b148` (`7ab254b`)
**Committed:** `2026-08-03 10:05:07 -04:00`

Replaced a monolithic discovery gate with independently checkable search lanes covering providers, forwarded bursts, events, admissions, insurance, attachments, and discovered references. Complete pagination and bounded date slicing now feed an explicit candidate ledger, and the corrected Ireland regression recovered all 22 confirmed benchmark items.

## Stabilize filtered itinerary layout

**Commit:** `95f66ca49e7242e3b03975b4d638426c31d38d86` (`95f66ca`)
**Committed:** `2026-08-03 09:27:41 -04:00`

Replaced the font-dependent route chevron with a fixed SVG centered by the button’s grid layout while preserving collapse rotation. Reserving the scrollbar gutter now prevents the title, route controls, and agenda from shifting horizontally when filters change result height.

## Persist route collapse and strengthen email discovery

**Commit:** `33b3537076abc5f741dbfbeebea79f41e7c42d6d` (`33b3537`)
**Committed:** `2026-08-03 09:05:30 -04:00`

Replaced the route “Show all” control with an accessible chevron whose collapsed state persists per trip, while clicking an active waypoint again restores the full itinerary. Email extraction instructions were restructured around high-recall query families, pagination, candidate queues, forwarded-message bursts, disposition tracking, and a hard completion gate.

## Filter paired flight steps by complete chains

**Commit:** `049aacb5a2218a253ca3f9d67aa62edec23e6edf` (`049aacb`)
**Committed:** `2026-08-03 01:26:44 -04:00`

Associated every flight item ID with its displayed inbound or outbound IATA chain and gave those chains dedicated filter IDs. Selecting a connection path such as `YYZ/MSP/HNL` now shows every leg in the chain instead of only flights touching the terminal airport, while ordinary ground-stop filtering is unchanged.

## Move flight paths into ground-route steps

**Commit:** `bc3a44142ab364208540dfdc711f8d2692793d3f` (`bc3a441`)
**Committed:** `2026-08-03 01:18:46 -04:00`

Moved inbound and outbound flight-code chains out of the ground-route heading and into the first and last selectable airport steps. A shared first and final stop can display both chains, while route headings remain dedicated to the region name and map action.

## Show paired flight paths on ground routes

**Commit:** `71157cd35749aed749ca309264ead1bd44bd38db` (`71157cd`)
**Committed:** `2026-08-03 01:11:48 -04:00`

Derived direct and connecting inbound and outbound airport-code chains from chronological flights and attached them to each ground-route segment with plane icons. Imported trips now keep their original titles while receiving fresh IDs, and historic app-generated “(imported)” suffixes are removed during upgrade.

## Use airport codes and travel-date trip ordering

**Commit:** `bec9771d1b6702be77b330f0e01b18dfd073ebef` (`bec9771`)
**Committed:** `2026-08-03 00:58:46 -04:00`

Improved top-level route stops by extracting explicit three-letter IATA codes from several common location formats without changing the full item text. Local and Drive trip libraries now sort undated trips first by modification time and dated trips by newest final travel date, with Drive metadata and legacy-content fallbacks supporting the order.

## Refine trip and travel day classification

**Commit:** `dafe397fd05197a2e7eca457fbcfe1d74587b65c` (`dafe397`)
**Committed:** `2026-08-03 00:31:50 -04:00`

Reworked day classification around an 8:00 a.m.–11:00 p.m. awake window, requiring more than 7.5 usable destination hours for a trip day. Connected flight journeys can span 18-hour layovers, destination time outranks raw flight duration, substantial in-air days remain travel days, and separate home-arrival dates are counted correctly.

# August 2, 2026

## Prevent trip title descenders from clipping

**Commit:** `5acc8df9ebaeedc7886e5e2208d4be64a2d04bae` (`5acc8df`)
**Committed:** `2026-08-02 23:58:25 -04:00`

Increased the editable trip title line height and added a small bottom allowance so descenders such as g, j, p, q, and y remain visible. Display and edit states now share the same vertical metrics while preserving single-line truncation, width limits, and ellipsis behavior.

## Use Google Maps exclusively and reorder event controls

**Commit:** `152657a74c2beb4b209e8fb91c79a3017b579d2e` (`152657a`)
**Committed:** `2026-08-02 23:51:08 -04:00`

Removed Apple Maps selection and related storage, helpers, tests, and styling so every location and ground-route action opens Google Maps. Event was moved directly after Car Rental in shared type ordering, updating both filters and the editor without changing chronological scheduling.

## Remove plan and reference item types

**Commit:** `2e52c136391e6063462d9a1c0e29e041578575ec` (`2e52c13`)
**Committed:** `2026-08-02 23:29:40 -04:00`

Limited supported itinerary items to flight, stay, car, transport, insurance, and event, removing Plan and Reference from types, filters, editors, sorting, prompts, and route logic. New entries now default to Event under an “Add item” action, and imports containing either removed type are explicitly rejected.

## Improve insurance extraction and simplify daily agenda

**Commit:** `92bf6f55b82c5ce6025f4008755a99529d611155` (`92bf6f5`)
**Committed:** `2026-08-02 23:04:08 -04:00`

Added a dedicated insurance search and reconciliation step that matches policy windows to trip dates, excludes unrelated coverage, and uses compatible local date-times with a documented noon fallback. Per-day waypoint summaries and links were removed from the agenda while the trip-level ground route and item location links remained.

## Classify flight-heavy dates as travel days

**Commit:** `548a7add9609bf036ece9d2dc478c89d0b366f6e` (`548a7ad`)
**Committed:** `2026-08-02 21:58:33 -04:00`

Added a rule that marks dates with more than 12 hours of scheduled flight time as travel days without double-counting existing boundary classifications. Duration uses stored minutes first, falls back to time-zone-aware departure and arrival calculations, and still works when only a known duration is available.

## Reorder trip actions and add safe deletion

**Commit:** `7177d1806ded72decd896f032a2dae2b8b5b4cf6` (`7177d18`)
**Committed:** `2026-08-02 21:41:58 -04:00`

Grouped related Trip Actions into paired rows for both desktop and mobile presentation. Replaced the local-only delete control with a two-click Delete Trip flow that moves synced files to Google Drive trash before clearing the local cache and deletes local trips only from the device.

## Generalize route labels and daily waypoints

**Commit:** `1b34fcc10f0eb2e3246cafc9c4ae5f66b7fe0c67` (`1b34fcc`)
**Committed:** `2026-08-02 21:25:05 -04:00`

Derived ground-route headings from broad state, province, or country address components, including US ZIP codes and state abbreviations. Adjacent city stops are collapsed while later revisits remain, and each day gained waypoint links for distinct street-level places without routing flights.

## Add map preferences and clarify Drive trip ownership

**Commit:** `f150e8f9812f6c74a114843ce4738d8e2c955d17` (`f150e8f`)
**Committed:** `2026-08-02 21:05:40 -04:00`

Added a session-scoped Google Maps or Apple Maps preference that applied to itinerary places and ground routes, including Apple search and per-leg driving URLs. Drive-linked trips became synchronized caches rather than separate local-library entries, and disconnecting from Drive now preserves the cached itinerary as an independent local copy.

## Segment maps around flight boundaries

**Commit:** `c3117c815b0a7ceebce20957221d3a20cb43e7fb` (`c3117c8`)
**Committed:** `2026-08-02 20:48:59 -04:00`

Rebuilt Google Maps routes from ground items separated by flight boundaries, seeding at arrival airports, closing at departure airports, collapsing connections, and avoiding a round-trip airport-to-home tail. Distinct same-city addresses remain useful, regional segments receive meaningful names, and long routes use balanced partitions near city changes instead of greedy ten-leg chunks.

## Prevent cross-trip Drive merges

**Commit:** `fe8837d0c08d9700681fb998cbee1d9354b1fcbf` (`fe8837d`)
**Committed:** `2026-08-02 20:12:40 -04:00`

Guarded asynchronous Drive refresh, save, polling, and manual sync results with the active trip ID so a completed request cannot overwrite a trip selected in the meantime. Merge and Drive update paths now reject mismatched trip identities, while trip switching resets view state and uses a dedicated responsive picker layout.

## Fix itinerary rendering and trip recovery

**Commit:** `0ff20397f3361d990bb77d456bbe4b37585c1366` (`0ff2039`)
**Committed:** `2026-08-02 18:43:29 -04:00`

Kept cards inside their day column, made confirmation grids print-safe, sorted unspecified-time entries at noon, and replaced an oversized destination list with a wrapping chronological route whose stops filter the agenda. Local and Drive trip recovery was hardened to preserve unrelated local versions and avoid startup replacement, while boundary-day rules and car-extraction requirements were refined.

## Improve portable trip extraction and itinerary UX

**Commit:** `0e7a89f8247f312559b7fb4a7b3e3eba63afec98` (`0e7a89f`)
**Committed:** `2026-08-02 13:08:43 -04:00`

Strengthened mailbox prompts around received mail, forwarder and recipient booking attribution, split rental pickup and return events, distinct destinations, and separate source-message URLs. Destinations and routes are now derived from items, addresses open Maps, confirmation details and link types are clearer, and safe destination/month/year filenames plus schema validation improve portable imports and exports.

## Replace email parsing with reusable extraction prompts

**Commit:** `f62a41e1e34e4f9183308c2781953c9974ca901e` (`f62a41e`)
**Committed:** `2026-08-02 12:15:02 -04:00`

Removed in-app email, EML, document, and PDF parsing plus `pdfjs`, replacing them with reusable, trip-scoped instructions for an AI assistant connected to a mailbox. The new workflow reconciles message lifecycles and attachments, preserves supported details and uncertainty, adds `bookedBy`, allows arbitrary IANA zones, and hardens snapshot, Drive, and file imports.

## Harden parsing across changing email layouts

**Commit:** `b75d3dee317e316aedd2fb835344317f2e612e95` (`b75d3de`)
**Committed:** `2026-08-02 11:48:16 -04:00`

Improved the then-current local parser to score MIME alternatives, normalize HTML safely, parse calendar attachments, pair nearby travel fields, and extract generic flight and confirmation data from redesigned messages. It stopped using email sent dates as travel dates, made subject dates an explicit time-unspecified fallback, and added regressions for changing Air Canada layouts and calendar content.

## Generalize itinerary imports and trip day indicators

**Commit:** `701e309944e8baaf01f41f9a7c434510e2a130f4` (`701e309`)
**Committed:** `2026-08-02 11:33:29 -04:00`

Replaced provider-specific assumptions with bounded MIME, Base64, quoted-printable, HTML, and plain-text decoding that extracts arbitrary reservations while treating uploads as inert and accepting only validated HTTPS links. The interface added trip and travel-day counts, tightened overlap rules to timed events, corrected taxi values, improved sharing presentation, and enforced upload-size limits.

## Unify trip actions and expand Drive sharing controls

**Commit:** `f4eaeddb229e4794e64c1a8706d26ae2a7364129` (`f4eaedd`)
**Committed:** `2026-08-02 10:49:58 -04:00`

Replaced duplicate mobile controls with one responsive Trip Actions menu and standardized commands for Drive sync, JSON, snapshots, sharing, and email imports. Drive reconnect and access management now preserve linked files and permissions, while synchronized archive/unarchive makes archived trips read-only across devices and merge-safe.

## Show all dates for mobile category filters

**Commit:** `7d6ffe8b95736e70d8f01d6fc6ed00559fbf0d0d` (`7d6ffe8`)
**Committed:** `2026-08-02 10:23:25 -04:00`

Separated the all-items mobile daily agenda from category-filtered views. All keeps the day pager and horizontal swipes, while selecting Flight, Stay, Car Rental, or another category disables swiping and renders every matching date in one scroll.

## Add mobile-aware UI and Drive trip collaboration

**Commit:** `c161da4d7f55f370ee2273617d2068a3e06e3fd7` (`c161da4`)
**Committed:** `2026-08-02 09:22:16 -04:00`

Added multi-signal mobile detection with explicit URL overrides, responsive viewport behavior, inline trip-title editing, and visible itinerary date ranges and durations. Waypoint gained local, private Drive, static snapshot, and live shared Drive modes with revision merging, duplicate conflict preservation, OAuth build configuration, and collaboration tests.

# August 1, 2026

## Document mobile agenda and Air Canada check-in behavior

**Commit:** `b2fb9dec4b443dd08a7d4d026fa01f6368d440b4` (`b2fb9de`)
**Committed:** `2026-08-01 22:06:32 -04:00`

Documented the mobile one-day agenda, gesture direction and thresholds, vertical scrolling, pager reset and clamping, and tap-to-edit behavior. It also records the time-zone-aware 24-hour Air Canada check-in window, booking-reference copy flow, minute refresh, official destination, and the tests and browser checks used to verify the feature.

## Add mobile day swiping and flight check-in

**Commit:** `744f94a1c294a36647397325c59dc966066f043e` (`744f94a`)
**Committed:** `2026-08-01 22:05:10 -04:00`

Added a mobile day pager with predominantly horizontal 50-pixel swipe navigation, filter/trip resets, bounds clamping, and one active itinerary day at a time. Air Canada flights now expose official check-in during the exact 24 hours before zoned departure and copy the saved booking reference when possible.

## Refine trip sharing controls

**Commit:** `7ef3162471761dcf049fc2f28b83321c59013626` (`7ef3162`)
**Committed:** `2026-08-01 21:51:44 -04:00`

Stopped automatically copying the share URL as soon as it was generated and moved the operation into a dedicated share dialog. The dialog gained a compact copy icon, accessible clipboard status, a simpler Done action, and clearer “Share trip” labeling.

## Add reliable share link fallback

**Commit:** `aba8d92953b7e9eb943fea9d73d56ab0e366fffa` (`aba8d92`)
**Committed:** `2026-08-01 21:49:15 -04:00`

Added a share dialog that always exposes the complete snapshot URL even when direct clipboard access is unavailable. Users can select, copy, or open the link manually, while successful clipboard writes still provide immediate status feedback.

## Add trip share links and preserve item edits

**Commit:** `d1bb4f38a6750398a161b5b6756377fec4e4145e` (`d1bb4f3`)
**Committed:** `2026-08-01 21:45:36 -04:00`

Added compressed URL-hash snapshot sharing and the ability to open a shared trip alongside the local library, with updated-time context in desktop and mobile views. Persistence now assigns edit timestamps before saving and respects supplied timestamps in IndexedDB, preserving the ordering and identity of item edits and shared snapshots.

## Enforce chronological itinerary ordering

**Commit:** `a356249eb911c79f9037fdcc0fae2f430068a25c` (`a356249`)
**Committed:** `2026-08-01 21:41:28 -04:00`

Centralized itinerary ordering in a shared schedule-time helper that sorts by local date and time with title tie-breaking. Saved, imported, displayed, grouped, and exported items now use the same deterministic chronology, including time-unspecified entries.

## Fix local event times and deletion flow

**Commit:** `5fa1409ddc846f0b22851ff6a4e74f0731bfdad8` (`5fa1409`)
**Committed:** `2026-08-01 21:36:45 -04:00`

Changed itinerary grouping and display to preserve stored local wall times instead of shifting events through the browser’s zone, and added explicit time-unspecified event handling plus the Honolulu zone and corrected Derry/Bunratty imports. Deletion now removes both saved items and unsaved import drafts, closes the editor, and avoids leaving stale draft state behind.

## Add local PDF itinerary import

**Commit:** `3c150e687f2f65116b53d55ecba2ba7f6bd609ab` (`3c150e6`)
**Committed:** `2026-08-01 21:31:55 -04:00`

Added lazy, entirely local text extraction for uploaded PDFs through `pdfjs-dist`, turning detected dated passages into reviewable itinerary drafts. Imports reject unreadable or scanned files with a clear message, preserve chronological sorting, and keep the source document on-device.

## Add complete flight timing details

**Commit:** `b4e69601b8fe07e5f3b3713f311346e3a9ed1529` (`b4e6960`)
**Committed:** `2026-08-01 21:26:00 -04:00`

Extended flight items with arrival time zones, flight numbers, and duration minutes and displayed both local departure and arrival times plus flight metadata in the agenda. Existing and newly imported Air Canada legs were upgraded with complete AC800 and AC801 timing details, and the item editor gained the corresponding fields.

## Show confirmation references in agenda

**Commit:** `0ed34fdee9558bea68e2c952937a257b557221eb` (`0ed34fd`)
**Committed:** `2026-08-01 21:22:26 -04:00`

Added saved confirmation or ticket references directly to itinerary cards. The references use dedicated styling and a descriptive title so travellers can find booking identifiers without opening the editor.

## Redesign mobile navigation and links

**Commit:** `92aa99fec804cb7f075f7cee6375bb5d2c8c73fb` (`92aa99f`)
**Committed:** `2026-08-01 21:14:25 -04:00`

Replaced the compressed desktop layout on small screens with a sticky mobile header, trip and settings sheets, category bar, card-based agenda, bottom navigation, and prominent add action. Booking-link parsing now repairs quoted-printable line folding, validates URLs, and keeps useful reservation destinations while rejecting malformed or low-value links.

## Remove seeded Ireland test trip

**Commit:** `e6d39cf25711e85b9874965250febeebb492345d` (`e6d39cf`)
**Committed:** `2026-08-01 21:08:42 -04:00`

Added startup migration for a previously seeded “Ireland summer escape” trip. When that sample is the only saved trip, Waypoint removes it and creates a clean New Trip instead of presenting test data as user content.

## Improve blank trip and mobile agenda

**Commit:** `d472b8570153a16763bcdcd510b9e7eb64fdf08f` (`d472b85`)
**Committed:** `2026-08-01 21:07:49 -04:00`

Changed first-run behavior from seeding the Ireland sample to creating an empty New Trip and added the first dedicated responsive stylesheet for compact agenda cards and bottom-sheet editing. Imported confirmations now retain useful booking URLs, including repaired provider links, and cards expose those links without opening edit mode.

## Build local-first travel planner

**Commit:** `db2b58d17a575646d680408b0eead2078c6f5e38` (`db2b58d`)
**Committed:** `2026-08-01 20:02:27 -04:00`

Created the initial React, TypeScript, and Vite Waypoint application with IndexedDB trip storage, itinerary CRUD, category filters, overlap indicators, JSON import/export, and local confirmation parsing. The first release also established the trip and item schema, tests, styling, sample data, production build configuration, and GitHub Pages deployment workflow.
