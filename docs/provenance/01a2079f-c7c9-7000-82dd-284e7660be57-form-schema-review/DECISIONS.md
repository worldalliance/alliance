# Decisions

## Keep our own format rather than adopt a standard one

Agent decision. A2UI, FHIR Questionnaire with SDC, SurveyJS, JSON Forms and XLSForm were compared (EVIDENCE.md, "Form formats compared"). None covers native React Native rendering, reading other forms' answers and member data, and results views together: FHIR is built around clinical vocabularies, SurveyJS would replace our renderers and builder and has no React Native renderer, JSON Forms can't express our logic, XLSForm targets field data collection, and A2UI is a streaming protocol for agent-driven UI that our stored forms already resemble. The new format instead follows the shape they share: one item tree, type separate from appearance, one expression language, declared inputs, stable ids.

## What a requirement is in the new format

Agent decision. A requirement is a step component the admin configures (which forum post, which contract), not something written as an expression. The action already stores the forum target this way: `forumParticipationPostId` takes priority over the form's validator in `server/src/actions/forum-action-completer.worker.ts:163-170`. Since requirements aren't inputs, the capture taken when a member's split group is fixed (ALL-2177, and ALL-2396 for inputs beyond lists and formulas) never holds them, matching their never driving visibility.

The facts/requirements split follows the code's own: `typeUsableForVisibility` (`server/src/tasks/entities/customvalidator.entity.ts:46-57`) already allows tag, community and has-phone checks in visibility and not the others. On the staging copy, step gates use only phone validity, forum replies and a signed contract (EVIDENCE.md, "Measurements"), so sorting checks by kind breaks no gate in use.

## Names

Agent decision, within the requirement against "custom". The old validator code keeps its names: renaming code ALL-2185 deletes is churn. In the new format each fact is a member attribute that expressions read, such as `member.communities`, grouped under "Member" in the admin input picker. "Attributes" is the most common term for this (EVIDENCE.md, "Names for member facts"). "Phone number is valid" checks the answer, not the account, so it becomes the phone field's own validation.

## Not recording which form a copy came from

Agent decision. No product found reads earlier answers by following copies, and the few that record a copy's source do so for audit (EVIDENCE.md, "Copies and lineage"). With nothing reading it, a `copiedFromFormId` column fails the root `AGENTS.md` YAGNI rule. The project scope in REQUIREMENTS.md uses explicit question keys, which don't depend on lineage.

## Explicit question keys over field ids

Agent decision, settling a disagreement between the round's researcher (use field ids as REDCap's variable names) and its brainstormer and second opinion. Field ids survive across forms only because duplicating an action copies the schema verbatim (`apps/admin/src/pages/action-dashboard/useActionCommands.ts:69-75`); copying a page gives fresh ids (`apps/admin/src/lib/copyWithUniqueIds.ts`) and rebuilding a question by hand loses the id. REDCap's variable names are chosen deliberately, which an explicit key matches and a field id doesn't.

## Not answering cross-week questions through profile write-back

Agent decision. Write-back today targets fixed profile fields only (phone, time zone, city, reminder time, profile description and photo, notification and sharing settings, `server/src/tasks/form-profile-answers.service.ts`; and contract signing, `server/src/tasks/form-submission.service.ts`). Serving "last time you told us X" through it would need admin-defined member properties, a concept not approved, and would change the meaning from "what you said last time" to "your current X, from whichever form last set it".

## Linear edits to make after this PR merges

Agent decisions, from the requirements above unless marked. Each issue description gains a pointer to this directory.

- ALL-2184 (Forms on the new language): the new format's design and the extra logic in REQUIREMENTS.md, and requirements as their own kind. The design gives the staging forms' `custom` components (`action-share-url`, `share-url`, `share-info-publicly-toggle`) and their one `html` block a home in the new format before ALL-2185 starts (EVIDENCE.md, "Measurements"), since the format drops both kinds and the spec requires supporting every existing form (agent decision). Split it so rules that read only the form's own answers don't wait on fill sessions (ALL-2181); most rules read only answers (spec EVIDENCE.md, "Current usage volumes"), and this shortens the time two form systems run side by side (agent decision).
- ALL-2185 (Move existing forms): duplicate and paste produce the new format or refuse once the new system can express the form.
- ALL-2173 (Previous-answer inputs): per form now; project scope with explicit question keys added later.
- ALL-2181 (Fill sessions): record each requirement check's result and time.
- ALL-2175 and ALL-2191: absorb the row list.
- ALL-2384 (Rename to Formula): unblock it by renaming the old form system's `Formula` type (`common/src/forms/variables.ts`) now, so it no longer waits on ALL-2185 (agent decision).
- File a bug: the server never re-checks step gates (account checks, text and number limits) at submit; only the browser enforces them (`shared/forms/useFormValidation.ts:137-176`; `server/src/tasks/form-submission-validation.service.ts` checks required fields, option membership, selection and ranking counts, and list sizes, but not a field's `customValidatorId` step gate or text and number limits), while the spec requires every submission re-checked on the server (agent decision).
- File a cleanup: delete old-system features with no uses on staging (`requiredIfFormula`, the `random` and `sourceField` variable inputs, the `completedActionCount` condition) after checking production, as ALL-2190 (Retire the "non-US" tag) does (agent decision).
