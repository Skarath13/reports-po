# Weekly duplicate booking check

Status: deployed to production. Authenticated live browser verification is pending the current Reports PIN.
The Reports checkout started clean at `ff427f7`. Pre-existing changes in the
sibling Check-in checkout were preserved.

## Behavior

[Mobile preview](weekly-duplicates-preview-mobile.png) · [Desktop preview](weekly-duplicates-preview-desktop.png)
Both previews use synthetic appointment data.

- Today/Tomorrow keeps the existing daily duplicate check and review/sign-off.
- Next 7 days includes the selected Pacific calendar day and six following days.
- Matches span all five locations but must involve the selected location.
- Each matching booking shows date, time, service, technician and location.
- The weekly check groups normalized phones, with a customer identity fallback
  when a phone is missing. A warning explains that cross-record matches may be
  missed without a phone.
- Cancelled/no-show/declined and manager-cancelled bookings are excluded.
- Single-flight fetches and a five-minute successful-result cache are shared
  per active origin process. Polling runs only while the weekly panel is visible.
- Partial upstream failure produces unavailable status. The UI preserves an
  earlier result during refresh failure and explicitly labels it out of date.
- Weekly results do not overwrite daily governance snapshots or attestations.

## Verification

- `npm run lint`: passed.
- `npm test`: 96 frontend tests passed, including six weekly UI/race/failure tests.
- `npm run test:cloudflare-shell`: 35 Worker tests passed.
- `npm run build`: passed.
- `CI=true npm run cf:dry-run`: passed; no upload or release.
- `node --test server/tests/weeklyDuplicateBookingsService.test.js server/tests/weeklyDuplicateBookingsRoute.test.js server/tests/bloomWeeklyPagination.test.js`: 10 tests passed.
- Existing Bloom source, hybrid lookup, manager cancellation, and Reports route
  checks passed.
- Chromium local synthetic UI: Old and New at 1440, 390 and 320px; no horizontal
  overflow or page exceptions. Range switching returns to daily review controls.
- Read-only integrated production-data sample for October 1–7: 480 active
  bookings, six matching clients, zero missing phones. The local implementation
  used 11 Square API requests and took 15,861ms cold. Cached repeat took under
  1ms and made no extra Square requests. No bookings, cancellation records,
  review records or production caches were written. This verifies reads from
  live sources, not a deployed release.
- Initial Square-only sample used 19 requests; reusing existing service/staff
  labels reduced the integrated sample to 11. Booking membership, timing and
  phone matching still use current Square responses.

The Square API supports paginated date-range booking queries and customer
lookup in batches of up to 100. Sources: [List bookings](https://developer.squareup.com/reference/square/bookings-api/ListBookings),
[Retrieve customer profiles](https://developer.squareup.com/docs/customers-api/use-the-api/retrieve-profiles).

## Release scope and order

1. Release the Check-in Express origin changes:
   `server/routes/reports.js`, `server/services/weeklyDuplicateBookingsService.js`,
   and the opt-in pagination addition in `server/services/bloomAppointmentSourceService.js`.
   Verify the authenticated weekly endpoint with complete Square/Bloom coverage.
2. Release the Reports frontend and verify the range control and result display
   on the public app with the deployed revision identity.

No database migration, new scheduled job, new dependency, or new environment
variable is required. The source uses the existing Square, Supabase, and Bloom
credentials. The read-only local check loaded Bloom settings into the process
from the sibling Bloom checkout; it did not edit any credential file.

Do not include the unrelated Check-in SMS, waiver, Telnyx or other pending work
in this release. The origin and Reports shell require separate releases.

## Production deployment evidence

- Backend commit `f8188777`, based on the previously live `1be5023c`, contains
  only the three scoped source files and three focused test files. It was built
  in an isolated clean checkout; unrelated local Check-in work was preserved.
- Guarded origin release `checkin-f8188777-20261001221026` passed candidate
  health/readiness, local and public cutover health/readiness, edge-origin
  health, and the exact-release operational-worker check. Rollback retains
  `checkin-1be5023c-20261001103618`.
- A read-only invocation of the deployed service for October 1–7 returned
  486 active bookings, six duplicate clients, zero missing phones and zero
  unavailable service labels. Cold fetch: 11 Square requests, 13,248ms.
  Same-process cached repeat: 2ms, identical cached object. This probe ran
  separately from the active backend process and did not warm its cache.
- The public weekly endpoint rejects unauthenticated reads with HTTP 401.
- Reports feature commit `9ff9546` deployed through linked Workers Build
  `30848dfe-0e76-49f5-93be-612412518a58`; GitHub reports success. Public
  metadata and HTML identify `9ff9546-20261001221306`. Served JS and CSS
  match the locally rebuilt committed source byte for byte:
  `index-DwMYOXnN.js` and `index-De9eH0g_.css`.
- Check-in linked shell build `925fc5a7-47e2-483e-8629-303af57711a4` also
  succeeded and publicly identifies `f8188777`.
- No authenticated Reports session was available. Normal sign-in and the
  actual live weekly UI remain unverified until the current Reports PIN is
  supplied. Local synthetic UI verification and deployed service checks do
  not substitute for that final signed-in check.
