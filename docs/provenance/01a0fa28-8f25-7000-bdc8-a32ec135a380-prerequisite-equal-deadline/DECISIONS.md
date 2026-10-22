# Decisions

## Change the shared check, not the server message alone

`checkPrerequisiteDeadline` in `common/src/prerequisite.ts` is the single rule. The server's validation and the admin's open-reference warning both call it, so relaxing it there keeps the warning's "add it as a prerequisite" suggestion in step with what the server accepts.

## Rename `NotFirst` to `AfterDependent`

With equal deadlines allowed, the failure no longer means "not first". The enum is internal to `common`, the server validation, and their tests.

## Skippers are decided by the closed-enrollment path

With equal deadlines, a member who never finishes the prerequisite becomes ready at the instant the dependent closes, since both use `hasMemberActionDeadlinePassed` (`deadline <= now`). The existing closed-enrollment path in `CohortDecisionService.resolveAction` decides them: obligated members are excluded with `ResolvedAfterDeadline`, so no missed obligation arises; others are decided by the cohort. They become ready at the instant the dependent closes, not after, so the doc comment's "become ready after the dependent closed" still states the constraint.

## Decide closed actions before the decisions that read them (its own commit, before this one)

Review found that until the pass decides such a member on the closed dependent, readers take its live cohort and count them in it, so a `MissedActionDeadline` leaf reads them as having missed it. A decision made in that window (by the pass, a member's read, or `decideOpenAction`) kept the wrong reading for good. The fix reuses the closed-enrollment code rather than mirroring its rule in the readers: the pass decides closed actions before open ones, each after the closed actions whose decisions it reads (`MissedActionDeadline` leaves, the only ones that read decisions), and the member-read and one-shot writers first decide, in the same order, the closed actions their open actions read directly or through each other. Actions the pass would backfill (`belongsToBackfill`) are left to it, since deciding one early would take it out of backfill. Closed actions that read each other in a cycle are decided in an arbitrary order. Each closed action takes a fresh session, and open actions one that has read no closed action's decisions: a session never invalidates, and deciding one action of a cycle caches both actions' decisions before either is written, which a shared session would hand to every later reader. A member's read skips open actions they can't be admitted to and closed actions they are already decided on. A closed action that fails to decide holds back its readers rather than let them take its live cohort: the pass skips them until a later pass, a member's read leaves them to the live cohort for that read, and a one-shot reader fails. Review also found the unordered closed phase predated this branch; it is fixed here rather than filed, since it is the same defect one level down.

It is a separate commit placed first because it is safe on its own and the equal-deadline rule depends on it. The signing writer decides a member on closed actions too: it runs only once everything the signing request writes has committed (`ContractService.announceSigned`), so a task-form signer's answers are already saved. The code stays in `CohortDecisionService`, past its 500-line guideline, because it calls the service's private `resolveAction` and `insert`; splitting it out would mean exposing them.

## "Didn't finish" branches can't place same-deadline skippers

A follow-up that selects members who didn't finish a prerequisite sharing its deadline can't reach them in time: their outcome is known only as the follow-up closes. This is inherent to equal deadlines, so the admin open-reference warning says so for such references instead of the resolver trying to place them.

## Late finishers are left to admins

A member who finishes the prerequisite just before a shared deadline is assigned the follow-up with little time left. The user dismissed this (ALL-1376): admins handle it case by case.

## Warn only on real lag (ALL-1377)

`ResolvedAfterDeadline` decisions used to log at warn, as processing lag. Shared-deadline skippers now produce them routinely, so the pass logs every decision at log level and warns only for obligated members who were ready before the deadline. That check (`PrerequisiteProgressService.filterReadyBefore`) counts only completions, withdrawals, and exclusions written before the deadline: a plain readiness check at one millisecond before it would count a prerequisite exclusion written at the deadline, and so warn along a chain of prerequisites sharing one deadline. The reason value is unchanged (no enum migration); its doc comment covers the shared-deadline case.
