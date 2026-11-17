# Decisions

Follows the "Lasting opt-outs" and "Admin view" decisions in `docs/provenance/01a1eaae-fe8a-7000-b0ec-77dbaebdfbd4-kora-lazy-assignment-spec/DECISIONS.md`, with these choices made while implementing them.

## Storage and use

- `kora_reviewer.optOutCategories` is a `text[]`, default empty. Each accepted save merges the export's `optOutCategories` into it in one `UPDATE`, so two saves at once can't drop each other's categories. Nothing removes from it. (agent decision, implementing REQUIREMENTS.md)
- `candidates()` leaves out transcripts in those categories, which covers both new assignments and the home page's offer. (agent decision)
- The migration also fills the column from every assignment's saved export, so opt-outs made before this ships count too. (agent decision)

## Review tool

- `mountKoraReview` takes an optional `optOutCategories`, and the export repeats them, so each assignment's export still lists everything the reviewer has skipped, as KORA reads it. It's optional because the example and preview hosts have no reviewer history. (agent decision)
- The review state returns the reviewer's `optOutCategories`. The frontend checks them with `parseKoraCategories` before mounting, so an unknown category fails loudly. (agent decision)
- The content warning's body now ends "You can skip this pair, or every pair on this topic, now and in later batches.", because skipping a whole category can't be undone. The export schema's description of `optOutCategories` says the same. (agent decision)

## Admin view

- `GET /kora/admin/categories` returns one row per category with pairs in an open batch: pairs, reviews still needed, and reviewers opted out. Rows needing the most reviews come first. (agent decision)
- Reviews needed adds up, per pair, its target minus the reviews that count toward it, never below zero. Assignment and the admin view share that count (`COUNTED_REVIEWS`, with `OPEN_BATCH`, in `server/src/kora/kora-pool.ts`), so they can't drift apart. (agent decision)
- The table sits in its own "Categories" section after Transcripts on `/kora-participants`, labelling categories with the review tool's reviewer-facing names (`@alliance/kora-review/categories`). Retiring, reactivating, deleting and uploading batches refresh it. (agent decision)
