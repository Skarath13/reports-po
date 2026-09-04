# Black dashboard design research for Elegant Lashes Reports

Researched September 4, 2026. Scope: the current local Reports app, public repositories, component libraries, practical reuse, and dark dashboard design. This is a design and integration recommendation; no application implementation or deployment was performed.

**Recommendation:** use official shadcn/ui primitives, Studio Admin's neutral black visual direction, and selected tablecn table patterns. Keep the Reports data fetching, appointment logic, and review controls underneath that presentation. Start with one coherent component family and one table-library version. Use Tremor selectively for small, truthful summaries.

The largest improvement would come from better hierarchy: a compact location/date header, a schedule that is easy to scan, visible exceptions, and one consistent appointment-detail surface. Black backgrounds should support that hierarchy.

## What the existing app actually needs

The local checkout uses React 19.2.3, Create React App/react-scripts 5.0.1, JavaScript, Lucide, and custom CSS. There is no installed Tailwind/shadcn setup or `components.json`. The main styling uses light surfaces, blue gradients, colored location tabs, and repeated gradient cards. These are local source findings, not claims about the currently deployed revision. [Package configuration](/Users/dylan/Desktop/reports/package.json), [dashboard styles](/Users/dylan/Desktop/reports/src/components/Dashboard.css), [card styles](/Users/dylan/Desktop/reports/src/components/ReportCard/ReportCard.css).

The six existing review sections are schedules, client/appointment notes, potential fixes, duplicate clients, anyone-available bookings, and staff without a first-hour appointment. The working tree also contains substantial existing governance changes. A future redesign must be based on that inspected state and preserve those changes. [Section definitions](/Users/dylan/Desktop/reports/src/constants/reportSections.js), [dashboard](/Users/dylan/Desktop/reports/src/components/Dashboard.js).

| Existing data or behavior | Recommended presentation | Contract to preserve |
| --- | --- | --- |
| `byTechnician`, `technicians`, `totalAppointments` | Compact schedule grouped by technician, with an optional sortable list | Pacific time, chronological order, current location/date, copy actions |
| Appointment time, service, technician, days since last appointment, price badges | Stable row columns with tabular numerals; less prominent secondary details | Missing values stay unknown; preserve upstream price labels |
| `customerProfileNote`, `customerNote`, `sellerNote`, appointment history | Current notes immediately visible; historical entries collapsed; detail sheet for longer content | Keep profile and appointment notes distinct; retain history pagination and coverage warnings |
| Potential fixes and duplicate groups | Separate exception lists with explicit reasons | A flag is something to investigate; duplicate groups are not appointment totals |
| Anyone-available bookings and first-hour gaps | Compact actionable lists near the schedule | A first-hour gap does not establish availability or utilization |
| Section snapshots, reviews, acknowledgements | Small status indicators beside each section; audit history as a detail view | Seen, signed off, and changed since review remain different states |
| `generatedAt`, local refresh time, loading/error state | Clear freshness text and contextual loading/error treatment | Cached, loading, unavailable, and zero are different states |

The current data path is `App/useAuth → Dashboard → useFullReport/useAllLocationAppointments → api/client → same-origin /api/reports → Cloudflare Worker → existing checkin backend`. Section governance also uses the Worker's dedicated D1 path. The current report hook refreshes every two minutes and uses a viewer/location/date cache. [App](/Users/dylan/Desktop/reports/src/App.js), [hooks](/Users/dylan/Desktop/reports/src/hooks/useReports.js), [API client](/Users/dylan/Desktop/reports/src/api/client.js), [README](/Users/dylan/Desktop/reports/README.md).

## Ranked sources to use

Rankings describe fit for this app, based on source inspection and the public interfaces reviewed. They are not benchmark scores.

| Source | Best use in Reports | Reuse assessment | License checked |
| --- | --- | --- | --- |
| **1. [Official shadcn/ui](https://ui.shadcn.com/blocks)** · [repository](https://github.com/shadcn-ui/ui) | Foundation: sidebar, header, buttons, tabs, table, sheet, collapsible, badges, skeletons | Best starting point. Generate selected components after the styling/build setup exists. Use `dashboard-01` and `sidebar-07` as composition references. | [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) |
| **2. [Studio Admin](https://next-shadcn-admin-dashboard.vercel.app/dashboard/default)** · [repository](https://github.com/arhamkhnz/next-shadcn-admin-dashboard) | Best visual reference: neutral black surfaces, quiet separators, typography, compact controls | Borrow theme/layout decisions and small presentational components. Its complete app brings Next.js and unrelated screens. | [MIT](https://github.com/arhamkhnz/next-shadcn-admin-dashboard/blob/main/LICENSE) |
| **3. [Shadcn Admin by Sat Naing](https://shadcn-admin.netlify.app/)** · [repository](https://github.com/satnaing/shadcn-admin) | React app layout, navigation, responsive shell, tasks table | Useful source donor, but still requires adaptation: Vite, TypeScript, TanStack Router, and some Clerk integration. Its demo's default dark palette is blue-black; use our neutral palette. | [MIT](https://github.com/satnaing/shadcn-admin/blob/main/LICENSE) |
| **4. [tablecn](https://tablecn.com/)** · [repository](https://github.com/sadmann7/tablecn) | Appointment-table toolbar, column visibility, filter chips, sorting | Preferred table-pattern reference. Extract the parts needed by existing in-memory report data. The complete demo includes server/database and advanced grid features. | [MIT](https://github.com/sadmann7/tablecn/blob/main/LICENSE.md) |
| **5. [OpenStatus data-table-filters](https://data-table.openstatus.dev/)** · [repository](https://github.com/openstatusHQ/data-table-filters) | More sophisticated filters, row details, mobile filter drawers | Strong alternative if richer filtering becomes necessary. Its registry offers separate core, filter, cell, and sheet blocks. Use a single table implementation. | [MIT](https://github.com/openstatusHQ/data-table-filters/blob/main/LICENSE) |
| **6. [Tremor](https://www.tremor.so/)** · [repository](https://github.com/tremorlabs/tremor) | Bar lists and restrained summaries, such as appointment counts by technician | Selective component donor. `BarList` can work without a chart engine. The source snapshot uses React 18/Recharts 2, so compatibility must be checked before copying into React 19. | [Apache-2.0](https://github.com/tremorlabs/tremor/blob/main/LICENSE) |
| **7. [coss UI, formerly Origin UI](https://coss.com/ui)** · [repository](https://github.com/cosscom/coss) | Polished compact fields, toolbars, sheets, and disclosure components | A credible alternative primitive family based on Base UI. Choose deliberately rather than mixing it casually into a Radix-based system. | [MIT for `apps/ui` and `apps/origin`; AGPL elsewhere](https://github.com/cosscom/coss/blob/main/LICENSING.md) |
| **8. [tweakcn](https://tweakcn.com/)** · [repository](https://github.com/jnsahaj/tweakcn) | Tune the neutral dark theme, radius, typography, and contrast | Use as a design tool; export the chosen tokens. The editor itself does not need to become an app dependency. | [Apache-2.0 for editor source](https://github.com/jnsahaj/tweakcn/blob/main/LICENSE) |

Also reviewed: [Kiranism's dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter), which has an [MIT license](https://github.com/Kiranism/next-shadcn-dashboard-starter/blob/main/LICENSE), and [Tremor Insights](https://github.com/tremorlabs/template-insights), also [MIT](https://github.com/tremorlabs/template-insights/blob/main/LICENSE.md). They are useful references, but their whole-app scope is less closely matched to this existing operations app.

Public dark views inspected directly: Studio Admin's default dashboard, Shadcn Admin's dashboard/tasks, and tablecn's data table. OpenStatus's public landing/docs navigation was inspected as well. Other recommendations rely on official docs and source; their full visual or accessibility behavior was not tested.

## Concrete source files worth borrowing

These paths were verified in the upstream trees, and the listed files' imports were inspected. Links follow the current `main` branch; pin an actual commit and retain its license when importing code.

| Piece | Exact source | Adaptation required |
| --- | --- | --- |
| Official dashboard header | [shadcn `site-header.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/radix/blocks/dashboard-01/components/site-header.tsx) | Replace the heading/actions with location, report date, refresh, privacy, and authorized audit controls |
| Official dashboard shell | [shadcn `app-sidebar.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/radix/blocks/dashboard-01/components/app-sidebar.tsx) | Prefer CLI generation: the raw registry source includes generator-specific aliases and icon placeholders |
| Small metric cards | [Studio Admin `metric-cards.tsx`](https://github.com/arhamkhnz/next-shadcn-admin-dashboard/blob/main/src/app/%28main%29/dashboard/default/_components/metric-cards.tsx) | Imports only Lucide and shared card/badge components; replace fixture metrics and reduce vertical space |
| React sidebar composition | [Shadcn Admin `app-sidebar.tsx`](https://github.com/satnaing/shadcn-admin/blob/main/src/components/layout/app-sidebar.tsx) | Replace its layout provider, navigation data, user UI, and team switcher with Reports equivalents |
| Tasks/list composition | [Shadcn Admin `tasks-table.tsx`](https://github.com/satnaing/shadcn-admin/blob/main/src/features/tasks/components/tasks-table.tsx) | Contains router and URL-state hooks plus task schemas/actions; these are app-specific |
| Table controls | [tablecn `data-table-toolbar.tsx`](https://github.com/sadmann7/tablecn/blob/main/src/components/data-table/data-table-toolbar.tsx) | Bring only needed filter helpers and compatible table primitives; omit task-editing and bulk-mutation features |
| Table state example | [tablecn `use-data-table.ts`](https://github.com/sadmann7/tablecn/blob/main/src/hooks/use-data-table.ts) | Depends on `nuqs`, parsers, and helper types. Its URL-state behavior is not automatically appropriate for client searches |
| Rich row detail | [OpenStatus `data-table-sheet-content.tsx`](https://github.com/openstatusHQ/data-table-filters/blob/main/packages/registry/src/components/data-table/data-table-sheet/data-table-sheet-content.tsx) | Requires its schema/cell system. Borrow the interaction or install the complete compatible block rather than copying one orphaned file |
| Technician appointment counts | [Tremor `BarList.tsx`](https://github.com/tremorlabs/tremor/blob/main/src/components/BarList/BarList.tsx) | Small React component plus two utility imports; verify Tailwind classes, labels, and current React compatibility |
| Alternate sheet primitive | [coss `sheet.tsx`](https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/sheet.tsx) | Needs Base UI, utilities, button, and scroll-area components within the verified license boundary |

“Copy and paste” is feasible at the component level, after matching dependencies and aliases. Entire dashboard folders are not drop-in replacements for this repository.

## Proposed black design system

These are proposed design values, not tokens copied from an upstream project:

| Token or rule | Proposal |
| --- | --- |
| Canvas | `#09090B` |
| Sidebar | `#101012` |
| Cards / detail panels | `#151518` |
| Hover / selected rows | `#202024` |
| Decorative dividers | `#2A2A30`; essential control outlines need stronger contrast |
| Main text | `#F4F4F5` |
| Secondary text | `#A1A1AA` |
| Accent | Restrained violet `#A78BFA`, mostly for selection and focus |
| Status | Amber for attention, green for a current review, red for failure; always include a label/icon |
| Geometry | Consistent 8–10px corners, subtle separators, minimal shadow |
| Typography | Existing system font first; strong time/name hierarchy and tabular numeric columns |
| Density | About 44–48px desktop table rows; comfortable touch targets on mobile |

Recommended page organization:

1. A short global header keeps location, date, freshness, refresh, and privacy controls together.
2. Navigation exposes the existing six review sections, with clear counts where the units are meaningful.
3. A small overview summarizes appointments and review progress using existing data. Avoid making four oversized cards the dominant content.
4. The schedule remains the main work area. Keep grouping by technician; add a compact list view only if it helps cross-technician scanning.
5. Potential fixes, duplicate groups, anyone-available bookings, and first-hour gaps keep their own lists and review states. A combined overview may link to them without merging their sign-offs.
6. Current notes remain prominent within the notes workflow. Historical notes are collapsed by default. A shared detail sheet can show notes, history, source price labels, and review context without losing the selected row.

## Data rules the redesign should respect

- Do not label summed appointment price badges as collected revenue. The inspected UI consumes price labels; payment completion, refunds, and financial totals are not established by those fields.
- Do not add weekly revenue trends, conversion rates, utilization, or growth percentages just because a template has them. They need defined historical inputs and denominators.
- Counts of appointments, appointments with notes, potential-fix entries, duplicate groups, and review status can be derived from the current response paths. Label each count precisely; these groups can overlap.
- The risk display currently uses heuristic components such as recency and day-of-week adjustments. A redesign should expose its explanation and avoid making a decorative gauge imply validated predictive accuracy. Any change to scoring semantics is a separate task.
- Keep names, phones, and note text out of URL filter parameters and third-party logging. Prefer in-memory filters for sensitive client searches. Retain existing privacy behavior, and evaluate consistent masking across new surfaces.
- A row selection, preview, or expansion must preserve the intended acknowledgement behavior. It must never silently replace the server-validated section sign-off flow.
- Retain loading, empty, error, unavailable-history, stale-snapshot, and changed-since-review states. A visually polished empty panel must not conceal a failed data request.

## Integration decision and minimal sequence

**Fast visual refresh:** use the proposed shared dark tokens with the existing React/CSS components. This has the smallest dependency footprint, but copying Tailwind-based source still requires adaptation.

**Recommended foundation for sustained shadcn reuse:** migrate the build tooling in an isolated change, then add Tailwind and a selected shadcn primitive family. Vite is a good fit for the existing client-rendered app. A Next.js migration is not needed to achieve this design. React has deprecated Create React App; shadcn documents both Vite and manual installation. [React announcement](https://react.dev/blog/2025/02/14/sunsetting-create-react-app), [Vite installation](https://ui.shadcn.com/docs/installation/vite), [manual installation](https://ui.shadcn.com/docs/installation/manual).

JavaScript can remain JavaScript: shadcn documents `tsx: false` for JSX output. The existing app also does not need React Server Components. [shadcn configuration](https://ui.shadcn.com/docs/components-json).

The build migration touches real contracts: `REACT_APP_API_URL` in the API client, the `build/` asset directory in Wrangler, `scripts/write-build-metadata.js`, the Jest/testing-library setup, and deployment commands. Preserve or deliberately adapt each one. It should not be hidden inside a styling commit.

Proposed implementation sequence:

1. Preserve the existing dirty worktree and establish a verified baseline in the intended development checkout.
2. Make any approved build/Tailwind setup change independently; keep the current routes, auth, API, assets, and metadata behavior working.
3. Add shared tokens and a small set of shadcn primitives. Start with the shell, header, buttons, tabs, badges, table, sheet, collapsible, skeleton, and accessible menu controls.
4. Restyle one schedule and one notes/detail path using current fixtures. Validate long names, long services, prices, privacy, history loading, and mobile layout before propagating the pattern.
5. Apply the same language to the remaining sections, including all review states. Keep transformations and business rules outside borrowed UI components.
6. Add only the summary visualizations supported by available data. Defer historical analytics until the backend contract is defined.

**Compatibility finding:** at the source snapshots inspected, Shadcn Admin and tablecn use TanStack Table v8; Studio Admin and OpenStatus's registry declare v9. Tremor's repository uses React 18 and Recharts 2. Pick compatible component versions and test them together before importing. These manifests are not a tested compatibility matrix. [Shadcn Admin manifest](https://github.com/satnaing/shadcn-admin/blob/main/package.json), [tablecn manifest](https://github.com/sadmann7/tablecn/blob/main/package.json), [Studio Admin manifest](https://github.com/arhamkhnz/next-shadcn-admin-dashboard/blob/main/package.json), [OpenStatus registry manifest](https://github.com/openstatusHQ/data-table-filters/blob/main/packages/registry/package.json), [Tremor manifest](https://github.com/tremorlabs/tremor/blob/main/package.json).

## Reuse boundaries and verification

The MIT sources above permit code reuse subject to retaining their notices and license conditions. Apache-2.0 sources also require the applicable license/notices and marking modified files. Check the selected files and their dependency licenses when importing; source-code licenses do not automatically cover separate logos, photographs, or paid assets. [MIT text](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md), [Apache-2.0 text](https://github.com/tremorlabs/tremor/blob/main/LICENSE).

coss's root license badge alone is misleading for this decision: its licensing file specifically separates the MIT `apps/ui` and `apps/origin` trees from the default AGPL license. Trace any imports beyond those directories before reusing them. [Directory licensing](https://github.com/cosscom/coss/blob/main/LICENSING.md).

Tremor's open components and premium blocks are separate offerings. Shadcnblocks.com has its own commercial license, including restrictions on publishing its components in public repositories; it should not be grouped with the MIT sources above. [Tremor offerings](https://www.tremor.so/), [Shadcnblocks license](https://www.shadcnblocks.com/license).

Research verification: checked repository metadata, actual license files, selected source paths/imports, and package manifests; visually inspected the public demos identified above. Upstream sources were not installed or built, and no security/performance certification is implied. GitHub push timestamps were considered only as activity signals: Tremor's component repo last reported a push in October 2025, so its copied components deserve a current compatibility check rather than an assumption of ongoing upgrades. [Tremor repository metadata](https://api.github.com/repos/tremorlabs/tremor).

For a future implementation, the current repo's exact checks are:

```sh
CI=true npm test -- --watchAll=false
npm run test:cloudflare-shell
CI=true npm run build
npm run cf:dry-run
```

There is currently no separate lint or typecheck script. The CRA build provides its existing ESLint/build checks; any tooling migration must define equivalent checks. Browser verification should cover 320px, 390px, tablet, and desktop; keyboard navigation and sheet focus return; accurate clipboard behavior; long note wrapping; rapid date/location changes; review acknowledgement versus sign-off; denied audit access; and API/loading failures. New behavioral changes need meaningful tests. Production deployment is a separate action with live revision/assets and health verification.

The accompanying visual concept uses synthetic data only. It illustrates layout, filtering, and note disclosure; it is not connected to appointment data and does not record reviews.

Concept checks passed: JavaScript syntax, section filtering, empty-search state, history expansion, and mobile section selection. Layout measurements showed no horizontal overflow at 320, 736, and 1024 pixels; desktop and narrow mobile views were visually inspected. No console errors were observed. Twenty-six linked upstream file paths were checked against repository trees. Hash comparison confirmed that all 59 pre-existing tracked/untracked workspace files remained unchanged. Application test suites were not run because no application code changed.
