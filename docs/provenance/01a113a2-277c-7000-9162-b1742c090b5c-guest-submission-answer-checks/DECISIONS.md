# Decisions

## Scope: the two issues plus review findings 1 and 2

Finding 1's member-path note is included because finding 2's narrowed
parameter type makes the member path's `undefined` a compile error, so fixing
it is forced rather than added.

The first attempt also added a guard refusing guest submissions against a
schema with an unknown condition kind (commit `eaf368e3e`). It belongs to
neither Linear issue, so the redo leaves it out; finding 4, about that
commit's test, therefore has nothing to apply to. Raised with the user.

## Fix finding 1 at the two call sites, not in the shared evaluator

Making `common/src/forms/visibility.ts` never fall back to the current form's
answers would also fix it, for every caller, but touches shared code every app
uses. The user asked for minimal changes; the review's call-site fix plus the
narrowed type covers both server callers.

## No `fieldLookup` in the guest's visibility inputs

`stripHiddenAnswers` builds its own when absent, and after stripping every
remaining answer belongs to a visible field, so the checks give the same
verdicts with or without it (finding 3). Adding it would be an unneeded line.

## Tests

- ALL-1357: guest cases for Ranking and Range, as the issue names, reused from
  the first attempt, which the review found correct.
- ALL-1226: the one-line assertion the issue names, in the formula-options
  test that already runs for both member and guest. The first attempt's extra
  tasks e2e test for the same behavior is dropped as redundant.
- Finding 1: both cases (a field the respondent wasn't shown isn't required;
  an answer they gave is kept), run for member and guest the way
  formula-options parametrizes its hidden-field tests.

## One commit per issue

ALL-1357's commit carries the finding 1 and 2 fixes: it is the commit that
starts deciding a guest's checks from condition verdicts, so without them it
would ship the mismatch's 400s. ALL-1226's commit is the one-line save change
and its assertion.
