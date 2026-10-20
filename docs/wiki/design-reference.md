# Design reference

Recorded 2026-10-16 from the user's message and a browser inspection.

## User-provided preview

[Lovable design preview](https://lovable.dev/preview/B5g1pVIhaqERXx1MrD7RrOkKifuxT8Mt)

The user describes this as a preview of how the app should look and explicitly allows some design innovation. Preserve its overall visual direction while improving usability, accessibility, responsiveness, and consistency where helpful.

The preview resolved during inspection to [the running application](https://id-preview--75fba2c8-a7ba-4e44-b42a-f6de14eda088.lovable.app/). Prefer the original Lovable link for future sessions because the resolved deployment may change.

## Observed visual direction

- Warm off-white page background, light surfaces, dark charcoal text, restrained borders, and generous whitespace.
- Compact D21 wordmark, simple top navigation, and an underline for the current administration section.
- Clear sans-serif headings and body copy; small uppercase contextual labels and monospaced-looking codes and figures.
- Flat, restrained components with little decoration; dark primary buttons; green progress and positive values; muted red warnings and negative values.
- Landing page with two clear entry choices: juror voting and administration.
- Administration progress screen with event context, a prominent submission progress bar, an attention panel, a juror table, and category participation counts.
- Results presented in category-specific ranking tables with rank, team, positive votes, negative votes, and score. The inspected desktop view uses two columns.
- Juror entry is a narrow, focused form with a single primary action.

Inspected routes: `/`, `/admin`, `/admin/vysledky`, and `/hlasovani`. Inspection was limited to rendered desktop screens. The authenticated wizard, vote interactions, mobile layouts, and backend behavior were not verified.

## Applying the reference

Translate this direction into semantic Tailwind tokens and shared shadcn/ui components. Keep voting limits visible, touch targets at least 44 × 44 px, keyboard focus visible, and status labels understandable without color. Preserve the written desktop voting-table and mobile grid requirements.

Design improvements are permitted; a pixel-perfect reproduction is not required. Do not copy the Lovable editing badge into the product.

## Differences that require care

| Preview observation                                      | Written requirement / next action                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Juror entry uses an organizer-issued code.               | The brief calls for entering a name and explicitly leaves secure identity unresolved. Later Phase 2/5 decisions approve organizer-issued secret links; names are display data. No name/code form from the preview overrides this. |
| Example event shows four jurors in each group.           | The brief specifies equal groups of 5, 7, or 9. Preview counts are illustrative.                                                                                                                                                  |
| Progress categories are shown as a table.                | The brief asks for a category grid with cards, progress, and statuses. Retain the visual style while meeting that requirement.                                                                                                    |
| Example results label winners and show scores.           | Implement winner selection, tie handling, and provisional/final behavior only from confirmed rules.                                                                                                                               |
| Demo names, codes, event labels, and totals are visible. | These are reference content, not production seed data or operational evidence.                                                                                                                                                    |

Future sessions should reopen the preview when implementing UI. If it becomes unavailable, use these notes as the recorded reference and report any visual details that cannot be verified.

Phase 5 reinspection on 2026-10-17: the original preview URL was unavailable through the web tool. The recorded visual direction and existing application tokens were used; no additional preview behavior was inferred. Desktop/mobile wizard and organizer screens were visually checked against the local real backend.

Phase 6 reinspection on 2026-10-17: original preview unavailable through the web tool again. Reused recorded direction and existing tokens. Real-backend desktop/phone/landscape checks verified table/grid, selected markers, sticky counters, keyboard and invalid/error feedback; details in progress.md.

Phase 7 reinspection on 2026-10-17: the original preview was unavailable through the web tool. Existing tokens/recorded direction guided draft saving and comparison. Real-backend checks covered restoration, conflicting tabs, valid/invalid/empty draft status, keyboard save, actual API outage/retry, stale closure/reopening availability refresh and expiry clearing. Phone 375×812 and landscape 812×375 measurements showed no horizontal overflow and 44px sign controls. Save/error feedback now receives focus, stale success messages clear on editing, and comparison buttons have flexible height. Native logout/unload prompt cancellation was not reliably exercised by the browser driver; do not report it as passing.

Phase 8 reinspection on 2026-10-17: original preview remains unavailable through the web tool. Recorded tokens/direction guided per-category confirmation, submitted timestamp/read-only choices and admin unlock confirmation. Real-backend browser checks verified keyboard confirmation/cancel/focus, actual conflicting-tab comparison, retained choices through outage/closure/reopening and expired-submit clearing. Checked 1280px desktop, 375×812 phone and 812×375 landscape show no measured horizontal overflow; sign controls 44×44px, confirmation 44px high. Fixed stale confirmation blocking comparison and misleading reopening text on submitted active ballots. No full accessibility audit is claimed.

Phase 9 reinspection on 2026-10-17: preview URL remains inaccessible. Used recorded restrained surfaces/tokens and existing components for review, selection, confirmation and per-category outcomes. Real-backend 1280px desktop, 375×812 phone and 812×375 landscape checks show no measured overflow; selection labels >=44px, phone confirmation actions 44px. Verified keyboard confirmation/cancel focus, real second-tab stale recovery, stopped-API retry, partial closure, unlock refresh and expired-session clearing. No full accessibility audit. Screenshots outside repository in the session visualization directory.

Phase 10 reinspection on 2026-10-18: original preview still inaccessible. Used recorded warm surfaces/tokens for administration KPI strip, category cards, native progress bars, factual-problem section and juror disclosures. Real-backend desktop 1280px, phone 375×812 and landscape 812×375 checks show no measured horizontal overflow; phone buttons/search/select 44px, summaries 64px. Keyboard search/disclosure/refresh/retry focus verified. Screenshot `phase10-dashboard.png` outside the repository uses disposable fixture data. No full screen-reader audit.

Phase 11 reinspection on 2026-10-18: preview URL remains inaccessible. Recorded category-ranking direction/current tokens guided two-column desktop tables and labelled phone rows. Real-backend 1280px desktop, 375×812 phone and 812×375 landscape checks showed no measured horizontal overflow and 44px buttons/links. Verified shared ranks, cutoff warning, final/provisional labels, direct refresh, keyboard navigation/refresh, actual unlock/replacement, stopped-API retry/focus and expired-session clearing. Screenshots `phase11-results.jpg` and `phase11-preview.jpg` are outside the repo in the session visualization directory and contain disposable data. No full screen-reader audit.

## Phase 12 — 2026-10-18

Used the recorded restrained surfaces/current tokens for the export panel. Real-backend keyboard download, focused failure/retry recovery, pending states and expired-export clearing verified. Phone 375×812 and landscape 812×375 show no measured horizontal overflow; download control is 44px high. Desktop screenshot `phase12-export.png` is outside the repository and contains disposable data. No full screen-reader audit or new preview access is claimed.

## Phase 13 — 2026-10-18

Existing visual tokens/layout were retained. Built-app Chromium checks cover 1280×900 desktop, 375×812 phone and 812×375 landscape with dark browser preference/reduced motion; the app keeps its designed light palette. Automated WCAG A/AA scans pass across tested admin/juror/results states, sign controls measure at least 44×44, and tested pages have no horizontal overflow. Generated phone/landscape results screenshots were visually inspected. No full screen-reader/native-device/dark-theme certification is claimed. See progress.md for the isolated earlier uncertain submission response and final diagnostic/full-suite results.

## Simplification Stage 2 — 2026-10-18

Preview reinspection returned inaccessible through the web tool. Reused the recorded warm light palette, restrained surfaces and existing tokens for shared event navigation and focused preparation. Final local desktop/phone/landscape browser checks pass keyboard navigation/history/direct links, Axe A/AA, 44px primary navigation and no-overflow checks. Final screenshots visually inspected; source review tightened metadata/roster-refresh placement and retained global error escape navigation. This is not full screen-reader/native-device or a new dark theme certification. See [workspace guide](simplification-stage-2.md) and progress.

## Simplification Stage 3 — 2026-10-18

Preview reinspection remained inaccessible. Retained the recorded warm light surfaces/tokens for the Teams editor, with desktop columns and labelled phone rows. Final fixed-build browser checks cover desktop 1280×900, phone 375×812 and landscape 812×375 with dark preference/reduced motion: keyboard/error-summary and field focus, preview, conflict review, exact retries, Axe A/AA, 44px controls and no measured overflow. Source/visual review fixed undersized new buttons, focus restoration, stale removal feedback and duplicate-name comparison IDs. All three final Teams screenshots were visually inspected outside the checkout. This is not full screen-reader/native-device/all-browser certification; see progress and the [Teams guide](simplification-stage-3.md).

## Simplification Stage 4 — 2026-10-18

Preview reinspection returned inaccessible. Used the recorded warm light surfaces/tokens for the Jurors table, labelled phone rows, explicit T/V selection, paste/error/comparison states and existing personal access/group controls. Final fixed-build browser 18/18 passes desktop 1280×900, phone 375×812 and landscape 812×375 with dark preference/reduced motion. Keyboard/focus, retained errors, real response-loss retry, concurrent freeze recovery, link copying/fallback, auxiliary editing pause, Axe A/AA, 44px controls and no measured overflow are verified. All three final secret-free Jurors screenshots were visually reviewed outside the checkout. This is not full screen-reader/native-device/all-browser certification; see progress and the [Stage 4 guide](simplification-stage-4.md).

## Simplification Stage 5 — 2026-10-19

Preview reinspection remained inaccessible. Reused the recorded warm light tokens for one combined category form, explicit rule fields, T/V checkboxes, stable entry rows and readable local/current comparison. Source/visual review removed repeated draft instructions, limited IDs in selectors to equal-name disambiguation, improved field errors and initial/create/add/remove/cancel focus, and paused editing during activation confirmation. Full browser 21/21 and final affected category 3/3 pass desktop 1280×900, phone 375×812 and landscape 812×375 under dark preference/reduced motion; keyboard/Axe A/AA, 44px controls and no measured overflow pass. All three final secret-free screenshots were visually reviewed outside the checkout. The final targeted run additionally verifies retaining a blank invalid order field. This is not full screen-reader/native-device/all-browser certification; see [Stage 5](simplification-stage-5.md) and progress for exact sequence/limits.

## Automatic juror links — 2026-10-19

Preview reinspection remained inaccessible. Retained the recorded restrained warm surfaces/tokens while removing the Osobní přístup panel and keeping direct Copy beside saved jurors. Responsive direct exceptional confirmations identify name/full ID, pause editing and restore focus. Full built-app Chromium 21/21 and final affected access 3/3 after identity-description refinement pass desktop 1280×900, phone 375×812 and landscape 812×375 with dark preference/reduced motion; keyboard/Axe A/AA, selected clipboard fallback, 44px controls and no measured overflow pass. All three final secret-free access screenshots were visually reviewed outside the checkout. No full screen-reader/native-device/all-browser certification or hosted validation is claimed. See [automatic links](automatic-juror-links.md) and [actual sequence](../implementation/progress.md).

2026-10-20 event-flexibility amendment: the user explicitly removes the original fixed/equal jury-size rule; illustrative preview sizes do not replace it with a new minimum. The current update preserves existing tokens/components and was visually checked in the built app on desktop, phone and landscape. No new external-preview inspection is claimed. See [workflow and validation](event-flexibility.md).
