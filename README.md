# Elegant Lashes Reports

Standalone reports dashboard and Cloudflare Worker for `reports.elegantlashesbykatie.com`.

The Express `/api/reports` backend remains in the checkin repo/VPS. This project only owns the reports React app, the `checkin-reports` Worker shell, and shared Cloudflare gateway code.

## Commands

```bash
npm ci
npm start
npm test
npm run lint
npm run build
npm run test:cloudflare-shell
npm run cf:dry-run
npm run cf:deploy
```

The React client uses Vite, Tailwind CSS, and Vitest. Use Node 22.12+ (or Node 24+).
`npm run test:watch` starts the interactive test runner. Source files with JSX use
the `.jsx` extension; this is still a JavaScript app, with no separate typecheck.

Vite preserves the Worker's `build/` asset directory and the existing build metadata
script. The API defaults to `/api/reports`; the optional public `REACT_APP_API_URL`
build variable is preserved. Only that variable is exposed to the browser.

## Dashboard UI

The PIN screen and signed-in header offer **Old / New** interface buttons. Old
is the default for accounts without a saved interface choice. It restores the
blue-and-white, single-page report layout from `4c9c625`; the calendar starts
collapsed behind **Show schedule** so notes and exceptions are easy to reach.
Both interfaces share the current report fetching, sign-offs, counters, change
highlights, copy actions, appointment details, and current client/appointment notes.
Past appointment history appears only in New, in both report cards and appointment
details. Switching to Old hides history without clearing New's expanded history.

The interface is saved with the existing user-scoped browser preferences. An
explicit PIN-screen choice overrides that user's saved interface for this sign-in
and future visits; leaving it unselected restores their saved choice. Each login
starts with no explicit override, including after logout or session expiry.
Switching preserves New's filters, draft search, layout, section, and theme; Old
shows the complete technician groups in the original light presentation. The
choice is local to this browser and does not change authentication or permissions.

The neutral black theme lives in `src/index.css`. The shared shell, schedule,
appointment detail sheet, and notes use the existing report and review hooks.
Search and technician filters stay in memory, reset on location/date/privacy
changes, and do not alter report totals or the section snapshot being signed off.
The name preference applies to the schedule and its detail panel; the dedicated
notes and exception sections retain their existing client-name display.

In New's List layout, **Copy schedule** copies every appointment matching the
current search and technician filter, in the displayed sort order. It honors
Hide Names and Hide Prices. Technician headers retain their copy buttons in
both interfaces; row copy buttons continue to copy one appointment.

Duplicate bookings offers the selected day and **Next 7 days** in both
interfaces. The range includes the selected Pacific calendar date plus six
days. Matches include every location but must involve the selected location.
Daily review/sign-off stays scoped to the day view; the weekly check is
supplemental. Its separate authenticated backend route,
`/api/reports/all-locations-week/:date`, shares successful results for five
minutes per origin process and combines current Square bookings with Bloom
appointments and manager cancellation records. It never writes bookings or
changes the scheduled appointment caches. Deploy its Check-in origin code
before releasing the Reports frontend.

Selected shadcn Radix components live in `src/components/ui`; their pinned source
and MIT notice are in `licenses/`. TanStack Table v8 handles local sorting.

For local visual review without backend access:

```bash
npm run preview:fixture
# Open http://127.0.0.1:5178/work/dashboard-preview.html
```

That development-only entry uses synthetic data and disables unstubbed API
requests. It is excluded from the production build. Add `?scenario=empty`,
`error`, `duplicates-error`, `weekly-error`, `weekly-empty`, `review-error`, `loading`, `login`, or `audit` to
exercise the corresponding state. Fixture sign-offs live only in page memory.

## Cloudflare

Production Workers Builds trigger:

- Repository: `Skarath13/reports-po`
- Branch: `main`
- Root directory: `/`
- Build command: `echo "Cloudflare auto-install complete; Wrangler deploy runs npm run build"`
- Deploy command: `npx wrangler deploy --config cloudflare/reports/wrangler.jsonc`

Cloudflare auto-installs dependencies before the configured build command. The no-op build command prevents a duplicate `npm ci`; the deploy command still runs the `cloudflare/reports/wrangler.jsonc` custom build once through Wrangler.

Manual production deploy command:

```bash
npx wrangler deploy --config cloudflare/reports/wrangler.jsonc
```

Reports governance, including login/view audit events, whole-report sign-offs,
section reviews, acknowledgements and fingerprinting, runs in the Check-in
Express API on the VPS. The Worker forwards `/api/reports/*` to the protected
origin once; it does not query D1 or hold the governance fingerprint secret.

The active implementation is `server/services/reportsGovernanceService.js` and
`server/services/reportsGovernance/` in the Check-in repository. Its PostgreSQL
schema and operational release procedures belong to that repository. Do not
apply the retired Reports D1 migrations or re-enable an edge governance writer.
The retired transfer endpoint remains explicitly closed with HTTP 404.

The zone also has Cloudflare ruleset `2aaff556277146199a96b1cba9ecf16f` for `POST /api/reports/auth/login`, scoped to `reports.elegantlashesbykatie.com`, at 5 attempts per client IP per 10 seconds. The zone’s current plan only permits a 10-second period and 10-second mitigation timeout; the origin’s existing login throttling remains in place for longer-window protection.

Worker secrets should only be:

- `ORIGIN_ACCESS_CLIENT_ID`
- `ORIGIN_ACCESS_CLIENT_SECRET`

The governance fingerprint secret stays server-side in the VPS API. Rotating
it invalidates existing review fingerprints; it is not a browser build variable
or a Reports Worker deployment prerequisite.

Do not add Supabase service-role, Square, Twilio, Brevo, Bloom, deploy-health, or VPS secrets to this browser app or Worker.

## Dependency Audit

Runtime dependency audit:

```bash
npm audit --omit=dev
```

The Create React App toolchain has been replaced by Vite. Run the audit against
the current lockfile; do not apply forced dependency upgrades without checking
peer compatibility and rerunning the frontend and Worker suites.
