# Flight status

## Current behavior

Waypoint remains a client-only application and does not retrieve or store live flight-status data.

For a flight with a non-empty `flightNumber`, the itinerary shows **Check flight status**:

- beginning 24 hours before the scheduled departure, interpreted in the flight's `timeZone`, so it appears alongside an eligible check-in action;
- through the scheduled arrival, interpreted in `endTimeZone` when present; or
- until 12 hours after departure when the itinerary has no valid arrival time.

The browser recalculates the window once per minute. The link opens a new tab with a Google Search query in the form `https://www.google.com/search?q=AC+800+flight+status`. Flights without a flight number do not receive the link.

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
