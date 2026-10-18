# Multi-category review and independent final submission

Phase 9 is DONE, finalized 2026-10-18. Validation and limitations: [progress](../implementation/progress.md).

## Approved workflow

The user explicitly approved selecting saved, valid, open categories on review and submitting them independently, with a separate outcome per category. Nothing is selected automatically. An explicitly saved empty draft is labelled and may be selected. An absent ballot is not an empty saved draft. Already-submitted, closed/archived, invalid, cancelled and unselected categories are not newly submitted by the review UI. Jurors may return later for remaining categories.

The overview and category navigation lead to `/wizard/review`. It shows current authorized categories in the established order, saved positive/negative team choices, item positions (distinguishing repeated names), validity, availability, save version/time, and submitted timestamps. Return-to-edit links restore the existing draft editor. Save corrections there before returning; unsaved component-memory edits are not included in review. The last category leads to review; every category has a direct review link.

Select eligible categories, choose **Odevzdat vybrané kategorie**, check the named categories/counts (including empty drafts), and explicitly confirm. Successful categories lock through the existing Phase 8 submission operation. Each result states success or a specific rejection; a closed/stale/invalid category cannot undo another success. No event-wide completion record or permanent completion of all future categories is created.

`/wizard/confirmation` is refreshable. Immediately after an attempt it shows that operation's outcomes. **Obnovit potvrzení**, a reload, or later direct entry derives current submitted/remaining states and timestamps from the database; the transient attempt report is not durable history. Unlock may change the current state back to draft. Returning to review never resubmits it without selection and confirmation.

## API

All routes inherit cookie/session/origin/custom-header/no-store guards and reject query claims. Administration cannot use juror review/final APIs. Ownership and current T/V membership are resolved server-side.

- `GET /wizard/review` returns `{current,categories:[{step,items,ballot}]}` under one shared event lock, with post-wait session recheck and batched owner snapshots/items. Only authorized non-draft categories and the current owner's choices appear. No read creates a ballot or history record. Current descriptions are read from shared teams. Validation is freshly derived; closed categories retain choices but report unavailable. Submitted state remains distinct from current availability/validity.
- `POST /wizard/final-submit` strictly accepts `{categories:[{stepId,expectedRevision,entries}]}`. The array must be nonempty and category IDs unique. `expectedRevision` is an integer from zero through the existing PostgreSQL integer maximum, never null. Entries use the existing UUID/sign contract. Unknown ownership, state, rules or other claims reject the whole envelope with 400 before writes.
- A normal 200 response is `{results:[{stepId,outcome:'submitted',ballot}|{stepId,outcome:'rejected',status,code}]}`, in request order. A normal per-category rejection carries 400, concealed 404, or 409. Do not interpret HTTP 200 as success for every category. Inaccessible/missing/draft/foreign categories share `NOT_FOUND`; no inaccessible metadata is returned.

Each selected category runs in its own exclusive event-first transaction. After acquiring the lock, it rechecks current session and statement-time expiry, event/group/category/item/rule state. Draft revision and entries must exactly match the saved reviewed version, independent of entry order. Absent or changed drafts return `DRAFT_CONFLICT`; the endpoint cannot manufacture new empty ballots or overwrite a draft with unreviewed choices. The existing Phase 8 operation then validates and commits state, entries, timestamp, revision increment and submission snapshot atomically. Validation-only reports grant no write authority.

The existing exact replay rule applies to an already-submitted ballot: entries match and submitted revision equals requested base + 1. Replay makes no write, even after closure, and returns freshly derived current validation. Other submitted/cancelled states cannot be edited. Unlock or later replacement makes old retries conflict. No new migration, dependency, unlock permission or history mutation is introduced.

## Recovery and revalidation

Normal category conflicts do not stop later categories. An infrastructure failure or session/actor loss aborts the HTTP operation and stops subsequent categories. Earlier independent commits survive, so the result may be partially unknown. Keep the exact confirmed request in memory and offer **Zopakovat stejné odevzdání** after connection recovery; accepted categories replay safely, while newer drafts/unlocks conflict. After session loss, protected content clears and the juror re-enters with the existing personal link. Reload current review/confirmation to reconcile committed and remaining categories. Do not infer rollback of earlier categories from a failed HTTP response.

Review revalidation never silently substitutes reviewed choices or selected versions. Changed saved data/availability requires **Načíst aktuální přehled**, which clears selection and confirmation and focuses the heading. Revoked category access removes its protected choices immediately, before that explicit load. Authorization loss clears all protected content. Cancel restores focus to the selection action; success/errors receive focus. Pending actions disable controls; phone labels/confirmation actions meet the 44px target. No autosave, background submit, automatic merge, push synchronization, or durable pending-attempt storage exists.

Validation evidence and limitations: [progress](../implementation/progress.md). Phase 10 dashboard, results, ties, deadlines and operational policies remain separate.
