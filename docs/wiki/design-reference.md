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

| Preview observation                                      | Written requirement / next action                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Juror entry uses an organizer-issued code.               | The brief calls for entering a name and explicitly leaves secure identity unresolved. A code-based model has not been approved. |
| Example event shows four jurors in each group.           | The brief specifies equal groups of 5, 7, or 9. Preview counts are illustrative.                                                |
| Progress categories are shown as a table.                | The brief asks for a category grid with cards, progress, and statuses. Retain the visual style while meeting that requirement.  |
| Example results label winners and show scores.           | Implement winner selection, tie handling, and provisional/final behavior only from confirmed rules.                             |
| Demo names, codes, event labels, and totals are visible. | These are reference content, not production seed data or operational evidence.                                                  |

Future sessions should reopen the preview when implementing UI. If it becomes unavailable, use these notes as the recorded reference and report any visual details that cannot be verified.
