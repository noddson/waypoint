# Security Review

Review date: August 5, 2026

Repository: Waypoint travel planner
Assessment basis: OWASP Top 10:2025, static source review, dependency advisory audit, test suite, and production build

## Executive summary

> **Implementation update — August 9, 2026:** This review records the legacy sharing implementation assessed on August 5. The unified Sync & Share work replaces anonymous writers with policy-filtered public/named reader projections, reserves canonical writes for named collaborators, validates pull-only viewer updates, and applies a sanitized public-calendar policy. Treat the findings and source line references below as the remediation baseline; deployment remains gated on the unit/security suite and production build.

No direct DOM cross-site scripting, SQL injection, command injection, hard-coded secrets, or currently known vulnerable npm packages were found. The principal risks are broken access boundaries around shared trip data, anonymous Google Drive collaboration, unvalidated remote updates, and calendar-data injection.

No High-likelihood/High-impact issue was confirmed. Three Medium-likelihood/High-impact findings should be addressed first:

1. Replace anonymous Google Drive writer links with named collaborators or read-only links.
2. Remove sensitive itinerary fields from public calendar feeds by default.
3. Apply full schema and size validation to every Google Drive refresh, not only the initial load.

The assessment uses the current [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/).

## Likelihood and impact matrix

| Likelihood / Impact | High impact | Medium impact | Low impact |
|---|---|---|---|
| **High likelihood** | None confirmed | **S1:** Owner-only email links included in shared data | None confirmed |
| **Medium likelihood** | **S2:** Anonymous Drive writers<br>**S3:** Sensitive public calendars<br>**S4:** Unvalidated ongoing Drive sync | **S5:** Missing browser security policy<br>**S6:** Malformed or oversized input denial of service | **S10:** Stale sharing status and limited alerting |
| **Low likelihood** | **S7:** ICS injection<br>**S8:** Sensitive browser storage on a shared origin<br>**S9:** Supply-chain drift | None confirmed | None confirmed |

Within equally distant matrix cells, high-impact findings are prioritized ahead of high-likelihood findings.

## Attack surface

The reviewed application is a client-side React and Vite application with no application backend or database. Its main trust boundaries and externally influenced inputs are:

- Static snapshot data encoded in the URL fragment.
- Live Google Drive links containing a file ID and optional resource key.
- Google Drive OAuth tokens, files, revisions, and permissions.
- Imported trip JSON files and the item JSON editor.
- Browser storage: IndexedDB, `localStorage`, and `sessionStorage`.
- Exported and publicly published iCalendar data.
- User-controlled booking, source-email, map, and virtual-event links.
- The dynamically loaded Google Identity Services script.
- Generated instructions intended for an AI assistant with email access.

## Findings and recommendations

### S2 — Anonymous link grants write access

**Likelihood: Medium | Impact: High | OWASP A01 Broken Access Control / A06 Insecure Design**

Live sharing creates a Google Drive permission with `type: "anyone"` and `role: "writer"`. Anyone who obtains or receives the URL can alter the authoritative itinerary, potentially corrupting dates, booking details, confirmation codes, and downstream calendars.

Evidence:

- `src/googleDrive.ts:222-227` creates an anonymous writer permission.
- `src/App.tsx:143` enables that permission and produces the live sharing URL.

Recommendations:

1. Default shared links to read-only.
2. Grant edit access only to named Google accounts.
3. Clearly separate “share for viewing” from “invite editor.”
4. Provide prominent revocation and link-rotation controls.
5. Display a persistent warning whenever anonymous write access is active.

### S3 — Published calendars expose sensitive itinerary data publicly

**Likelihood: Medium | Impact: High | OWASP A01 Broken Access Control / A06 Insecure Design**

Calendar publishing grants `anyone` reader access to the generated file. The feed contains precise locations, notes, confirmation references, and booking URLs. Although the application warns the user before publication, a forwarded, logged, synchronized, or accidentally exposed long-lived URL reveals high-value travel information.

Evidence:

- `src/googleDrive.ts:158-163` creates a public reader permission.
- `src/calendarExport.ts:48-60` includes providers, confirmation references, names, locations, notes, and booking links in the event description.
- `src/App.tsx:132` warns the user before publication but still publishes all of these fields.

Recommendations:

1. Create a separate sanitized public-calendar projection.
2. Exclude confirmation codes, booking links, source-email links, personal notes, and precise addresses by default.
3. Let the owner explicitly opt individual sensitive fields into a feed.
4. Add a clear unpublish action that revokes the public Drive permission.
5. Support URL rotation after suspected disclosure.

### S4 — Periodic Drive sync bypasses full validation

**Likelihood: Medium | Impact: High | OWASP A08 Software or Data Integrity Failures / A10 Mishandling of Exceptional Conditions**

Initial Drive loads call `validTripExport`, but subsequent automatic updates only verify that `remote.trip` exists, `items` is an array, and the trip ID matches. A live collaborator can therefore introduce invalid types, oversized fields, malformed dates, duplicate IDs, unsafe metadata, or huge arrays after the initial connection.

Malformed data may be stored locally, crash rendering, corrupt merge logic, or propagate into the public calendar.

Evidence:

- `src/App.tsx:140-141` applies full validation during initial Drive opening.
- `src/googleDrive.ts:279-297` does not call `validTripExport` during recurring synchronization.

Recommendations:

1. Use one strict parser at every trust boundary: file import, snapshot import, initial Drive load, recurring refresh, merge, and local cache restoration.
2. Validate collaboration and calendar metadata as well as the trip body.
3. Reject invalid revisions without overwriting the local copy.
4. Retain and expose recovery to the last known-good remote revision.
5. Enforce total response, item-count, and aggregate decoded-size limits before synchronization.

### S1 — “Owner-only” source-email access is enforced only in the UI

**Likelihood: High | Impact: Medium | OWASP A01 Broken Access Control**

The UI hides `emailLink` for non-owners, but snapshot creation and JSON export serialize the complete trip unchanged. Snapshot recipients can use the visible Export JSON action to recover the hidden links. Live collaborators can also inspect them through the item JSON editor.

The email provider may still require authentication, but this defeats the application's stated field-level boundary and discloses mailbox or message identifiers.

Evidence:

- `src/App.tsx:90` calculates whether source-email links should be displayed.
- `src/App.tsx:124` exports the full trip without removing `emailLink`.
- `src/App.tsx:136` encodes the full trip into snapshot links.
- `src/App.tsx:177` and `src/App.tsx:185` expose JSON export to snapshot and live-trip recipients.
- `src/App.tsx:247-255` serializes complete items in the JSON editor.

Recommendations:

1. Define separate owner, collaborator, snapshot, and calendar data-transfer objects.
2. Remove `emailLink` before data leaves the owner boundary.
3. Do not treat a rendering condition as access control for data already delivered to the browser.
4. Consider storing private owner annotations separately from the shared itinerary file.
5. Add tests proving that every non-owner serialization path excludes owner-only fields.

### S5 — No repository-defined CSP or anti-framing policy

**Likelihood: Medium | Impact: Medium | OWASP A02 Security Misconfiguration**

The repository defines neither a Content Security Policy nor response security headers. It dynamically loads Google Identity JavaScript, and the OAuth token and sensitive local data would be accessible to any successful same-origin script compromise. Missing framing protection also leaves destructive and sharing actions more exposed to clickjacking.

Evidence:

- `index.html` contains no CSP metadata.
- `src/googleDrive.ts:58-65` dynamically loads Google Identity Services.
- `.github/workflows/deploy-pages.yml` deploys static files without defining security headers.

Recommendations:

1. Deploy from a host capable of setting security response headers.
2. Add and test a restrictive Content Security Policy.
3. Set `frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'none'`.
4. Set a restrictive `Referrer-Policy` and minimal `Permissions-Policy`.
5. Allow only the exact Google Identity and Drive endpoints needed by `script-src`, `connect-src`, `frame-src`, and `img-src`.
6. Test OAuth, QR generation, Drive synchronization, and production updates under the policy before enforcement.

### S6 — Oversized or malformed shared data can cause client-side denial of service

**Likelihood: Medium | Impact: Medium | OWASP A10 Mishandling of Exceptional Conditions**

Compressed snapshot data is decompressed and parsed without compressed or expanded-size limits. Drive responses are also parsed without a response-size limit. Validation checks string lengths but does not semantically validate dates and time zones; invalid dates can reach formatting code that throws.

The 5 MB cap applies only to imported files, not snapshots or Drive refreshes.

Evidence:

- `src/App.tsx:47-51` decodes and optionally decompresses snapshot data without an expanded-size limit.
- `src/App.tsx:151` imposes a 5 MB limit only on file imports.
- `src/tripImport.ts:22-35` checks shapes and lengths but not semantic date or time-zone validity.
- `src/googleDrive.ts:271-275` parses Drive JSON without a response-size limit.

Recommendations:

1. Limit encoded snapshot length before Base64 decoding.
2. Count bytes during decompression and abort when the expanded limit is exceeded.
3. Limit Drive response sizes before parsing.
4. Validate ISO date-time values and IANA time zones.
5. Limit aggregate trip size, not only per-field size and item count.
6. Add a React error boundary and a safe recovery path that removes or quarantines the failing trip.

### S7 — Calendar UID permits ICS content injection

**Likelihood: Low | Impact: High | OWASP A05 Injection**

Most calendar text is escaped, but `item.id` is inserted directly into the `UID` property. The import validator permits carriage returns, line feeds, and other control characters in IDs. A crafted ID can introduce additional ICS properties or events when the victim exports or publishes a calendar.

Evidence:

- `src/tripImport.ts:25` accepts any item ID string of at most 200 characters.
- `src/calendarExport.ts:90` inserts the ID directly into `UID` without escaping or character validation.

Recommendations:

1. Require item IDs to be UUIDs or match a conservative alphabet such as `[A-Za-z0-9._-]`.
2. Reject carriage returns, line feeds, null bytes, and all other control characters in every field.
3. Apply context-specific ICS encoding to every property name, parameter, and value.
4. Add regression tests for CRLF injection through IDs and URLs.
5. Validate the completed calendar with multiple standards-compliant parsers before publication.

### S8 — Sensitive data and OAuth material are stored on a shared origin

**Likelihood: Low | Impact: High | OWASP A04 Cryptographic Failures**

The Drive access token is stored in `sessionStorage`. Sync records containing the complete `baseTrip`, resource keys, and permission information are stored in `localStorage`. GitHub Pages projects under the same account normally share an origin, so another compromised project on that origin could potentially access Waypoint’s browser storage. IndexedDB is subject to the same origin boundary.

Evidence:

- `src/googleDrive.ts:49-51` restores the access token from `sessionStorage`.
- `src/googleDrive.ts:102` writes the token to `sessionStorage`.
- `src/googleDrive.ts:121-125` serializes complete sync records to `localStorage`.
- `src/googleDrive.ts:215` includes the full trip as `baseTrip` in the sync record.

Recommendations:

1. Deploy Waypoint on a dedicated origin rather than a shared GitHub Pages origin.
2. Retain OAuth access tokens in memory where practical.
3. Minimize persistent sync metadata and avoid duplicating the complete trip in `localStorage`.
4. Clear sensitive storage on explicit disconnect and provide a “clear this device” control.
5. Use client-side encryption only if the product can manage a user-held key; encryption with a key stored on the same origin does not protect against same-origin script compromise.

The existing Google `drive.file` OAuth scope is appropriately narrow and limits Drive access to files created or opened by the application.

### S9 — Supply-chain configuration can drift

**Likelihood: Low | Impact: High | OWASP A03 Software Supply Chain Failures**

Several direct dependencies use `"latest"` in `package.json`, while GitHub Actions reference mutable version tags instead of immutable commit SHAs. The lockfile currently protects `npm ci`, but future lockfile refreshes have a broad and potentially unreviewed update surface.

Evidence:

- `package.json:12`, `package.json:15-17`, and several development dependencies use `"latest"`.
- `.github/workflows/deploy-pages.yml:24-35` references Actions using version tags.

Recommendations:

1. Replace `"latest"` with deliberate version ranges or exact versions.
2. Pin GitHub Actions to reviewed full commit SHAs.
3. Enable Dependabot or Renovate with controlled update grouping.
4. Require tests, a production build, advisory audit, and lockfile review for updates.
5. Consider software-bill-of-materials generation and provenance attestation for releases.

Current status: `npm audit` reported no known vulnerabilities in the locked dependency tree on August 5, 2026.

### S10 — Sharing state can become stale

**Likelihood: Medium | Impact: Low | OWASP A02 Security Misconfiguration / A09 Security Logging and Alerting Failures**

Normal synchronization preserves cached permission metadata instead of querying current Drive permissions. If permissions are changed externally, the UI can continue reporting a trip as private until access management is explicitly refreshed.

Evidence:

- `src/App.tsx:109` renders sharing status from the cached sync record.
- `src/googleDrive.ts:288-296` preserves cached permission information during ordinary refreshes.
- `src/googleDrive.ts:257-262` refreshes actual permissions only through the separate access-management flow.

Recommendations:

1. Refresh permissions on connection and periodically while a Drive trip is active.
2. Refresh before displaying “private” or creating another share link.
3. Alert prominently when anonymous reader or writer access is detected.
4. Show the last time permissions were checked.
5. Surface recent Drive modification and permission activity where the provider API permits it.

## OWASP Top 10:2025 coverage

| OWASP category | Assessment result |
|---|---|
| **A01 Broken Access Control** | S1, S2, and S3. No server-side request-forgery surface exists because the application has no server and browser fetch destinations are fixed. |
| **A02 Security Misconfiguration** | S5 and S10. Repository-defined CSP, anti-framing headers, and current permission-state reporting are missing. |
| **A03 Software Supply Chain Failures** | S9. Current audit is clean, but mutable dependency and workflow references should be tightened. |
| **A04 Cryptographic Failures** | S8. Sensitive data and an OAuth token are stored in browser-accessible storage; no custom cryptographic misuse was found. |
| **A05 Injection** | S7. No DOM XSS, SQL injection, command injection, `eval`, or unsafe HTML rendering was found. |
| **A06 Insecure Design** | S2 and S3. Anonymous editing and sensitive public calendar feeds create capability-link risks. |
| **A07 Authentication Failures** | Google OAuth is delegated to Google Identity Services and uses the limited `drive.file` scope. Anonymous capability access is covered under A01/A06. |
| **A08 Software or Data Integrity Failures** | S4. Recurring Drive data is not subjected to the full schema validator. |
| **A09 Security Logging and Alerting Failures** | S10. Sharing-state visibility and alerting are limited. |
| **A10 Mishandling of Exceptional Conditions** | S4 and S6. Invalid or oversized remote content can corrupt state or terminate rendering. |

## Positive controls observed

- React text rendering prevents straightforward stored DOM XSS.
- User-provided booking and email links are normalized to HTTPS before rendering.
- JSON file import limits file size, item count, and individual field lengths.
- Outbound links generally use `rel="noreferrer"`.
- Google OAuth uses the limited `drive.file` scope.
- Google Drive API origins are fixed rather than user-controlled.
- No `eval`, `new Function`, `dangerouslySetInnerHTML`, user-controlled fetch destination, server request handler, or database query surface was found.
- Snapshot payloads use URL fragments, which are not sent to web servers in HTTP requests.
- The generated email-extraction prompt tells the receiving assistant to treat messages and attachments as untrusted data and not execute their instructions or active content.
- Calendar source-email links are excluded from the public subscription path.
- Destructive trip deletion uses confirmation and moves Drive content to trash rather than permanently deleting it.

## Verification performed

The following checks completed successfully on August 5, 2026:

- `npm audit --json`: zero known vulnerabilities across 137 dependencies.
- `npm test`: 22 test files and 226 tests passed.
- `npm run build`: TypeScript compilation and the production Vite build succeeded.
- `git diff --check`: no whitespace errors.
- The worktree was clean before this document was added.

Passing tests and a clean dependency audit do not prove the absence of security defects; they are supporting evidence only.

## Recommended remediation order

### Priority 1 — Access control and integrity

1. Replace anonymous writer links with named collaborators and read-only defaults.
2. Sanitize shared snapshots, live collaboration DTOs, JSON exports, and public calendars.
3. Validate every remote Drive revision with the complete strict schema before merging or storing it.
4. Add an explicit security regression test proving non-owners cannot recover `emailLink` through any UI or serialization path.

### Priority 2 — Injection and resilience

1. Constrain identifiers and close the calendar UID injection path.
2. Add aggregate byte limits, decompression limits, semantic date validation, and time-zone validation.
3. Add a React error boundary and last-known-good recovery workflow.

### Priority 3 — Deployment hardening

1. Move the application to a dedicated origin with configurable security headers.
2. Add CSP, anti-framing, referrer, and permissions policies.
3. Minimize persistent browser storage and avoid storing OAuth tokens beyond operational need.
4. Refresh and display current Drive permissions rather than relying on cached state.

### Priority 4 — Supply-chain governance

1. Replace `"latest"` dependency declarations.
2. Pin GitHub Actions to immutable SHAs.
3. Automate dependency review, advisory scanning, and release provenance.

## Scope and limitations

This review was primarily a static source and dependency assessment. It did not include:

- Runtime penetration testing against the deployed GitHub Pages application.
- Verification of deployed HTTP response headers.
- Review of Google Cloud OAuth consent-screen, client-ID, or authorized-origin configuration.
- Review of Google Workspace organization policies or Drive audit logs.
- Compromise of the user’s Google account, browser, extensions, operating system, or device.
- Social-engineering testing of users who receive snapshot, live-trip, or calendar links.
- Third-party security assessment of Google Identity Services, Google Drive, React, Vite, QRCode, or JsBarcode.

The findings should be revalidated after the access model, serialization boundaries, calendar publisher, or hosting platform changes.
