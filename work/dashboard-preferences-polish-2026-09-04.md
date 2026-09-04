# Dashboard preferences, themes, updates, and responsive polish

Implemented locally on September 4, 2026. No production or backend data changes.

## Behavior

- Calendar defaults to **By technician**, with **List** second. The user's explicit choice wins on later visits.
- Preferences use a versioned localStorage key scoped to the authenticated stable user ID. The dashboard remounts when the identity changes. Existing username-scoped location/name/price choices are migrated; shared anonymous defaults are not read or written.
- Saved choices: location, active report section, relative Today/Tomorrow selection, name and price visibility, schedule layout and sorting, technician filter per location, and light/dark theme. A missing technician falls back to All technicians for that report. Changes synchronize between tabs for the same user.
- Searches, selected appointments, open notes, and audit inspection dates stay transient. Appointment names, note content, and search text are not added to local storage. Searches survive a background refresh but clear when switching date/location/privacy scope or reloading the page.
- Blue sidebar dots and an updates shortcut compare the existing server section fingerprints with each user's last-seen fingerprints. The first load establishes a baseline. Later additions, changes, and removals trigger the appropriate dot, including before a section has been signed off. Opening that section clears its local dot; this does not submit a section sign-off or an entry acknowledgement.
- Update tracking is scoped to user, report date, and location. Failed/pending requests do not clear unread changes. Only opaque fingerprints are stored, capped at 14 recent contexts with seven-day retention.
- Report content remains visible during refresh; sign-off controls wait for a fresh snapshot. Context gating and request invalidation prevent a late response from replacing a newly selected or cached location.

## Visual changes

- Light mode uses a complete palette for surfaces, controls, notes, status colors, badges, and sheets. The sidebar switch persists per user; logout restores the default dark login theme.
- Location controls have a 44-pixel minimum height, filled selected state, check mark, border, and hover/focus feedback. Phones show all five locations in a grid.
- Copy and detail actions have equal button sizes and matching centers. Each row anchors actions to the right, independent of badge widths.
- Wide technician cards use one line for booking data. Tables size columns to their content. Short labels and badges stay together; long text wraps within narrow cards and detail panels.
- Sidebar navigation scrolls separately from the logo and user controls. Compact landscape headers expose more appointments. Touch controls get larger targets through the coarse-pointer media query.

## Logo provenance

The logo was found in the header of the [official Elegant Lashes by Katie website](https://elegantlashesbykatie.com/) and copied from its [published WebP asset](https://elegantlashesbykatie.com/_astro/flawless-lashes-logo.2-L6QH-s_Zb5Qxb.webp) to `public/brand/elegant-lashes-by-katie.webp` (284 × 97). It is served locally with the app. Light mode applies a CSS brightness adjustment for legibility. The subtitle beneath it was removed as requested.

## Verification

- `npm run lint`, `npm test` (48 frontend tests), `npm run test:cloudflare-shell` (35 Worker tests), `npm run build`, `npm run cf:dry-run`, and `git diff --check` passed. The build includes the local logo and excludes the synthetic preview.
- 48 frontend tests cover existing behavior plus preference migration, malformed/blocked storage, tab synchronization, user isolation, reload persistence, refresh continuity, notification acknowledgement, context isolation, deletions, and a late-response/cache race.
- Browser screenshots and DOM measurements checked 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, 834 × 1194, 1194 × 834, 1280 × 800, and 1440 × 900 viewports. Both palettes, both schedule layouts, all six sections, mobile navigation, and long appointment details were inspected. No page-level horizontal overflow was found. The iPad list also fit without an internal horizontal scrollbar.
- Row measurements verified matching vertical action centers and identical right edges across different badge widths.
- A queued synthetic content change produced two blue section dots. Opening each section cleared its dot, left reviews at 0 of 6, and an unchanged refresh did not restore the dots.
- The preview reuses its React root through [Vite HMR data](https://vite.dev/guide/api-hmr.html#hot-data). Overlapping updates to two dependencies and restoration of both produced no new browser warnings or errors.
- Viewport checks are browser emulation, not physical iPad/iPhone or Safari testing. Real authenticated API data and production deployment were not exercised.

## Local preview

`npm run preview:fixture` serves `http://127.0.0.1:5178/work/dashboard-preview.html` with synthetic data only. `?viewer=qa` isolates QA choices from the normal preview user. Add `&scenario=updates`, click **Queue sample update**, then **Refresh** to exercise blue dots. This fixture is excluded from the production build.
