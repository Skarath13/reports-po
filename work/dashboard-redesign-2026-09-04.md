# Reports dark dashboard implementation

Completed locally on September 4, 2026.

The pre-redesign workspace is preserved in `4c9c625`. The isolated Vite/Vitest
migration is `6c3072e`. No push, deployment, remote migration, account change,
or live sign-off was performed.

## Changes

- Neutral black surfaces, restrained violet focus/selection, compact overview
  counts, section navigation, and a matching PIN login and governance audit.
- Schedule search, technician filtering, chronological/client/service/technician
  sorting, and an alternate grouped layout. Filters stay in memory and reset
  with the report context. Filtered views do not change sign-off scope.
- Accessible appointment detail sheet with booking labels, client context,
  current notes, and collapsed history. Opening a changed row acknowledges
  that calendar entry but does not submit a section sign-off.
- Separate empty, loading, error, unavailable, changed, seen, and reviewed states.
  Counts remain counts; booking labels are not treated as collected revenue.
- Vite, Tailwind CSS, Vitest, ESLint, six selected shadcn Radix primitives,
  and TanStack Table v8. The app remains JavaScript/React.
- Pinned shadcn source and its MIT notice, plus generated bundled-dependency
  license notices in production assets.

## Preserved contracts

`src/api/client.js`, the report/review/acknowledgement hooks, Worker code and
configuration, and the build metadata script are byte-for-byte unchanged from
the checkpoint. The browser still defaults to `/api/reports`, accepts the
existing public `REACT_APP_API_URL` build override, and emits `build/` for Wrangler.
Only the API override is exposed through the Vite environment definition.

The notes workflow preserves profile versus appointment notes, date-aware
headings, history pagination and coverage states. Name masking remains scoped to
the schedule and extends to its new detail sheet; dedicated notes and exception
cards retain their prior client-name display.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 36 passing tests in 11 suites; baseline was 28 |
| `npm run test:cloudflare-shell` | 35 passing tests |
| `npm run lint` | Pass, including the synthetic preview entry |
| `npm run cf:dry-run` | Pass; production build and Worker bundle succeed |
| `npm audit` | 0 reported vulnerabilities |
| `git diff --check` | Pass |
| Build artifact checks | Metadata and static references valid; API override preserved; fixture excluded; license notices included |

New regression checks cover search/privacy interaction, sorting, filtered group
copying and clipboard errors, section navigation, filter reset on date/location
changes, detail history/focus, acknowledgement versus sign-off, viewer-context
changes, unavailable review counts, and mobile navigation focus.

Browser checks used the actual React components with the development-only
synthetic fixture, whose unstubbed API calls fail closed. Inspected desktop and
phone layouts, long notes/services, collapsed history, filtering, date changes,
disabled tomorrow sign-offs, failed report/duplicate/review requests, empty
reports, audit layout, and repeated sheet open/Escape/focus-return cycles.
Widths 320, 390, 736, and 1024 had no page-level horizontal overflow. The final
mobile navigation check focused the selected heading and reported no warnings
or errors. The actual production build's login was also inspected in the browser.

The development preview reuses its React root through Vite's HMR data and
unmounts it when the entry is removed. This avoids recreating roots when several
component updates reach the preview entry together. See the follow-up preference
and polish notes for the final browser checks.

Main JavaScript is approximately 117.35 kB gzipped, versus 77.12 kB after the
tooling-only migration. The additional weight comes with the table and accessible
dialog foundation. No Core Web Vitals or physical-device benchmark was performed.
Live authenticated data and production release readiness were not tested; the
checkpoint includes previously existing governance work that retains its own
deployment prerequisites.

## Local review

Run `npm run preview:fixture` and open
`http://127.0.0.1:5178/work/dashboard-preview.html`. The preview is labeled synthetic,
uses in-memory sign-offs, and is excluded from the production build. Scenario
switches are documented in the main README.
