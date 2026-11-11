# Streamlined voting workflow

This local pass follows the [creation-to-results review](../../apps/web/.impeccable/critique/2026-11-11T00-54-21Z__src-app-tsx.md) and the [organizer usability update](organizer-usability.md). The existing blue/navy theme, Czech terminology, URL structure, and server voting policies stay in place.

## Organizer

- Create an event to open **Týmy**. **Vložit ze spreadsheetu** is above the roster so it stays reachable as the table grows. Stage and review pasted rows, then save them explicitly. After saving teams or jurors, the next preparation link is available without requiring an order for existing events.
- Saved team and juror rows use Czech name order, with numeric names in natural order. Duplicate names keep separate identities. Staged rows stay in input order until saved; conflict review keeps edited rows in their current positions. Adding all teams to a new category uses the same name order for new entries and leaves existing entry positions intact.
- Event tabs and administration links switch views inside the signed-in workspace. The event heading stays mounted across its five tabs. Links retain ordinary browser behavior for direct entry, new tabs and Back/Forward. Dirty editors, pasted text and pending saves still warn on departure; cancelling preserves the editor.
- Saving a new category opens it directly, without a page unload or a stale list. Draft setup shows advisory readiness for saved limits, teams and jury groups. The server still validates activation and the organizer still confirms the first freeze. Draft screens omit ballot unlocking; locked configuration fetches its detail when expanded.

## Juror and results

- The existing personal-link confirmation opens the overview directly from the verified entry response. The link fragment is removed before redemption, and no extra navigation or duplicate overview request is needed.
- In a ballot, **Odevzdat kategorii** and **Uložit návrh** stay beside the vote counts. Validation and conflicts remain visible near the controls. Optional server-only checking remains under **Kontrola výběru na serveru**. Submission still has an explicit confirmation and uses the current ballot revision. Once submitted, the next category or review is reachable from the same bar.
- **Výsledky** shows the ranking and finality sooner. Excel and refresh share the toolbar. Full team IDs remain in category detail, with short IDs beside duplicate names in the overview. Final winners use the existing server selection; a single winner is called out at the top.

No backend, migration, dependency, authentication, eligibility, D21, freeze, counting, tie or export-format change. Multi-category review and independent submission semantics are unchanged. Juror links between subsequent category pages retain their existing navigation and unsaved-draft protection. See [progress](../implementation/progress.md) for actual validation and [handoff](../implementation/next-session.md) for local testing.
