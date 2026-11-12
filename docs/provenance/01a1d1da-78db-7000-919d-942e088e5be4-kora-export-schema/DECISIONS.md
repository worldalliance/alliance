# Decisions

- `propertyOrder` is renamed `x-propertyOrder`. It is not a 2020-12 keyword, and Ajv's strict mode rejects unknown keywords; an `x-` name signals a vendor annotation. A strict Ajv still needs `ajv.addKeyword("x-propertyOrder")`. Agent decision.
- `comprehension_answer` is null exactly on practice pairs, enforced both ways. The user's draft enforced only that non-practice pairs have an integer, while its description already said practice pairs carry null. Agent decision.
- `$id` uses `https://thealliance.org`, the domain the repo uses everywhere, instead of the legacy `worldalliance.org` (root `AGENTS.md` naming). Agent decision.
- The description's list of rules the schema cannot check gains `completed_at` not before `started_at`, `pairs_completed` matching the judgement rows, and `total_time_ms` being the sum of `time_ms_pair`. Agent decision.
- `maxItems: 26` on `opt_out_risks` is dropped; `uniqueItems` over the 26-value enum already caps it. Agent decision.
- The array conditionals on `children_age_bands` carry `type: array` so Ajv's `strictTypes` accepts the schema. Agent decision.
- `docs/kora/` over `server/src/kora/` or `kora-review/`: nothing reads the schema yet, and the review tool exports a different, per-assignment shape (`kora-review/src/schemas.ts`), so the contract isn't the tool's. It can move next to a server exporter once one exists. Agent proposal, approved (see REQUIREMENTS.md).
- Assumption: the spec citations (sections, Annexes B–D, A- and E-numbers) are the user's, from KORA_SPEC.md, which is not in the repository; they were not checked. Origin: the user's draft.
- Known gap, not addressed here: the review tool does not yet record comprehension answers, attention pairs, the six screen timers, `first_time_on_risk`, share units, `last_login_at` or a skips table, so no current export can fill this schema. Reconstructed from existing code.
