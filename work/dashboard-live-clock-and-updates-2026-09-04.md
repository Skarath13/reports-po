# Pacific clock and item updates — September 4, 2026

The header previously displayed a static “Pacific time” label, hidden on smaller
screens. The new isolated clock renders hours, minutes and seconds using
America/Los_Angeles, including daylight-saving changes. It updates from the actual
browser clock every second and catches up on tab visibility changes. No requests
or artificial loading delays are added. Tabular numerals prevent layout jitter;
the clock remains visible on narrow screens and is not an ARIA live region.

The sidebar previously tracked a whole-section fingerprint and cleared it on
navigation, independently of the item review cues. Both now use the same unread
entry state. Updated items have a blue tint, accent line and visible New label.
A section notice counts outstanding updates and can scroll to the next one.
Filtered updates remain unread, with a clear-filter hint when a jump cannot find
a rendered item. Removed items have a separate dismissible notice.

Viewing and review semantics:
- Downloading a snapshot records what exists, never that its items were viewed.
- An unchanged item receives a browsing baseline only after it is fully inside
  the viewport for 900 ms in a visible tab. Hidden sections, clipped items and
  covered content do not receive that automatic baseline.
- Changed items retain their highlight until deliberate pointer movement plus
  a 550 ms hover, keyboard focus dwell, click or tap. Scrolling cancels hover;
  merely scrolling an item under a resting cursor cannot acknowledge it.
- Existing server sign-offs and version-specific acknowledgements remain
  authoritative after review. A failed optimistic save restores the highlight.
  Viewing an item never submits a section sign-off.
- Before sign-off, and for tomorrow's read-only report, per-item browsing state
  is local to the viewer, date and location. The v2 local store contains only
  opaque server keys, versions and flags, retains up to 14 contexts for seven
  days, and tolerates unavailable storage. Preferences are unchanged. The old
  section-only v1 notifications are not promoted to item-level viewing evidence.
- Visibility is a browser observation, not proof that someone read every word.
  Long cards require explicit interaction if they cannot fit fully in view.
  The existing backend API, audit contracts, database schema and permissions are
  unchanged by this UI patch.

Verification:
- 67 frontend tests and 35 Worker tests passed; lint and production build passed.
- Tests cover Pacific midnight/DST, clock cleanup, viewport and hidden-tab gates,
  stationary-cursor scrolling, version changes, per-viewer/date/location isolation,
  refresh/reload persistence, filtering, removals, and saved-review acknowledgements.
- Browser checks covered 1440x900, 1024x768, 768x1024, 844x390, 390x844 and 320x568,
  dark/light themes and both schedule layouts. No horizontal page overflow.
- Synthetic UI verification confirmed that jumping to an update preserves all
  three highlights, and clicking one leaves the two offscreen items unread.
- Browser warning/error logs were empty. These are emulated viewport checks;
  no physical iOS device or authenticated production report session was used.

Earlier releases verified during this deployment:
- Reports access/loading/risk changes: 6bd6cbf, Worker version
  b41228bf-6fd3-4a18-a21c-0ec84c67c1ab. Live assets matched the build by SHA-256.
- Check-in origin performance patch: 157f41c8, release
  checkin-157f41c8-20260904230739. Guarded candidate checks, exact release identity,
  readiness, public health, the single worker, and direct-port-8001 ingress passed.
- The linked checkin-main Workers Build succeeded for 157f41c8. Live metadata,
  shell/assets, kiosk policy JSON/SSE, service worker and health checks passed.
- The backend latency improvement has not been measured on an authenticated
  production report. No live check-in, SMS, or credential changes were used in QA.
