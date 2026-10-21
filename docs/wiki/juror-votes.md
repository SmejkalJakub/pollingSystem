# Individual juror votes

User decision, 2026-10-21: administrators may see each juror's individual choices and export them. This supersedes the Phase 11/12 rule that results and the XLSX contain no individual choices. The user chose to include saved, unsubmitted drafts as well as submissions, to show them on the category results detail, and to export them as a new sheet in the existing results workbook.

## Where

- **Výsledky → Detail a hlasy porotců** (`/admin/results/votings/:votingId`) shows a **Hlasy porotců** section under the category results. Each currently eligible juror is listed with their jury (Technická/Veřejná), progress status (Nezahájeno, Uložený návrh, Neplatný návrh, Odevzdáno, Uzamčený lístek), saved/submitted time, and the teams they voted positive and negative for, in category display order.
- **Stáhnout XLSX** on event results now adds a fourth sheet, **Hlasy porotců**, after Kategorie, Výsledky and Účast. It has one row per juror vote: category, juror name/ID, jury, ballot status, **Započteno** (Ano/Ne), team name, item ID and vote (`1` or `-1`). A juror with no saved choices gets one row with blank team/vote cells.

## Rules

- Only `Započteno = Ano` / `counted: true` ballots (current submissions of currently eligible jurors) contribute to results. Drafts, invalid drafts and cancelled ballots are shown for information and are labelled as not counted. Aggregation, ranking, ties and finality are unchanged.
- The listed jurors are exactly the currently eligible jurors from the dashboard projection, the same set as the Účast sheet. Ballots of jurors outside current permissions stay excluded (and flagged as `INELIGIBLE_BALLOTS`); they are not listed.
- Submission/unlock history, revisions, audit contents, links and secrets are still never exposed. Reads write nothing.
- `GET /results/overview` stays aggregate-only. `GET /results/votings/:votingId` adds `jurorVotes: JurorVotes[]` (`jurorId`, `displayName`, `groupId`, `progress`, `counted`, `savedAt`, `submittedAt`, `entries`). Both use the same shared event lock, guards and no-store headers as before; the ballots are read in one batched query, with no per-juror loop.

No schema, migration or dependency change.

## Validation (2026-10-21, local)

`npm run check` source checks pass (79 fast tests, typechecks, lint, both builds; formatting passes for project files, with only the user-ignored `.claude/settings.local.json` excluded). PostgreSQL `npm run test:db -- --maxWorkers=2` 312/312, including the new per-juror detail case (submitted, draft, not-started, group eligibility, drafts not counted) and the extended workbook assertions. Full built-app `npx playwright test` 24/24 on desktop, phone and landscape-dark, including the new detail section with Axe and the four-sheet workbook. Deployed 2026-10-21 as `7c6de12`, Render `dep-dbcbq0eq1p3s73cu83kg`; live bundles/protection/backups/row preservation verified, authenticated live view not checked. [Release record](../implementation/progress.md).
