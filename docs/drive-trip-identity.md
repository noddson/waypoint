---
title: Canonical Drive trip identity and duplicate recovery
type: decision
status: open
decided: 2026-11-18
---

A trip ID identifies an itinerary, while a Drive file ID identifies its storage object. A browser-local mapping between those IDs cannot establish one account-wide storage object. Initial saves must discover existing owner-controlled files by trip ID before creating a file. Searching only a particular folder is insufficient because older layouts or multiple root folders may contain an existing trip.

## Decision

Initial creation searches every result page and refuses incomplete results. One verified existing file is reopened without uploading stale local data over it. Different local contents are preserved in a separate local-only backup. Overlapping calls share a promise; Web Locks serialize initial creation across tabs where available. A post-create identity check detects independent-device creation races.

Several files claiming the same trip ID pause owner sync for explicit review. The recovery screen shows validated contents, item counts, and actual trip edit timestamps. A user choice sets the selected file's private `waypointCanonicalTrip` property and clears that property on other selected files, preserving all JSON content. Other owner devices check that selection before writing and offer to open the chosen file. A stale tab with a superseded browser binding also stops before uploading. Multiple simultaneous canonical selections cause another review. Alternative files remain visible in the trip library.

## Alternatives and consequences

Choosing by Drive modification time is unsafe because metadata changes do not imply newer itinerary contents. Automatically combining copies without a shared base could restore intentional deletions. Neither filename uniqueness nor private appProperties creates a distributed uniqueness constraint. The implementation therefore requires explicit selection when identity is ambiguous and does not delete files.

The selected-file marker remains outside the strict itinerary JSON schema. Existing exports stay compatible, OAuth scopes do not change, and no service backend is introduced. Owner sync adds a metadata search. Cross-device creation can still race; the system detects it after creation and before later owner writes instead of pretending the lookup is atomic.

## Separate unresolved upload race

The three-way merge reconciles remote changes observed before upload. Canonical media PATCH requests do not currently use a verified server-enforced compare-and-swap mechanism. Two devices that read the same head can upload in succession and leave only the later content current. A speculative If-Match header, a browser-only lock, or a readback is not proof of distributed atomicity. A verified conditional media-write contract or an immutable change-log protocol is separate required work for fully lossless concurrent uploads.

## Observations

- [decision] Recover by trip ID, validate the file and embedded identity, and preserve differing local data before adoption.
- [decision] Pause ambiguous owner sync and persist an explicit account-wide file choice without deleting any JSON copy.
- [limitation] Identity recovery does not establish atomic concurrent content replacement.
- [files] src/googleDrive.ts, src/App.tsx, src/DriveTripCopies.tsx, src/styles.css, README.MD.
- [verification] Unit tests cover existing-file recovery, overlapping creation, search pagination and incomplete results, duplicate and conflicting selections, metadata/content identity disagreement, stale-tab binding, and Web Lock rechecks. Browser tests exercise desktop/mobile recovery and missing-link adoption with local backup preservation and unchanged Drive JSON.
