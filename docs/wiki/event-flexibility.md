# Event flexibility and bulk preparation

User-authorized bounded implementation session, 2026-10-20. This amends the original jury-size requirement and adds two bulk organizer operations. Local implementation; publication remains pending.

## Jury sizes

Technická and Veřejná may have any membership counts and need not be equal. A public-only event such as **Predvyber** (event `884b8056-f91e-4437-ad81-ef70c0fe5997`) with 14 Veřejná and 0 Technická is supported. No replacement minimum or required second group is introduced. At least one same-event group must still be permitted in each category, and complete D21 rules and enough linked teams remain required. Empty eligible rosters retain existing dashboard warnings and provisional-results behavior. Activation still freezes membership and category configuration; reopening preserves votes/history/freezes.

Live read-only inspection: the event's **Předvýběr** category `0b525da1-8c4f-4987-a872-d97f4ad93494` has 21 of 21 event teams, limits 6 places / 10 positive / 3 negative, and no permitted jury group selected. Select **Veřejná** and save before activation. This session has not activated or modified the hosted event.

## All event teams

In new or editable category preparation, choose **Přidat všechny týmy eventu**. This fills unassigned entry rows, then appends only missing team IDs, preserving existing IDs, selections and orders. Names never establish identity. The button disables once every loaded event team is included; it cannot create duplicate assignments. Additions are local until **Uložit kategorii**. Existing validation, atomicity, conflict review, stable-ID retries and freezes apply. Teams added in another tab require a refreshed/reviewed snapshot; the action does not silently synchronize future teams.

## Excel of personal links

Under **Příprava → Porotci**, save edits, then choose **Stáhnout odkazy porotců (XLSX)**. Search does not limit export: it contains every saved juror, full jury label and descriptive name, personal clickable URL, access status, membership ID, event identity and UTC export time. Duplicate names remain separate rows. Names are literal XLSX text, including formula-like names.

This is a private credential file: give each juror only their own URL. It downloads directly without showing URLs on the page or writing them to application/browser storage, logs or audit. Existing results XLSX stays secret-free. The new export does not create/replace/revoke any link or session and works for frozen rosters. Never-issued, revoked and unrecoverable legacy entries have blank URL cells and an explicit explanation. Save never-issued members to create first links; legacy replacement and revoked restoration remain explicit confirmed organizer actions. Missing keys/corrupt encrypted credentials fail the entire export safely, rather than producing a misleading partial file or replacing access.

`POST /events/:eventId/jurors/links.xlsx` accepts strict `{}` body and no query parameters, with existing admin cookie, origin and `X-D21-Request: 1` guards. The existing event-first read transaction obtains a consistent roster/credential snapshot and rechecks current admin authorization after waits and after workbook creation. Responses use XLSX MIME, attachment filename, no-store, no-referrer and nosniff. Existing external encryption keys and separate key backups remain required.

## Validation and handoff

See [progress](../implementation/progress.md) for actual tests and review. No migration, new dependency, change to D21 limits/ballot submission/results/ties, membership deletion, automatic cleanup, messaging or other project is included. Native Excel/LibreOffice/manual mobile devices are separate from the automated workbook/Chromium checks. No commit/push or deployment has occurred; explicit Git authorization is required by AGENTS.md.
