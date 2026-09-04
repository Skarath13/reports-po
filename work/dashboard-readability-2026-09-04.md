# Dashboard readability pass — September 4, 2026

The dashboard previously used explicit 8–12px sizes for much of its navigation,
controls, and report data. The root also reduced the browser default to 14px.

## Changes

- Restore the browser's default root size and use rem units throughout the
  dashboard, notes, audit, and login styles.
- Use 16px for primary report data and navigation at the standard browser size,
  14–15px for supporting text, 13px for compact captions, and larger headings.
- Widen the sidebar, technician cards, note cards, search controls, and details
  drawer to accommodate the type. Keep copy/detail buttons aligned.
- Let schedule rows adapt to their section's available width. Narrow iPad
  sections use two-line list rows; phones give long names and services their own
  rows. Wider sections retain the table and compact technician layouts.
- Stack phone overview metrics so labels do not spill into adjacent cards.

## Verification

- `npm run lint`: passed.
- `npm test`: 48 tests passed in 14 files.
- `npm run test:cloudflare-shell`: 35 tests passed.
- Browser screenshots and DOM measurements covered 320×568, 390×844, 844×390,
  768×1024, 1024×768, 834×1194, 1194×834, 1280×800, and 1440×900.
- Checked both themes, both schedule layouts, all six report sections, overview,
  mobile navigation, hidden names, long appointment details, audit, and login.
- Corrected narrow metric-label overflow and long-name crowding found during
  the pass. The corrected layouts had no page overflow or report-card clipping;
  copy/detail action pairs retained matching vertical positions.
- The long synthetic appointment's iPad list row uses 449px for its service
  description and fits within a 120px-tall row at 768px viewport width.
- No browser warnings or errors were recorded in the final check.

Viewport checks use the in-app browser, not physical iOS devices. Synthetic
fixtures do not prove authenticated production report or sign-off behavior.
