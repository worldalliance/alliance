---
user: dengjulie
task: Redo ALL-1357 and ALL-1226 on a fresh branch, avoiding the issues a review of the first attempt found
---

## From the user

- Uncommit everything on the branch and start fresh.
- Tackle the original two Linear issues, ALL-1357 and ALL-1226.
- Avoid the list of issues a review of the first attempt (PR #473) found. The
  user pasted the review; its findings are summarized below.
- Keep changes minimal: the user is newer to the codebase and is starting with
  small bug fixes.
- Update PR #473 with the redone work; force-pushing over the first attempt's
  commits is approved.

## The two Linear issues (issue text, not written by the user)

- ALL-1357, "Guest form submissions skip the answer checks member submissions
  get": `submitFormPublic` never runs the per-field checks
  `validateFormSubmission` runs for members, so a guest can store a range
  answer outside the options, skip a required field, exceed a multiselect's
  `maxSelections`, or send an invalid ranking or list card count. The issue's
  fix: extract the user-independent part of the per-field loop into a helper
  called from both paths; add guest cases to the "Range field validation" and
  "Ranking field validation" e2e tests in `server/test/tasks.e2e-spec.ts`.
- ALL-1226, "Guest submissions save answers to hidden fields unstripped": the
  guest path saves the raw answers. The issue's possible fix: save the stripped
  answers (`dto: { ...submitFormDto, answers }`) and extend the hidden-field
  e2e test in `server/test/formula-options.e2e-spec.ts` to assert the stored
  guest answers omit the hidden field.

## The review findings to avoid (written by a reviewer, pasted by the user)

1. (Must-fix) Guest submissions evaluate cross-form conditions differently
   from the guest's browser. The guest's visibility inputs omit
   `previousAnswerData`, so a condition on another form's answer
   (`sourceFormId`) reads the current form's answer of the same id; the
   browser passes `{}`. Once the guest path runs the checks and saves the
   stripped answers, a guest can get a 400 for a required field they were
   never shown, or have an answer they filled in silently dropped with a 201.
   Suggested fix: `previousAnswerData: {}` in the guest inputs, with guest e2e
   tests for both cases. Related older bug: the member path passes `undefined`
   when the member has no earlier responses; always passing the object fixes
   it.
2. (Should-fix) Every `ConditionExtras` field is optional, so nothing forces a
   caller of the shared checks to pass `previousAnswerData`. Suggested: narrow
   the parameter to
   `ConditionExtras & Required<Pick<ConditionExtras, "previousAnswerData">>`.
3. (Nit) A doc comment claimed omitting `fieldLookup` changes the checks'
   results; it doesn't, because hidden answers are already stripped.
4. (Nit) The unsupported-condition-kind guest test asserted only the 500
   status, not the message.
