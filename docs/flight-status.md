# Flight status

## Current behavior

Waypoint remains a client-only application and does not retrieve or store live flight-status data.

For an itinerary item to receive **Check flight status**, it must:

- have `type: "flight"`;
- have a non-empty `flightNumber` after surrounding whitespace is removed; and
- be inside the flight-status time window.

The flight-status time window is:

- beginning 12 hours before the scheduled departure, interpreted in the flight's `timeZone`;
- through the scheduled arrival, interpreted in `endTimeZone` when present; or
- until 12 hours after departure when the itinerary has no valid arrival time.

The browser evaluates the window immediately when the app loads and recalculates it once per minute. The link opens Google Search in a new tab with the query `<flightNumber> flight status`. For example:

- `AC800` produces `https://www.google.com/search?q=AC800+flight+status`;
- `AC 800` produces `https://www.google.com/search?q=AC+800+flight+status`.

The separate airline **Check in** action is intentionally independent. It uses the flight number's two-character IATA prefix to select an official check-in page from `src/airlineCheckIn.ts`, with the provider name as a fallback for older items without a flight number. The registry maps 141 of the 145 reviewed airline brands; XiamenAir (`MF`), Sichuan Airlines (`3U`), Spring Airlines (`9C`), and Lion Air (`JT`) are documented in `AIRLINE_CHECK_IN_OMISSIONS` and deliberately excluded because no usable official web check-in URL could be verified. The action appears only for mapped airlines from 24 hours before departure until departure. Therefore, during the final 12 hours before a mapped flight, both actions appear together; from 24 to 12 hours before departure, only check-in appears.

## Verified AC800 case

The regression test and rendered-browser verification use this exact itinerary:

- flight number: `AC800` (also verified when stored as `AC 800`);
- departure: August 4, 2026 at 8:50 p.m. in `America/Toronto`;
- arrival: August 5, 2026 at 8:25 a.m. in `Europe/Dublin`;
- resolved departure: August 5 at 00:50 UTC;
- resolved arrival: August 5 at 07:25 UTC; and
- verification time: August 5 at 00:06 UTC, 44 minutes before departure.

At that verification time, Waypoint renders both **Check flight status** and the airline-specific **Check in with …** action. The status action remains available through the scheduled arrival.

## Deployment freshness

An already-open browser tab continues running the JavaScript bundle it originally loaded, even after a new GitHub Pages deployment. Waypoint therefore checks the deployed entry bundle once per minute and whenever the tab becomes visible, then shows a **Reload** prompt when a newer version is available. A tab opened before this update-check behavior was deployed still needs one manual refresh.

The update check is entirely client-side: it fetches the deployed HTML without using the browser cache, compares its hashed entry-script URL with the entry script currently running, and does not reload automatically. Requiring the user to choose **Reload** avoids interrupting an in-progress itinerary edit.

## Google limitations

Google Search cannot provide an embedded status dialog in this architecture. Its search page blocks cross-origin `fetch` parsing and cross-origin framing, so Waypoint does not iframe, proxy, scrape, or poll it. The external link is the fallback that works without credentials or server-side behavior.

## Possible AirLabs integration

[AirLabs Flight Information API](https://airlabs.co/docs/flight) is a possible future client-side integration. It has a limited free tier, returns structured flight status, estimated times, delays, terminals, gates, and related details, and currently permits browser-origin API requests. This option is documented but is not implemented.

Because Waypoint has no server, it cannot keep an API key secret. A safe client-only design would therefore:

- require each user to supply their own AirLabs API key;
- store the key only in that browser's settings, separate from itinerary data;
- never include the key in trip JSON, Google Drive files, calendar exports, snapshot links, or live sharing;
- request status only when the user opens a flight-status dialog;
- offer a manual refresh action instead of background polling; and
- retain the Google status link when the API is unavailable, unconfigured, or out of quota.

An AirLabs request could use the stored IATA flight number and limit the response to the fields needed by the dialog:

```text
https://airlabs.co/api/v9/flight
  ?flight_iata=AC800
  &_fields=status,dep_estimated,arr_estimated,dep_delayed,arr_delayed,dep_terminal,dep_gate,arr_terminal,arr_gate,updated
  &api_key=USER_KEY
```

The key remains visible to the person using the browser and must not be treated as confidential. Provider coverage, free-tier limits, and licensing should be rechecked before implementation.
