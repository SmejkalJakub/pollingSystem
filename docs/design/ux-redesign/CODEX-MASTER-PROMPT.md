# Codex master prompt — D21 UX/UI redesign

You are implementing an **approved UX/UI redesign** of the D21 hackathon voting system in this repository. The design is final. Your job is to build it **exactly as specified**: same layouts, same hierarchy, same copy, same interactions. Do not "improve", reinterpret or simplify it. When something is not covered here or in the artboards, **stop and ask the user**. Do not guess.

The redesign changes **presentation and navigation only**. Voting rules, validation, submission semantics, locks, access/links, results computation and privacy stay exactly as they are today.

---

## 0. Before you write any code

1. Read `AGENTS.md` and follow it. It overrides convenience. In short:
   - One phase per session (phases are in §7).
   - Keep `docs/implementation/{plan,progress,decisions,next-session}.md` accurate.
   - Never mark unrun checks as passing.
   - Do not commit, push or deploy without explicit authorization.
2. Read `README.md`, all of `docs/implementation/`, and these wiki pages: `juror-wizard.md`, `multi-category-review.md`, `ballot-submission.md`, `voting-configuration.md`, `organizer-usability.md`, `streamlined-workflow.md`, `juror-votes.md`, `results-ranking.md`, `operational-dashboard.md`, `automatic-juror-links.md`, `design-reference.md`.
3. Read **every artboard** in `docs/design/ux-redesign/artboards/` (see §2). They are the visual source of truth.
4. Run `git status`. The working tree contains **uncommitted work from earlier sessions**. Preserve it: never revert, reset, stash-drop or overwrite unrelated changes. Re-read a file right before editing it.
5. In `docs/implementation/next-session.md`, find which redesign phase (R1–R7) is next. Do only that phase in this session. If none is recorded, the next phase is **R1**.

---

## 1. Non-negotiables (anti-drift rules)

1. **Pixel intent over invention.** Match the artboards' layout, spacing, sizes, colors, radii, copy and component states. If the artboard and this document disagree, this document wins. If both are silent, ask.
2. **Copy is literal.** Czech UI strings in quotes below and in the artboards are final, including diacritics and typographic quotes („…“, –, ·, →, ✓, ✕). Do not rephrase. Existing messages not covered by the design (server errors, `ballotMessages.ts`, rejection texts) stay as they are.
3. **No rule changes.** Do not change:
   - D21 validation (`@d21/voting-domain`): plus/minus limits, "each negative vote needs two cast positive votes", and refusing edits that create or worsen a negative-eligibility violation;
   - explicit draft saving ("Uložit návrh" stays — autosave is **rejected**);
   - per-category submission and confirmation;
   - locking, which only an administrator can lift;
   - revision/conflict checks;
   - link and session lifecycle;
   - results counting, shared ranks, unresolved cut-off ties, provisional/final labels;
   - "only submitted ballots count";
   - the aggregate-only results **overview** (juror identities and choices appear only in the category results **detail**).
4. **Existing enable/disable conditions are kept.** Every button keeps today's enable/disable logic (see `CategoryVoting.tsx`, `BallotSubmission.tsx`, `WizardReviewScreen.tsx`, `useReviewSubmission.ts`, admin forms). The redesign only moves and restyles them unless §5 says otherwise.
5. **No new dependencies** except the one allowed in §3 (self-hosted Inter). No database schema or migration changes. API changes only as allowed in §6.
6. **Accessibility is part of the design:**
   - real `<button>`, `<a href>`, `<input>` + `<label>` elements;
   - `aria-pressed` on vote buttons, `aria-current` on the active tab or nav item;
   - focus management as today (headings and feedback receive focus), visible focus rings;
   - a dialog role and focus trap on bottom sheets, with Esc closing them and focus returning to the opener;
   - touch targets ≥ 44 px (juror vote buttons 48 × 48 px on phone), text contrast ≥ 4.5:1 in light and dark;
   - axe checks must keep passing.
7. **Responsive:**
   - Juror: phone layout < 1024 px, three-column layout ≥ 1024 px.
   - Admin: designed at 1440 px; must work at 375 px with no horizontal page scroll (wide tables scroll inside their own box; nav rows scroll horizontally).
8. **Code style (user rule, all languages):**
   - always use braced blocks with the body on its own line, including early returns (`if (!x) {` / `  return;` / `}`);
   - no braceless `else`;
   - no `cond && doThing()` statements;
   - no nested or chained ternaries — use `if` blocks or small named functions.

   Apply this to code you write or touch.

9. **Dark mode:** the app supports `prefers-color-scheme: dark`. The artboards are light only. Derive dark equivalents for every new token, keeping the same hue roles and ≥ 4.5:1 contrast, and record the chosen values in `docs/implementation/decisions.md`.

---

## 2. Design source of truth

Folder: `docs/design/ux-redesign/artboards/`. Each `*.dc.html` file is one screen.

- Read the markup and inline styles. They need a proprietary runtime (`support.js`), so they will not render in a plain browser; that is expected.
- The `<script>` block at the bottom holds sample data and, for `Main.dc.html`, the reference interaction logic.
- `canvas.json` lists screen titles.
- `FlowCompare.dc.html` explains the intent: fewer clicks, no page reloads between juror categories.

| Artboard                | Screen                                                                                                                                                                    | Implements                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `Main.dc.html`          | Juror voting, phone, **interactive reference** (tabs, budget, vote toggling, save, unsaved-change prompt, submit sheet, auto-advance, summary)                            | R1, R2                    |
| `JurorSubmit.dc.html`   | Juror submit confirmation sheet                                                                                                                                           | R1                        |
| `JurorSummary.dc.html`  | Juror summary (replaces review/confirmation pages)                                                                                                                        | R2                        |
| `JurorDesktop.dc.html`  | Juror voting ≥ 1024 px                                                                                                                                                    | R1                        |
| `JurorEntry.dc.html`    | Juror link entry                                                                                                                                                          | R3                        |
| `JurorConflict.dc.html` | Draft changed elsewhere (comparison sheet)                                                                                                                                | R3                        |
| `JurorClosed.dc.html`   | Category closed / no categories                                                                                                                                           | R3                        |
| `AdminLogin.dc.html`    | Admin login                                                                                                                                                               | R4                        |
| `AdminEvents.dc.html`   | Event list + create event                                                                                                                                                 | R4                        |
| `AdminJurors.dc.html`   | Jurors table                                                                                                                                                              | R5                        |
| `AdminTeams.dc.html`    | Teams table                                                                                                                                                               | R5                        |
| `AdminSetup.dc.html`    | Event shell/nav + Categories overview. **The lower block "Úprava kategorie · jedna stránka, jedno uložení" is superseded by `AdminCategory.dc.html`. Ignore that block.** | R4 (shell), R6 (overview) |
| `AdminCategory.dc.html` | Category editor                                                                                                                                                           | R6                        |
| `AdminProgress.dc.html` | Voting progress (juror × category matrix)                                                                                                                                 | R7                        |
| `AdminResults.dc.html`  | Results + "Hlasy porotců" juror × team matrix                                                                                                                             | R7                        |

Sample names, numbers and limits in the artboards are fictional. Always render real data.

---

## 3. Visual system (tokens)

Add these as CSS custom properties in `apps/web/src/index.css`, next to the existing tokens, with dark-mode values (§1.9). Reuse the existing Tailwind `@theme` mapping style. Do not hard-code hex values in components.

| Token                | Light                 | Use                                             |
| -------------------- | --------------------- | ----------------------------------------------- |
| `--background`       | `#f2f5fb`             | page (exists)                                   |
| `--foreground`       | `#182640`             | text (exists)                                   |
| `--card`             | `#ffffff`             | surfaces (exists)                               |
| `--primary`          | `#2356c7`             | primary buttons, positive votes, links (exists) |
| `--primary-hover`    | `#1a4299`             | link/button hover                               |
| `--secondary`        | `#e6edf8`             | chips, empty pips (exists)                      |
| `--muted-foreground` | `#52627a`             | secondary text (exists)                         |
| `--border`           | `#cbd5e5`             | card and control outlines (exists)              |
| `--border-subtle`    | `#e3e9f3`             | table row dividers                              |
| `--control-border`   | `#7b8ca8`             | secondary button outline (exists)               |
| `--table-head`       | `#f7f9fd`             | table header and footer background              |
| `--selected-plus-bg` | `#f3f7ff`             | row with a positive vote; selected card         |
| `--destructive`      | `#b32f3e`             | negative votes, destructive actions (exists)    |
| `--destructive-soft` | `#fbe9eb` / `#fdf3f4` | error message bg / row with negative vote       |
| `--destructive-text` | `#8c1f2c`             | text on soft red                                |
| `--success`          | `#1f7a4d`             | submitted mark, saved dot                       |
| `--success-soft`     | `#e3f3ea`             | submitted banner/pill bg                        |
| `--success-text`     | `#155a37`             | text on soft green                              |
| `--warning`          | `#e0a43a`             | unsaved dot, "needs attention" borders          |
| `--warning-soft`     | `#fdf1dc` / `#fdf8ec` | warning pill bg / tie rows                      |
| `--warning-text`     | `#7a4d06`             | text on soft amber                              |
| `--header`           | `#182640`             | navy app header and save bars                   |
| `--header-muted`     | `#c9d4ea`             | inactive header text                            |
| `--header-accent`    | `#9bbbff`             | active nav underline (3 px)                     |
| `--header-line`      | `#4a5b7c` / `#33456b` | header button outline / separators              |

- **Font:** Inter 400/500/600/700, self-hosted via `@fontsource-variable/inter` (the only allowed new dependency; no external font CDN). Fallback: `system-ui, sans-serif`. Use `font-variant-numeric: tabular-nums` for all counts and scores.
- **Type scale:**
  - juror phone: H1 22 px/700, eyebrow 12 px/600 uppercase with letter-spacing .04em, body 15 px, meta 13 px, small 12 px;
  - desktop: page title 28–30 px/700, section 17–20 px.
- **Radii:** buttons 10–12 px; cards 14–16 px; chips/pills 999 px; bottom sheets 20 px top corners; vote buttons 12 px (phone) / 10 px (desktop).
- **Buttons:**
  - Primary: filled `--primary`, white 600 text, height 48 (juror) / 44 (admin).
  - Secondary: white with 1 px `--control-border`.
  - Header-bar buttons: transparent with `--header-line` outline.
  - Disabled primary: `--secondary` bg and muted text.
- **Status vocabulary** (use everywhere, exact copy):
  - **Pills:** Koncept (amber), Připraveno (blue on `--secondary`), Otevřeno / Hlasuje se (green), Uzavřeno (grey).
  - **Juror marks:** filled green circle ✓ = odevzdáno; blue-outlined dot • = rozpracováno/návrh uložen; red-outlined "!" = neplatný návrh; grey outline = bez hlasů; lock icon = uzavřeno.
- **Icons:** inline stroke SVGs as in the artboards (menu, lock, check, link). No emoji. Decorative icons get `aria-hidden="true"`.

---

## 4. Decisions (recorded — do not reopen)

| #   | Decision                                                                                                                                                                 | Status                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Draft saving stays **explicit** via "Uložit návrh". No autosave.                                                                                                         | **Decided** by user                                                                                                                                          |
| D2  | The juror flow is one screen: category tabs + "Souhrn" tab; no separate overview, review or confirmation pages.                                                          | **Decided** (approved design)                                                                                                                                |
| D3  | The "Hlasy porotců" view is a juror × team matrix: ✓ positive, ✕ negative, dashed = saved draft not counted.                                                             | **Decided** by user                                                                                                                                          |
| D4  | Link entry: keep the explicit "Pokračovat k hlasování" button (no automatic sign-in).                                                                                    | **Pending** — keep the button. Do not implement automatic sign-in unless the user decides otherwise.                                                         |
| D5  | Summary checkboxes pre-selected for valid drafts.                                                                                                                        | **Pending** — implement **unselected by default** (current rule "Žádná kategorie se nevybírá automaticky"). Keep the code ready to switch with one constant. |
| D6  | "Odemknout odevzdaný lístek…" in the progress matrix row menu.                                                                                                           | **Pending** — implement the menu, but the item **navigates to the existing unlock flow in the category detail**. It does not unlock inline.                  |
| D7  | Event cards show status/progress/counts (needs data not in `GET /events`).                                                                                               | Allowed as additive read-only API data (§6). If you would need a schema change, stop and ask.                                                                |
| D8  | Juror desktop keyboard shortcuts: ↑/↓ move between team rows, "+" and "−"/"-" toggle votes. Active **only while focus is inside the team list**; no global key handlers. | **Decided** (approved design)                                                                                                                                |

Record D1–D8 in `docs/implementation/decisions.md` in phase R1, with D4–D6 marked pending.

---

## 5. Screen specifications

### 5.1 Juror shell

- **Routes keep working** (deep links and bookmarks): `/`, `/wizard`, `/wizard/steps/:id`, `/wizard/review`, `/wizard/confirmation`.
  - `/wizard` opens the **first active category that is not submitted**. If there is none, it opens **Souhrn**. If there are no categories, it shows the empty state (§5.7).
  - `/wizard/review` and `/wizard/confirmation` open **Souhrn**.
  - Switching tabs updates the URL with `history.pushState` and **does not reload the page**. Back/Forward switch tabs. Fetch step data with the existing endpoints (`/wizard/current`, `/wizard/steps/:id`, `/wizard/review`). Keep the hash-stripping and juror-start logic in `JurorPortal.tsx` unchanged.
- **Header** (navy, phone):
  - D21 mark;
  - line 1 `{displayName} · {juryGroupLabel} porota` (e.g. "Jana Nováková · Technická porota");
  - line 2 event name in `--header-muted`;
  - a 44 px menu button (`aria-label="Menu porotce"`) opening a menu with "Odhlásit se". The existing unsaved-changes confirm before logout is kept.
  - Desktop shows the event name left, the identity right, and an "Odhlásit se" button.
- **Category tabs (phone):**
  - a horizontally scrollable row of pill buttons in `current.steps` order, plus a last pill "Souhrn {submitted}/{total}";
  - the active pill is navy filled with `aria-current="page"`;
  - each pill shows the status mark (§3) and the step name.
- **Category rail (desktop):** a vertical list. Each item shows the name and a status line:
  - "Rozpracováno · {plusUsed} z {maxPlus} +"
  - "Odevzdáno"
  - "Bez hlasů"
  - "Neplatný návrh"
  - "Uzavřeno"

  Below the list is a dashed "Souhrn a odevzdání {submitted}/{total}" item.

### 5.2 Category voting (`Main.dc.html`, `JurorDesktop.dc.html`)

- **Eyebrow:** `{Finále | Výběrové kolo} · {places} · kategorie {i} z {n}`.
  - `places` for a final category: "1 vítěz", "2 vítězové"… "4 vítězové", "5 vítězů"+.
  - `places` for a selection category: "1–4 postupující", "5+ postupujících".
  - If `selectedPlaces` is null: "počet míst neurčen".
- **H1:** the category name. Instructions, when present, go below the H1. On a phone, clamp them to 2 lines with a "Zobrazit celé" toggle. On desktop, show them in full.
- **Budget panel** (sticky under the tabs on phone; right aside on desktop): two columns.
  - **"Kladné {used}/{max}":** one 8 px pip per allowed vote; used pips are filled `--primary`, the rest `--secondary` with a border.
  - **"Záporné {used}/{max}":**
    - used pips are filled `--destructive`;
    - unlocked but unused pips are soft red with a red border (unlocked = `min(maxMinus, floor(plusUsed/2))`);
    - locked pips have a dashed border.
  - If negatives are not allowed, show "Záporné nepovoleny" with one hatched pip.
  - **Hint line:**
    - negatives allowed: "Každý záporný hlas odemknou 2 kladné. Teď můžete dát ještě {n} záporný." When all negatives are used: "Záporné hlasy jsou vyčerpané. Hlasy nemusíte využít všechny."
    - negatives not allowed: "Záporné hlasy nejsou v této kategorii povoleny. Hlasy nemusíte využít všechny."
- **Blocked action message:** a single inline soft-red box under the budget with `role="status"`, shown when `toggleVote` blocks or the eligibility guard refuses:
  - PLUS_LIMIT → "Všechny kladné hlasy jsou rozdané. Nejprve některý odeberte."
  - MINUS_LIMIT → "Všechny záporné hlasy jsou rozdané. Nejprve některý odeberte."
  - NEGATIVE_ELIGIBILITY → "Každý záporný hlas potřebuje dva rozdané kladné hlasy."

  It clears on the next successful toggle. Persistent ballot issues (invalid saved draft, unavailable) keep the existing `messages` texts in one block.

- **Team list:** one card per team (phone) or one row per team in a bordered list (desktop), each containing:
  - index;
  - name (600);
  - description (13–14 px muted);
  - "+" and "−" buttons on the right.

  Rules:
  - Hide "−" entirely when negatives are disabled.
  - A selected "+" is filled `--primary` with white text; a selected "−" is filled `--destructive`.
  - A row with "+" gets the `--selected-plus-bg` background and a 1.5 px primary border; a row with "−" gets the soft-red background and a destructive border.
  - Each button has `aria-label="Kladný hlas: {name}"` / `"Záporný hlas: {name}"` and `aria-pressed`.
  - Pressing the active sign again removes the vote; pressing the opposite sign replaces it (existing `toggleVote`).

- **Locked/submitted:** the vote buttons are disabled, and a green banner reads "Odevzdáno a uzamčeno. Úpravy může povolit jen organizátor."
- **Footer** (phone: fixed bottom bar with safe-area padding; desktop: inside the aside):
  - **Status row:**
    - clean: green dot + "Návrh uložen · {HH:MM}";
    - dirty: amber dot + bold amber "Neuložené změny";
    - submitted: "Odevzdáno · uzamčeno";
    - nothing saved yet: "Zatím neuloženo".
  - **"Uložit návrh"** sits on the status row's right (outlined; primary-colored when dirty, muted when clean) and keeps today's enable/disable condition. Desktop adds the line "Naposledy uloženo {HH:MM}. Uložený návrh se nezapočítává, dokud kategorii neodevzdáte."
  - **Action row:**
    - secondary "Další →" (last category: "Souhrn →"). When dirty it becomes "Uložit a další" / "Uložit a souhrn" and saves first, staying on the screen if the save fails or needs comparison (current `continueAfterSave` behavior). Desktop label: "Uložit a další kategorie →" / "Další kategorie →".
    - primary "Odevzdat kategorii", opening the submit sheet. It is hidden when the category is submitted.
- **Unsaved-change prompt:** switching tab or rail item, or using Back/Forward, while dirty must not navigate. Instead, show an inline navy panel above the footer:
  - text: "Máte neuložené změny v této kategorii."
  - "Zahodit": restores the last saved entries, then navigates.
  - "Uložit a přejít": saves, then navigates only on success.

  The browser `beforeunload` guard remains for real page exits.

- **Submit sheet** (`JurorSubmit.dc.html`): a bottom sheet over a 45% navy scrim (desktop: a centered dialog, max 480 px), `role="dialog"` with `aria-modal`. It contains:
  - title „Odevzdat „{name}“?“
  - text "Po odevzdání se hlasy uzamknou. Upravit je půjde jen po odemčení organizátorem."
  - two tiles: "Kladné {used} z {max}" (blue) and "Záporné {used} z {max}" (red; omitted when negatives are disabled);
  - the vote list with + / − badges, positives first, in team order. An empty ballot shows one row "Prázdný lístek — žádný hlas".
  - if votes are unused: "Nevyužito {x} kladných a {y} záporných hlasů. To je v pořádku — hlasy nemusíte využít všechny." (omit a zero part; use Czech plural forms);
  - buttons "Zpět k úpravám" (secondary) and "Potvrdit odevzdání" (primary, "Odevzdáváme…" while busy).

  The sheet submits the **current entries** with the existing `draft.submit()` (no save needed first). On success it closes, the tab gets the ✓ mark, an sr-only `role="status"` announces "Kategorie {name} byla odevzdána.", and the screen **auto-advances** to the next active category that is not submitted, or to Souhrn. On failure or conflict it keeps today's handling.

- **Keyboard (desktop, D8):** inside the team list, ↑/↓ moves focus to the previous/next row's "+" button, and "+" / "−" / "-" toggles the focused row. Show the hint "Klávesy: šipky ↑ ↓ mezi týmy, + a − pro hlas." in the aside.

### 5.3 Souhrn (`JurorSummary.dc.html`, summary view in `Main.dc.html`)

- H1 "Souhrn hlasování", a green progress bar, and "Odevzdány {s} z {n} kategorií. Zbývající můžete dokončit později." (when all are done: "Všechny kategorie jsou odevzdané.").
- One card per category:
  - the name;
  - a status line:
    - "Připraveno k odevzdání" (blue; valid draft);
    - "Rozpracováno · návrh uložen";
    - "Odevzdáno {d. m. HH:MM} · uzamčeno" (green);
    - "Zatím bez hlasů";
    - "Nedostupné · čeká na otevření";
    - for an invalid draft, the first issue message in red, with the card in a soft-red background and border;
  - the vote line "+ A · + B · − C", or "Prázdný lístek";
  - a link: "Upravit hlasy" / "Zobrazit hlasy" / "Opravit hlasy" (opens that tab).
- A checkbox labelled "Odevzdat" appears only where `canSubmit(category)` is true. Default: unchecked (D5). A checked card gets a 1.5 px primary border.
- **Footer button:** "Odevzdat vybrané ({n})", or disabled "Vyberte kategorie k odevzdání". It opens the sheet "Odevzdat {n} kategorie?", which lists "{name} · {p} kladné, {m} záporné" and has the same two buttons. Confirm uses **`useReviewSubmission` unchanged** (independent per-category outcomes, retry of the same submission, uncertain-result handling).
- **Results** render inside the summary as the existing outcome list ("Potvrzeno: x z y vybraných kategorií." plus the per-category lines with the existing `rejectionText`).
- **When `flow.changed` is true,** show the existing notice and "Načíst aktuální přehled" button above the cards.

### 5.4 Entry (`JurorEntry.dc.html`)

- Header "Hlasování poroty", a link icon tile, H1 "Vítejte v porotě", and "Váš osobní odkaz je platný. Po pokračování uvidíte své kategorie a můžete hned hlasovat."
- Three numbered steps (copy as in the artboard).
- At the bottom:
  - a note card "Odkaz si ponechte pro návrat a nikomu jej nepředávejte.";
  - the primary button "Pokračovat k hlasování" ("Přihlašujeme…" while busy);
  - "Nejde to? Obraťte se na organizátora akce."
- Invalid or incomplete links and errors reuse the existing texts in this layout, with no button.
- `JurorLanding` (no link) uses the same layout: H1 "Vstup pro porotce", the existing explanatory text, no steps, no button.

### 5.5 Conflict sheet (`JurorConflict.dc.html`)

When `draft.needsComparison` is true, open a bottom sheet (dialog) that replaces the inline comparison:

- title "Hlasy se mezitím změnily"
- text "Uložený návrh byl upraven na jiném zařízení nebo v jiné záložce. Váš výběr zůstal zachovaný — vyberte, kterou verzi ponechat."
- a table with columns "Tým | Tady | Uloženo", listing teams with any vote in either version, with rows that differ highlighted in `--warning-soft` and badges for + / − or "žádný".

Buttons:

- primary "Ponechat můj výběr" → `draft.resolve(true)`, only when `remote.status === 'draft'`;
- secondary "Načíst uloženou verzi" → `draft.resolve(false)`.

When the remote copy is submitted or locked, show the existing sentence about it and only the load option. Footnote: "Rozdílné řádky jsou zvýrazněné. „Ponechat můj výběr“ ho připraví k dalšímu uložení." Keep the existing "Obnovit porovnání" as a ghost button.

### 5.6 Closed category (`JurorClosed.dc.html`)

When the step is not active or the ballot is unavailable:

- the tab shows a lock icon;
- the content is a card containing:
  - a lock tile, H2 "Hlasování v této kategorii je uzavřené";
  - "Hlasy teď nelze měnit ani odevzdat. Váš uložený návrh zůstává zachovaný, pokud organizátor kategorii znovu otevře.";
  - "**Uložený návrh:** {vote line}", only if a draft exists;
  - the button "Zkontrolovat znovu" (existing refresh).
- Then, if another active unsubmitted category exists, a primary link card "Můžete pokračovat" / "{name} →".

### 5.7 Empty state

No categories: a dashed card titled "Zatím žádné dostupné kategorie" with "Organizátor zatím neotevřel žádnou kategorii pro vaši porotu. Stránku můžete nechat otevřenou a později zkontrolovat znovu." and the button "Zkontrolovat znovu".

### 5.8 Admin shell (`AdminSetup.dc.html` header)

- **Header row 1** (navy):
  - D21 mark;
  - the link "Eventy";
  - a "/" separator;
  - an **event switcher** button "{event name} ▾" that opens a list of events (from `GET /events`) and navigates to the same section of the chosen event;
  - "Odhlásit se" on the right.

  On the event list, row 1 shows just the "Eventy" label.

- **Header row 2:** horizontally scrollable event nav.
  - Items: "Porotci {count}", "Týmy {count}", "Kategorie {ready}/{total} připraveny", then a vertical separator, then "Průběh hlasování", "Výsledky", "Nastavení eventu".
  - Setup items carry a status mark: green ✓ when complete (≥1 juror; ≥1 team; all categories active/closed or ready to activate), amber "!" otherwise.
  - The active item is white 600 with a 3 px `--header-accent` underline and `aria-current="page"`.
- **Routes:** keep the existing URLs. "Nastavení eventu" becomes its own view at `?setup=settings`, holding the existing event metadata form.
- The leave guard (`useAdminLeaveWarning`, `navigation.ts`) stays.

### 5.9 Admin login (`AdminLogin.dc.html`)

A full navy page with a centered white card (max 400 px, radius 20):

- D21 mark + "Administrace";
- H1 "Přihlášení";
- "Pro organizátory a garanty. Porotci se přihlašují svým osobním odkazem.";
- a "Heslo" field (48 px);
- an inline error under the field (existing texts; field red with `aria-invalid`);
- the primary "Přihlásit se" button;
- the footnote with the session length, from the existing logic ("Přihlášení platí 12 hodin." or the existing expiry text).

Keep all of the existing `AuthScreen` states.

### 5.10 Event list (`AdminEvents.dc.html`)

- H1 "Vaše eventy", subtitle "Otevřete event a pokračujte tam, kde jste skončili.", and the primary "+ Nový event".
- **Create form:** an inline card with a 1.5 px primary border and fields "Název eventu" and "Popis pro porotce (nepovinný)" (placeholder "Zobrazí se porotcům nad kategoriemi"). Buttons: "Zrušit" and "Vytvořit a přidat týmy →" (existing create, then `?setup=teams`).
- **Event cards:** a 3-column grid (1 column on phone). Each card shows:
  - a status pill: "Příprava" / "Hlasuje se" / "Uzavřeno";
  - a meta line;
  - the name;
  - the description, or "Bez popisu";
  - then, by state:
    - voting: "Odevzdané lístky x / y" + bar, and "{j} porotců · {t} týmů";
    - preparation: a checklist (✓/! jurors, teams, categories);
    - closed: "Všechny kategorie uzavřeny" + "Výsledky →".

  The whole card is a link. Data comes from §6.

- Keep the existing empty state copy, styled as a dashed card.

### 5.11 Jurors (`AdminJurors.dc.html`)

- **Title row:** H1 "Porotci", pills "Technická {n}" and "Veřejná {n}", and on the right "Vložit z Excelu" and "Stáhnout odkazy (XLSX)" (existing paste and export).
- **Paste preview:** a blue info bar "Vloženo {n} řádků ze schránky." with "Vrátit vložení" (existing paste/undo logic). Pasted rows appear in the table tagged "NOVÝ".
- **Table** (in a scroll box), columns "#", "Jméno porotce", "Porota", "Osobní odkaz":
  - Names are inline inputs, transparent until hover or focus. Edited rows get the `--selected-plus-bg` background and a primary input border.
  - **Porota:** a static pill for saved jurors whose group is fixed (existing rule); a select ("Vyberte", "Technická", "Veřejná") for new rows and editable ones.
  - **Osobní odkaz:** "Kopírovat odkaz" (existing `CopyJurorLink`, showing "✓ Zkopírováno" after success) plus a "⋯" menu with the existing actions: Nahradit odkaz…, Zrušit přístup…, Odebrat. Each keeps its existing confirmation.
  - **Revoked:** "Přístup zrušen" + "Obnovit odkaz…".
  - **New row:** "Odkaz vznikne po uložení".
  - **Invalid cell:** red 2 px border with the message underneath (existing validation).
  - **Last row:** a dashed input "Napište jméno nového porotce a stiskněte Enter".
- Footnote: "Porota stávajících porotců je po prvním otevření hlasování pevná. Další akce (⋯): Nahradit odkaz, Zrušit přístup, Odebrat."
- **Sticky navy save bar** at the bottom, visible whenever there are changes or errors:
  - "{n} neuložené změny · {k} řádek potřebuje opravu" (Czech plurals);
  - "Zahodit" (existing local discard; keep the restore option if it exists today);
  - "Uložit tabulku" (white).

  Conflict/compare flows keep their existing texts, shown in a panel above the table.

### 5.12 Teams (`AdminTeams.dc.html`)

- Same table pattern as jurors, with columns "#", "Název týmu" (600), "Popis (nepovinný, vidí porotci)" and "V kategoriích" (count of categories containing the team; see §6).
- Right aside, "Vložit více týmů najednou", with:
  - help text;
  - a textarea "Data z tabulky";
  - the button "Zobrazit náhled" (existing paste preview).
- Same save bar ("Uložit tabulku").

### 5.13 Categories overview (`AdminSetup.dc.html`, upper part)

- H1 "Kategorie", "Každá kategorie se otevírá samostatně.", and the primary "+ Nová kategorie".
- **One card per category:** a status pill, a meta line `{Výběrové kolo|Finále} · {places}`, H2 name, and a facts line `{n} týmů · {Technická + Veřejná porota} · max {p} + / {m} −`. By state:
  - **Koncept:** amber border; "Před otevřením chybí:" plus amber link chips "{issue} →" from `VotingReadiness` that deep-link to the field in the editor; button "Dokončit nastavení".
  - **Připraveno:** primary border; "Upravit" + primary "Otevřít hlasování" (existing activation, existing confirmation).
  - **Otevřeno:** "Odevzdáno x / y" + bar; "Průběh" link + "Uzavřít" (existing lifecycle confirmation).
  - **Uzavřeno:** "Znovu otevřít" (existing) + "Výsledky".
- **Right aside:**
  - "Připravenost eventu" checklist: jurors with T/V split, "Osobní odkazy vytvořeny pro všechny" (only if true; otherwise "{n} porotců bez odkazu"), teams, unfinished categories;
  - "Rozeslat odkazy" card with "Stáhnout odkazy porotců (XLSX)".

### 5.14 Category editor (`AdminCategory.dc.html`)

- Back link "← Kategorie", H1 name + status pill.
- **Sections** (white cards, numbered in muted text):
  1. **Základ:**
     - "Název";
     - "Instrukce pro porotce (nepovinné)";
     - "Typ" as a two-option segmented radio "Výběrové kolo | Finále";
     - "Počet postupujících týmů" / "Počet vítězů".
  2. **Pravidla hlasů:**
     - "Kladných hlasů na porotce";
     - "Záporné hlasy" segmented "Povolit | Zakázat";
     - "Záporných hlasů" (disabled when "Zakázat" is chosen);
     - the note "Při povolení platí: každý záporný hlas vyžaduje dva rozdané kladné."
  3. **Kdo hlasuje:** large checkbox tiles "Technická porota {n} porotců" and "Veřejná porota {n} porotců".
  4. **Týmy v kategorii · {x} z {y}:**
     - "Přidat všechny týmy eventu" (existing);
     - a 2-column checkbox grid of event teams (checked = included);
     - an ordered list with ↑/↓ buttons (`aria-label="Posunout {name} výš/níž"`) that edits `displayOrder`.

     **Saved entries cannot be removed** (existing rule): their checkbox is checked and disabled. Checking an unchecked team appends it. Note text as in the artboard.
- A section with missing required data gets a 2 px `--warning` border and " · chybí" in its heading.
- **Right aside:**
  - "Před otevřením" checklist: ✓/! items. The "!" items are links that focus the field. Same logic as `VotingReadiness`.
  - Navy "Co uvidí porotce" preview: the eyebrow, plus/minus pips from the current form values ("0/?" when unset), and the negatives line.
- **Sticky navy save bar:**
  - the status text, e.g. "Neuložené změny · koncept lze uložit i neúplný";
  - "Zahodit";
  - "Uložit kategorii" (white);
  - "Otevřít hlasování": outlined, disabled until the category is saved and ready, with the tooltip "Nejdřív doplňte pravidla a porotu". It uses the existing activation confirmation.
- Frozen configuration renders read-only with the existing lock text. The existing comparison flow (`VotingSetupComparison`) appears as a panel above the sections.

### 5.15 Voting progress (`AdminProgress.dc.html`)

- H1 "Průběh hlasování", "Načteno {HH:MM}", and "Obnovit" (manual refresh stays manual).
- **Four KPI tiles:** "Odevzdané lístky x / y", "Čekající porotci", "Dokončené kategorie x / y", and "Ke kontrole" (amber when > 0; text from the existing problem data).
- **Filter pills:** "Čekající ({n})" (default), "Všichni ({n})", "Technická", "Veřejná".
- **Matrix table** (scroll box): rows are jurors (name + group), columns are active categories with "{name} · {submitted}/{eligible}" in the header, and a final "Akce" column.
  - **Cell pills:**
    - "✓ Odevzdáno" (green);
    - "Rozpracováno" (blue);
    - "! Neplatný návrh" (red);
    - "Bez návrhu" (dashed grey);
    - "— nehlasuje" (plain muted, not eligible).
  - **Akce:** "Kopírovat odkaz" + a "⋯" menu with "Zobrazit hlasy" (→ category results detail), "Odemknout odevzdaný lístek…" (→ existing unlock flow, D6), "Nahradit odkaz…", "Zrušit přístup…" (red). Every item keeps its existing confirmation.
- **Below the matrix:** a card per open category with "{name}", "Otevřeno · x z y odevzdáno", "Průběžné výsledky" and "Uzavřít hlasování…".

### 5.16 Results (`AdminResults.dc.html`)

- H1 "Výsledky", "Počítají se jen odevzdané lístky · načteno {HH:MM}", then "Obnovit" and the primary "Stáhnout XLSX" (existing export).
- **Category tabs:** pills "{name} · průběžný|finální".
- **Ranking card:**
  - H2 name;
  - a stage pill: "PRŮBĚŽNÝ VÝSLEDEK" amber or "FINÁLNÍ VÝSLEDEK" green;
  - the meta line "{type} · {groups} · {places} postupová/vítězná místa · odevzdáno x / y";
  - reason chips: the existing reason/problem texts (amber for a cut-off tie).
  - **Table** "Pořadí | Tým | + | − | Skóre":
    - Selected/advancing rows have the `--selected-plus-bg` background. The selection label sits next to the team name: "Průběžně postupuje", "Postupuje", "Vítěz", "Nerozhodnutá shoda" or "Mimo výběr" (existing labels).
    - Tied rows show a "shoda" tag. An unresolved cut-off group sits between 2 px dashed `--warning` borders on a `--warning-soft` background, followed by the existing boundary-tie sentence.
    - Existing zero-ballot and data-problem texts stay.
- **Aside:**
  - "Dokončit kategorii": progress, "Kdo ještě neodevzdal →" (→ progress filtered), "Uzavřít hlasování…" (existing), and the note "Po uzavření a odevzdání všech lístků se výsledek změní na finální.";
  - "Jak se počítá": "Skóre = kladné − záporné hlasy. Shodné skóre sdílí pořadí (1, 2, 2, 4)."
- **"Hlasy porotců" matrix** (D3), full width under the ranking:
  - H2 "Hlasy porotců · {category}" with the sub-text "Řádky jsou porotci, sloupce týmy v pořadí výsledků. Do výsledků se počítají jen odevzdané lístky."
  - **Filter pills:** "Všichni ({n})", "Jen započtení ({n})", "Technická", "Veřejná".
  - **Legend:** filled blue ✓ "kladný hlas", filled red ✕ "záporný hlas", dashed blue ✓ "uložený návrh — nezapočteno".
  - **Columns:**
    - "Porotce": sticky left; name + group.
    - One column per team **in ranking order**, header "{rank}." above the name.
    - "+ / −"
    - "Stav lístku"
  - **Cells:** 30 px badges:
    - submitted: ✓ filled `--primary` / ✕ filled `--destructive`;
    - draft: the same glyphs with a 1.5 px dashed outline, no fill;
    - empty: blank.
    - Each badge has `role="img"` + `aria-label` ("Kladný hlas: {team}", "Kladný, nezapočteno: {team}", "Záporný…", "Bez hlasu: {team}").
  - **Row order:** submitted (newest first), then saved drafts, then invalid drafts, then no draft. A 2 px divider separates counted rows from uncounted rows, and uncounted rows use muted names.
  - **Stav lístku:**
    - "Odevzdáno" green + "v {HH:MM} · započteno" (an empty ballot gets "· prázdný lístek");
    - "Uložený návrh" blue + "nezapočteno";
    - "Neplatný návrh" red + "nezapočteno · vyžaduje opravu";
    - "Bez návrhu" grey + "zatím nic neuložil".
  - **Footer rows:** "Započteno kladných", "Započteno záporných", "Skóre" per team. They are computed from submitted ballots only and must equal the ranking table. Add a unit test asserting this.
  - Footnote: "Součty v patičce se shodují s tabulkou pořadí výše."
- **Privacy constraint:** the matrix uses `resultsDetailSchema.jurorVotes`, which is available only on the category results **detail** (`/admin/results/votings/:id`). The event results overview stays aggregate-only, so:
  - On the overview route, render the tabs + ranking card from overview data.
  - The "Hlasy porotců" matrix is rendered only on the detail route. Each tab navigates to that category's detail route, and the detail route renders the full layout (tabs + ranking + aside + matrix).
  - Do not add juror identities to the overview endpoint.
- The XLSX export is unchanged unless the user asks.

---

## 6. Allowed API/contract changes (additive, read-only, admin-only)

You may add read-only fields or endpoints **only** to serve data the design shows that is not available today, under the existing admin session and authorization checks:

- **Event list cards:** per-event status, counts (jurors, teams, categories, open categories), and submitted/expected ballot totals.
- **Event nav:** counts and readiness (if not derivable from the data already loaded).
- **Teams:** the per-team category count.
- **Progress matrix:** per-juror × per-category progress for one event (today it is per category via `dashboardDetailSchema`). Prefer composing existing detail calls if that stays performant for about 30 jurors × 5 categories. Otherwise add one aggregate endpoint.

Constraints:

- No schema or migration changes.
- No changes to write paths.
- Results overview privacy stays as it is.
- Add zod contracts in `packages/contracts`, with API integration tests next to the existing ones (`npm run test:db`).
- Record each addition in `decisions.md`.

If a feature appears to need anything beyond this, **stop and ask**.

---

## 7. Phases (one per session, in order)

Each phase ends with:

- validation (§8);
- updated docs (`progress.md`, `next-session.md`, relevant wiki page(s), README summary line);
- a handoff naming the next phase.

Do not start the next phase in the same session.

| Phase  | Scope                                                                                                                                                                                                                                                                  | Artboards                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **R1** | Tokens + Inter; record decisions D1–D8; juror shell (header, tabs, rail, client-side tab switching with routes); category voting (budget, team list, blocked message, footer with Save, unsaved-change prompt, submit sheet, auto-advance, desktop 3-column, keyboard) | Main, JurorSubmit, JurorDesktop              |
| **R2** | Souhrn replacing review/confirmation (selection, multi-submit sheet, outcomes, changed-data notice); remove the old overview table and review page UI                                                                                                                  | Main (summary), JurorSummary                 |
| **R3** | Entry/landing, conflict sheet, closed category, empty state                                                                                                                                                                                                            | JurorEntry, JurorConflict, JurorClosed       |
| **R4** | Admin shell (two-row navy header, event switcher, status nav, settings view), login, event list (+ §6 data)                                                                                                                                                            | AdminSetup (header), AdminLogin, AdminEvents |
| **R5** | Jurors and Teams tables (inline editing styles, NOVÝ rows, paste bar/aside, row menus, sticky save bar, team category count)                                                                                                                                           | AdminJurors, AdminTeams                      |
| **R6** | Categories overview cards + category editor (sections, segmented controls, team checklist + order, readiness aside, preview, save bar)                                                                                                                                 | AdminSetup (upper), AdminCategory            |
| **R7** | Progress matrix (+ §6 data) and Results with the juror × team matrix (privacy constraint §5.16)                                                                                                                                                                        | AdminProgress, AdminResults                  |

When a phase replaces components, delete or adapt the old ones. Do not leave two parallel UIs.

---

## 8. Validation per phase (report real results only)

- `npm run check` (typecheck, lint, format check, unit tests, build).
- Run `npm run test:db` when the API or contracts changed (needs `npm run db:up`).
- Run `npm run test:e2e` (Playwright + axe, desktop/phone/dark projects).
  - E2E specs in `tests/e2e/` reference the old UI. Update selectors and flows to the new UI, but **keep every rule assertion**: limits, the negative-eligibility guard, explicit save, per-category submission, locks, conflicts, access errors, results ties and privacy. Never delete a rule assertion to make a test pass.
  - Add specs for the new behaviors: tab switching without reload, the unsaved-change prompt, auto-advance after submit, keyboard voting, juror-matrix totals equal to the ranking, and admin row menus.
- Do a visual check of every screen touched, against its artboard at 390 px and 1440 px (and 1280 px for juror desktop), in light and dark. Record the screenshots' location in `progress.md`.
- In `progress.md`, list anything you could not verify. Do not claim it passed.

---

## 9. Final anti-drift checklist (run before handoff)

- [ ] Every string in the touched screens matches §5 and the artboard exactly.
- [ ] No voting, validation, lock, link, results or privacy behavior changed (diff `packages/voting-domain`, results services: untouched).
- [ ] "Uložit návrh" exists and keeps its enable/disable logic; there is no autosave.
- [ ] Juror category switching causes no full page reload; the URLs still deep-link.
- [ ] Pending decisions D4–D6 are implemented as their defaults and are listed as pending in `decisions.md`.
- [ ] Touch targets, contrast, focus handling, dialogs and axe all pass; dark mode is checked.
- [ ] No new dependency other than `@fontsource-variable/inter`; no migration.
- [ ] Code style rule (§1.8) is followed in all touched code.
- [ ] Docs are updated; there are no commits unless the user authorized them.
