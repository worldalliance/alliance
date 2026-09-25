# Implementation specification

These are agent-authored choices and interpretations implementing REQUIREMENTS. They are not evidence of independent user-authored storage or architecture requirements. No application implementation is included in this task.

## Final decisions, derived readiness

Persist final action/member decisions and their resolution time. Distinguish an included member from a decided exclusion; absence of a decision means evaluation is still needed, not exclusion. Derive prerequisite readiness from saved upstream decisions, activities, and member-action deadlines. A persistent Pending enum or copied location/answer snapshot is unnecessary.

The saved decision fixes cohort admission and nothing else. It replaces the `inCohort` input to the existing pure rules (`computeAssignmentCore`, `computeActionAssignment`); obligation stays derived at read time from contract events, away ranges, and the action. Required status cannot be known at decision time anyway, because `computeAssignmentCore` requires an active contract across the whole window, which ends in the future. Those rules already make a mid-window signer optional (`ContractGap` with a contract at the deadline) and a post-deadline signer unassigned, and they keep a prerequisite-delayed member who was signed at launch required. Storing an admission kind would duplicate them. An interruption can excuse a saved assignment without erasing the fact that it was issued. Deadlines are not copied, because extensions apply to existing assignments; explicit schedule changes follow the staff policies in REQUIREMENTS.

Cohort expressions carry no contract term; the one in `computeIsTaggedOrInManualCohort` belongs to general updates. The resolver therefore reuses the population cohort path unchanged, contract changes keep flowing through `computeAssignmentCore` at read time, and a contract-less member gets no row instead of a permanent exclusion.

The action's `optional` flag stays live, and the server rejects edits to it once the action has decisions. Staff edits are not expected in ordinary use, so failing loudly is cheaper than a snapshot column plus a correction flow.

Finalize at launch for members ready then, or when the last prerequisite resolves for a member ready later. Use live profile, tag, leadership, manual-cohort, and answer information in that evaluation. Save both admissions and exclusions before exposing the result. Decisions are issued independently of a member actually opening the app; the home page reads the result, rather than becoming the first place membership is decided.

Regular-action enrollment remains available to people who sign or re-sign while the window is open. A lack of active contract before that admission is not by itself a permanent cohort exclusion. Onboarding may enter enrollment before signing. Draft/future actions do not issue final decisions merely because staff preview them.

The resolver skips a member it cannot yet admit, such as a regular action's unsigned account, and writes no row for them. Signing triggers their evaluation. Readers treat a missing row for such a member as unassigned without reconciling it. Missing decisions therefore needing work are limited to admissible members, so the catch-up job and task-list reconciliation do not re-evaluate every unsigned account against every open action.

A regular action's enrollment cutoff is its member-action deadline, matching the existing `hasActiveContractAt(deadline)` test. Onboarding has no cutoff, because `computeAssignmentCore` still assigns it to members who join after its deadline; an onboarding member is admissible when `computeContractSignedAfterOnboardingStart` holds, so unsigned accounts get decisions and members whose first contract predates the start get none. At the cutoff, stop issuing new ordinary assignments; keep waiting distinguishable from a decided cohort exclusion so an explicit reopening can resume unresolved work. Completion permission after the deadline is a separate policy. Member-action start and deadline boundaries use a shared comparison throughout readers and processing.

## Explicit prerequisite configuration

Represent explicitly configured prerequisites as a set of action IDs, separate from the existing cohort expression. A prerequisite only says what to wait for. Outcome selection stays in the cohort expression, through the existing CompletedAction and NOT CompletedAction leaves, so there is one place that selects and no second outcome field to contradict it. Both outcome branches retain the prerequisite gate, and the expression is evaluated only after all configured prerequisites resolve.

A reference inside the general cohort expression does not automatically add a prerequisite. Existing definitions retain their expression semantics, and backfill does not infer new prerequisite gates from those references. Form-answer targeting can use an explicit prerequisite when its answer should be awaited.

Prerequisites replace `InProgressAction`, so the cohort builder stops offering it. All five production uses (#81, #83, #87, #128, #142) launch the evening their upstream action is due. The leaf only told apart members still working on X during those few hours, which is what waiting for X expresses. Existing expressions keep the leaf and evaluate unchanged; the builder renders it read-only, and the server rejects newly added `InProgressAction` leaves. Validate dependency cycles rather than silently producing permanently waiting assignments.

Validation also enforces timing, because a delayed member keeps required status and the original deadline:

- A prerequisite must have a deadline. Otherwise a member who never completes or withdraws waits forever.
- A prerequisite's deadline must precede the downstream action's deadline. Otherwise readiness can arrive after the downstream deadline and issue an already-missed required assignment.
- Editing either deadline re-runs this check. A violating edit is blocked with a message naming both actions.

The downstream enrollment cutoff does not end waiting for a member who was in the population at launch; this is a prerequisite delay, not late membership.

Without a configured prerequisite, a cohort expression is evaluated once, at decision time. Some expressions previously relied on live recomputation to admit members later: `CompletedAction(X)`, `MissedActionDeadline(X)`, or `FormFieldValue` on a still-open X. Under saved decisions, those expressions freeze an early exclusion. The editor warns when an expression references an action that will still be open at this action's launch and has no matching prerequisite. No open action had such a reference at specification time; before readers switch, a report confirms that is still so.

A configured prerequisite is ready for a member when any of these holds:

- A completion or withdrawal activity exists for that member and action.
- Its member-action deadline has been reached.
- Its saved cohort decision is a finalized exclusion, using the inexpensive early exit the user accepted.

An unresolved upstream decision does not count as exclusion. Dismissal does not resolve a prerequisite. Optionality or an away exemption alone does not resolve it. If there is no deadline, the deadline branch stays unresolved; completion, withdrawal, or finalized exclusion can still resolve it.

Readiness is derived afresh until the downstream decision exists. If one prerequisite ends Tuesday and the member completes it Wednesday while another keeps the downstream action waiting until Thursday, Thursday's evaluation sees that completion. No Tuesday outcome needs storing. Subsequent activity leaves Thursday's decision fixed.

## Existing predicate semantics and reconciliation

The source at specification time is `ActionsService.computeIsInCohortExpression` and `ActionEventRecipientService`:

- CompletedAction asks whether a USER_COMPLETED activity exists, not whether the latest terminal activity is completion.
- NOT CompletedAction is the Boolean complement within the candidate population. A withdrawal alone is not a completion.
- MissedActionDeadline requires a passed deadline, required participation, no completion or withdrawal, and no away overlap. Optional actions yield no missed members. Dismissal does not exclude a member from this condition.
- FormFieldValue matches any stored response satisfying the condition, rather than automatically selecting only the latest response.
- City country determines US membership when available; time zone is its fallback. Preserve the unknown-location behavior specified by the user.

Use those existing meanings for outcome selection. Preserve the separate latest-terminal-activity rule for displaying completion/withdrawal status; this change does not redefine the activity taxonomy.

The single-member and population paths disagree on `InProgressAction`: the single-member path skips the population path's required-and-present roster check. For `MissedActionDeadline`, both paths already checked optionality, contract, away, and terminal activity. Both treated the deadline instant as not yet passed while the pill treated it as passed; the shared `hasMemberActionDeadlinePassed` comparison fixes that. Otherwise the two paths agreed: the population path found its window start with `events.find` rather than `memberActionPhase`, but `UQ_action_event_one_member_action` allows one member-action event per action, so both pick the same event. `computeMissedActionDeadline` in `server/src/utils/action-user.ts` now holds the rule for both.

The `InProgressAction` split needs no fix. The leaf is false on both paths once its upstream action leaves member action, every existing use's upstream has, and no new use can be added.

`MissedActionDeadline` stays in the builder. Its one existing use (#142) sits beside `NOT FormFieldValue` on the upstream action's own form, which already includes every member who missed, so #142 does not depend on which meaning applies. Use one shared predicate with the population meaning, because it already drives reminders, participation, and missed-action accounting. Explicitly test the late-signer and away cases.

## Away, contract, and voluntary participation

Use the current pure contract and away rules against saved cohort admission. Continue deriving away overlap from the user's current saved ranges, including retrospective edits and deletions. A separate historical away-snapshot table or staff-only editing policy would change the accepted behavior without solving cohort drift.

The initial assignment classification is not a replacement for exemption checks. A member away for any part of the window remains selected but is excluded from required participation accounting. Contract gaps retain current optional/unassigned behavior, including re-signing, while the issued decision remains inspectable. There is no resignation event: `ContractEventType` has only `SIGNED` and `SUSPENDED`, so the contract behavior to preserve is suspension and re-signing. How a resignation is recorded outside contract events is not established. Dismissal continues to hide the card and mute reminders without rewriting the decision.

Keep completion authorization distinct from obligation. A saved admission preserves the assigned route after a profile change; action-level completion restrictions still apply. For an unassigned action, existing live voluntary-completion rules can still authorize a submission. Such a completion produces activity, not a new required assignment. This permits voluntarily completing an alternative without switching the action originally assigned.

Preserve onboarding's earliest-contract-event rule and unsigned-member behavior. Preserve regular late-signing optionality and the closed-window cutoff. These behaviors are implemented in `server/src/utils/action-user.ts`; use that code as the compatibility baseline rather than interpreting account creation as membership start.

## Processing and failures

Resolve assignments through a common service used by launch processing, membership changes, prerequisite activities, and deadline processing. Include catch-up for missed work and reconciliation before returning a supposedly complete task list. Retries and concurrent requests must produce one final decision per member/action. A task form's answers commit before its completion activity, so a resolver never reads part of a submission. Dependents resolve outside the member's request: readiness is derived and the resolver is idempotent, so a resolver failure leaves work for catch-up instead of rejecting the member's completion.

Evaluate alternative actions against consistent inputs so one location edit cannot cause both country branches to be selected during a single decision batch. Keep this scoped to assignment evaluation rather than storing general profile history.

Ordinary waiting prerequisites stay off the home page until resolved. Processing failures return a temporary loading/error state instead of a successfully empty list or exclusion, and processing retries automatically. Operational failure lives in logs and an alert on catch-up backlog, not in a table. A processing failure that first exposes an action after closure must not create a fresh missed obligation: catch-up that decides after the member-action deadline writes an exclusion whose reason names the late resolution. Existing voluntary-completion rules still let that member complete if they are otherwise eligible. This exception concerns processing failure, not intentional prerequisite timing, which retains the original deadline and obligation.

## Staff edits

Apply cohort edits to undecided/new enrollments. Store the issued decision's reason and preserve prior values and the staff-supplied reason when correcting it. The admin view exposes assignment/exclusion, resolution time, reason, and explicit correction. Use existing staff authorization; a new permission hierarchy or bulk reassignment product is unnecessary.

Changing optionality for an issued action is rejected, per "Final decisions, derived readiness". Deadline shortening warns before it affects existing assignments. Reopening preserves finalized exclusions as well as admissions, resumes unresolved work, and admits later members optionally under the accepted policy. Moving a start event retains the original decision history.

## Backfill and integration

Backfill launched actions from their calculated cohort/assignment state at migration time, using the user's explicit historical-stability assumption. Preserve actual activities, exemptions, and voluntary completions separately. Future/draft actions remain undecided; onboarding remains open to subsequent members. Existing contract-ineligible accounts must retain their ability to enter an open regular action if they sign later. Existing `InProgressAction` expressions backfill with their current evaluation, which is false for the leaf because every upstream action has left member action.

The existing source has different single-user and roster results for some cases, so migration must report those discrepancies and apply the shared rule above deliberately. Compare the computed pre-cutover decisions with saved post-cutover results; investigate differences beyond that named reconciliation before switching consumers. Unknown historical profile reconstruction and a separate legacy-confidence model are unnecessary under the user's assumption.

Replace cohort recomputation as the assignment source for feeds/details, status tables, reminder recipients and embedded task lists, prerequisite assignment checks, welcome queues, counts, analytics, and suspension plans. Preserve each consumer's existing additional filters, such as exemption, dismissal, completion, and optional-reminder settings. Keep wire compatibility for installed clients' legacy participation fields. Follow-up-form eligibility, public guest actions, and form-variant selection keep their separate policies.

## Acceptance checks

Implementation is complete when focused tests and cross-consumer integration checks establish all of the following:

1. US/non-US membership changes before readiness affect the selected branch; changes after decision affect neither selection nor exclusion, including after the deadline.
2. Completion and withdrawal resolve prerequisites early; no terminal activity waits for the member-action deadline. Multiple prerequisites all resolve before selection, and an inexpensive finalized-exclusion early exit works.
3. Both completed and noncompleted branches wait for their configured prerequisite. Late completions and answer changes before the decision are considered; changes after it do not reroute.
4. Existing `InProgressAction` cohorts evaluate unchanged, the builder offers no new `InProgressAction` leaf, and the server rejects one. `MissedActionDeadline` uses the population meaning on both paths. Negated conditions and completed/not-completed/missed semantics retain their distinct meanings.
5. Unknown location obeys ordinary Boolean country predicates, without a special pending-location state.
6. Mid-window signing is optional, after-deadline joining adds no old obligation, pre-existing unsigned accounts can still enroll, and onboarding retains its unsigned/new-member timing rules.
7. Away creation/edit/deletion, contract interruption/re-signing, dismissal, withdrawal, and voluntary completion preserve their separate effects without changing saved cohort admission.
8. Assigned submission access survives a location edit. Voluntary completion of an unassigned action does not manufacture a required assignment.
9. Staff corrections are explicit and attributable; deadline/start changes and reopening follow the accepted policies without automatic reselection.
10. Backfilled decisions match the chosen migration-time calculation. Member, admin/leader, reminder, analytics, and suspension consumers agree on the saved decision while retaining their documented filters.
11. Retries, concurrent evaluation, and processing failures neither issue conflicting decisions nor silently substitute exclusion for an unfinished calculation.
12. If stage 9 runs: each converted action's saved decisions and live cohort are identical before and after conversion.
13. After stage 10, no cohort expression references the All Members or Staff tag, and each rewritten action's live cohort matches its old one.
14. After stage 11, signing up adds no tag, the All Members, Staff, and EU tags are gone, and `allMembersParticipating` reports what it did before.

## Delivery stages

Each stage deploys alone and leaves production correct. The order puts the saved decision in place before anything reads it. Writers ship first and run in shadow. Staff tooling and prerequisites ship before consumers stop recomputing, so admins can express "wait for X" before decisions freeze. Rolling back a reader stage is safe because the writer keeps recording decisions underneath it.

### 1. One predicate, one boundary

Extract one `MissedActionDeadline` predicate used by the single-member path (`ActionsService.computeIsInCohortExpression`) and the population path (`ActionEventRecipientService.resolveCohortMemberIds`), with the population meaning as its baseline. Extract one member-action start/deadline comparison and route every reader and worker through it. Tests cover the late-signer and away cases for `MissedActionDeadline` and confirm positive and negated forms keep their structure.

Ships alone: the only behavior change is the deadline instant, which now counts as passed on both `MissedActionDeadline` paths. Everything else is a refactor with the suite green before and after.

### 2. Decisions table and resolver, shadow mode

Add the decision table with these columns:

- user and action
- included or excluded
- reason: launch, signing, or resolved after deadline
- resolution time

A unique constraint on user and action makes retries and concurrent evaluation converge on one row. The reason enum holds only the values a shipped writer produces; stages 3–5 add backfill, staff correction, and prerequisites resolved alongside their writers.

Add the common resolver. It decides at launch for members ready then, on signing or re-signing inside an open window, and from a catch-up job for missed work. It loads each member's profile once per batch so alternative country branches see the same inputs. It stops issuing ordinary assignments at the enrollment cutoff. It records the processing-failure exception as an exclusion with the resolved-after-deadline reason. It evaluates membership without the tag path's contract term. Draft and future actions get no decisions.

Launch processing and catch-up are one scheduled pass, every five minutes under an advisory lock. It decides admissible, undecided members of every started action whose enrollment is open, so it also decides actions already open at deploy, the same migration-time calculation the backfill would apply. A member admissible at the member-action start gets the launch reason; one who became admissible later, by signing or re-signing, gets the signing reason whichever writer reaches them first. A closed regular action stays in the pass for seven days after its deadline, where it writes resolved-after-deadline exclusions for members who held a contract at the deadline but have no row. A member without a contract across the whole window, such as one who signed or re-signed mid-window, is instead decided against the cohort with their usual reason: they were only ever optional, so a late decision creates no missed obligation, and excluding them would drop the optional entry existing rules give them. The same holds for every member of an action marked optional for everyone. The pass skips members who signed within the last ten minutes, longer than any signing request, because a task-form signer holds a contract before the form's answers and completion are saved.

The cutover is the earliest launch or signing decision in the table, which is the resolver's first pass; no settings table records a deploy time. A closed action with no decisions that launched before it belongs to the stage 3 backfill, since catch-up would otherwise apply the processing-failure exception to historical actions. One the resolver already decided, or that launched after the cutover, gets catch-up even if no pass succeeded during its window.

Each resolved-after-deadline batch logs a warning; it only occurs when earlier processing failed, so it is the catch-up backlog alert. The pass resolves and writes each action separately, so an action whose cohort fails to resolve logs an error without holding back the others. A signing is announced only after the request's other writes, so a member signing through the onboarding task form is decided with the answers and completion that form submitted. The signing writer runs the pass's population evaluator over a population of one, so both writers apply the same cohort rules. A failed signing decision logs an error and leaves the member to the next pass.

Nothing reads the table yet. An hourly check, under its own advisory lock so it cannot delay the decision pass, logs per action in the pass how many members' saved decisions disagree with the live population cohort, with a sample of their ids. No leaf results are stored, so the log cannot name the leaf that changed; it labels the expression instead. One without action or form references (`collectCohortDependencies`) can only diverge through profile changes or a staff edit to the expression; one with them can also diverge through activity after the decision, which is investigated. Contract state is not part of cohort membership, so it cannot cause a divergence here. Resolved-after-deadline exclusions are skipped, since they deliberately ignore the cohort.

Ships alone: additive table and writes; members see no change.

### 3. Backfill and discrepancy report

The scheduled pass writes decisions for actions launched before the cutover from the migration-time calculation, preserving activities, exemptions, and voluntary completions untouched. It leaves future and draft actions undecided and leaves contract-ineligible accounts free to enroll in open regular actions later. Every difference between pre-cutover computation and saved results is investigated before stage 6.

The backfill runs inside the pass rather than as a script, so deploying is the whole rollout: a manual run would need production credentials on a workstation, where booting the app context with a non-production `NODE_ENV` also grants `ADMIN_USER` admin. It owns exactly the closed actions ordinary catch-up would otherwise skip: no decisions, and launched before the cutover or with no cutover yet, however long ago they closed. Open and onboarding actions get ordinary decisions, and so does a closed action the resolver has decided. Within each, the backfill decides the members some pass would have admitted while the action was open, those holding a contract at any point in the member-action window, against the roster cohort as it evaluates at that pass, with a `backfill` reason. A deadline-only test would drop members suspended mid-window, whom a live-decided action keeps and participation analytics count. While any member it would decide signed within the signing grace period, it defers the whole action to a later pass rather than decide the others without them, since no later pass revisits a backfilled action. The first pass after deploy backfills every historical action while holding the pass's lock, so passes skip until it ends and a launch in that time is decided late. It runs ordinary decisions first, and staging data, a pruned copy of production, puts it well under the five-minute interval, so it is not capped per pass. Nobody is excluded for late resolution; these actions were processed live before the table existed. Once an action has rows it leaves the backfill, and catch-up finds no admissible member missing. An action nobody held a contract for gets no rows and stays in the backfill; each pass reaches it again but skips evaluating its cohort, rather than recording that the backfill ran.

After deciding a backfilled action, the pass re-evaluates each decided member through the single-member path (`computeIsInCohortExpression`) and logs a warning naming how many it places differently, with sample ids. That is the stage's single-member versus roster report, read from server logs. A failed comparison logs an error and never holds back the backfill. The pass runs ordinary decisions before backfill, so the comparison cannot delay launches. The comparison shares the pass's session, so each member's single-member lookups run once per pass. Against staging data the first pass backfilled 77 actions in about 3 seconds with no disagreements.

Ships alone: each action's rows are written in one transaction, so a failed pass leaves the action for the next, and the unique constraint absorbs a concurrent writer.

### 4. Staff tooling

Admin view of each member's decision: assignment or exclusion, resolution time, reason. Explicit correction with a required reason that keeps the prior values, under existing staff authorization. The server rejects optionality edits on an action with decisions. Shortening a deadline shows a warning naming the existing assignments it affects. Reopening preserves decided admissions and exclusions, resumes undecided work, and admits later members as optional. Moving a start event keeps decision history.

The admin view is a Cohort Decisions tab on the action dashboard, behind the existing `AdminGuard`. It lists members with a row; a member without one is undecided, which the tab says rather than listing every account. A correction flips `included` on an existing row, sets its reason to `staff_correction` and its resolution time to the correction, and appends an `action_cohort_decision_correction` row holding the replaced included value, reason, and resolution time, the staff note, and who corrected it. A history table rather than columns on the decision, because a decision can be corrected more than once. A correction that would not change `included` is rejected, and so is one for a member without a row: the resolver owns first decisions. The divergence check skips corrected rows as it skips resolved-after-deadline exclusions, since both deliberately depart from the cohort. The cutover still counts a corrected decision's replaced launch or signing time, so correcting the resolver's first decisions cannot send later closed actions into the backfill. The correction's reason column has its own enum type, because TypeORM regenerates a shared enum on every `migration:generate`; a new reason is added to both.

The server enforces the shortening warning, since an action's schedule changes through several endpoints (adding an event, adding a suite event, editing a suite event). Each runs in a transaction that compares the member-action phase before and after. If the deadline moves earlier, or a phase without a deadline gets one, on an action with included decisions, the server answers 409 with the affected actions and their assigned counts and rolls back, unless the request passes `acknowledgeDeadlineShortening`. The admin shows that message in a confirm and resends acknowledged. Extending a deadline, reopening a closed action, and moving the start need no guard: decisions store no deadline, the resolver never replaces a row, and reopening returns the action to the open catch-up path, where members who signed since are decided with the signing reason and the read-time rules make them optional.

Ships alone: staff can inspect and correct decisions before anything depends on them, so the first reader stage never strands a mistake without a fix.

### 5. Explicit prerequisites

Add prerequisite configuration to the action, separate from the cohort expression: a set of upstream action IDs. Outcome selection stays in the expression. Admin validation rejects:

- cycles
- prerequisites without a deadline
- prerequisite deadlines not before the downstream deadline

The cohort builder stops offering `InProgressAction` and renders existing leaves read-only; the server rejects new ones. The builder warns on references to still-open actions without a prerequisite. The open-action report from "Explicit prerequisite configuration" runs here, before stage 6.

The resolver derives readiness (completion or withdrawal activity, deadline reached, or finalized upstream exclusion) and decides once every prerequisite is ready, using live data at that moment. A member still waiting gets no row. The five-minute pass is the only trigger. Nothing reads decisions before stage 6, and its task-list reconciliation decides a member whose prerequisite just resolved, so triggers on activities, deadlines, and upstream exclusions would only shorten a wait no reader sees. A task form saves its response before the completion activity, so a pass that sees the completion also sees the answers. A member admissible at launch on an action with prerequisites gets the `prerequisites_resolved` reason; a signer keeps `signing`. Delayed existing members keep required status and the original deadline, because obligation stays derived at read time.

Prerequisites are an integer array on the action rather than a join table: the set is small, read whole, and never queried from the upstream side except by validation. Importing an exported action drops them, since action ids name different actions in another environment.

The live recomputation path treats a member whose prerequisites are not ready as outside the cohort. The configuration then takes effect for members immediately, and shadow comparisons stay meaningful. Every read of an action's live cohort goes through that rule, including the rosters `InProgressAction` and `MissedActionDeadline` leaves read. The divergence check keeps comparing decisions with the expression alone, since a decided member's prerequisites had resolved; follow-up forms and the admin's expression preview have no prerequisites.

Ships alone: existing actions have no prerequisites, so nothing waits until staff configure one.

### 6. Member-affecting consumers read decisions

Switch every surface a member feels to the saved decision:

- feeds and action details
- task lists
- completion permission
- reminder recipients and the task lists embedded in reminders
- suspension plans
- the forum-action completer

Each consumer keeps its existing filters (exemption, dismissal, completion, optional-reminder settings). Completion keeps the assigned route after a location change and keeps live voluntary-completion rules for unassigned actions, recording an activity and leaving the decision untouched. Before returning a task list, the server reconciles missing decisions for admissible members. An unfinished calculation returns an error instead of an empty list. Legacy participation fields stay on the wire.

These consumers move together so a member never gets a reminder for an action their home page no longer shows. Before this ships, confirm the web and mobile clients render a server error on the task list as a retryable state; if mobile needs a change, it ships and reaches users first.

Ships alone: stages 2–5 already populated and verified the data.

### 7. Staff, leader, and analytics consumers read decisions

Switch admin and leader status tables, participation counts, analytics, and welcome queues. Follow-up-form eligibility, public guest actions, and form-variant selection keep their own policies.

Ships alone: staff-facing reads only; stage 6 already made the member experience consistent.

### 8. Remove recomputation

Delete the live cohort recomputation paths that stage 6 and 7 consumers left behind, and the stage 2 divergence logging. The cohort evaluator remains for the resolver and follow-up-form targeting.

Ships alone: dead-code removal, after stages 6 and 7 have run in production long enough to trust.

### 9. Optional: convert existing `InProgressAction` uses

Rewrite #81, #83, #87, #128, and #142 as prerequisites and drop the leaf, then delete `InProgressAction` from the evaluator. Each rewrite must leave the cohort unchanged:

- #81: prerequisite #80; not manual users 154 or 111, and answered form 73.
- #83: prerequisite #80; manual users 154 or 111, or no answer on form 73.
- #87: prerequisite #84; completed #84 and did not answer "0" on form 78.
- #128: prerequisite #126; completed #126.
- #142: prerequisite #141; did not answer "Yes" on form 126, or missed #141.

Ships alone: cleanup after stage 8; decisions for these closed actions are already saved and must not change.

### 10. Computed All Members and Staff options

Add two cohort leaves: `AllMembers`, every user, the same universe `NOT` evaluates against (`findActiveUserIds`), and `Staff`, users with the `staff` flag that staff preview already reads. A migration rewrites every `Tag` leaf naming the All Members tag to `AllMembers` and every one naming the Staff tag to `Staff`, closed and archived actions included, so no expression references either tag afterwards. The builder offers both leaves.

In staging, All Members is the whole cohort of 60 actions and is ANDed with a `NOT Manual` exclusion on #11 and #133. Staff appears only on archived #82, which has no events and no decisions. Signup adds every new account to All Members (`AuthService.createReferredUser`), so the tag differs from every user only for accounts created some other way or removed by hand. In staging that is one admin account. Before this ships, count production users without the tag; a real member among them would join those cohorts. The Staff tag's seven members are a subset of the eight `staff` users, which no live action can notice.

Ships alone: after stage 3, so every closed action's decisions are saved before its expression changes. The hourly divergence check reports any member the rewrite moved.

### 11. Retire the All Members, Staff, and EU tags

Signup stops adding the All Members tag, `UserModule.onModuleInit` stops creating it, and `allMembersParticipating` checks for the `AllMembers` leaf; the field stays on the wire. A migration deletes the All Members, Staff, and EU tags; EU has no references. Their `tag_users_user` rows cascade. The builder renders a `Tag` leaf whose tag no longer exists, rather than failing, for the non-US deletion below.

The non-US tag stays until stage 7 has shipped. #149 (`NOT non-US`) and #152 (`non-US`), both closed, still reference it, so deleting it earlier would make #149 everyone and #152 no one wherever cohorts are recomputed live: suspension plans until stage 6, and staff status tables and analytics until stage 7. After stage 7 staff delete it by hand from the admin; until stage 8 removes the divergence check, it logs both actions as diverged.

Ships alone: after stage 10, since new members must keep getting the All Members tag while any expression references it.

### Acceptance checks by stage

| Stage | Checks                          |
| ----- | ------------------------------- |
| 1     | 4 (`MissedActionDeadline`)      |
| 2     | 1, 5, 6, 11 (shadow table)      |
| 3     | 10 (backfill)                   |
| 4     | 9                               |
| 5     | 2, 3, 4 (`InProgressAction`)    |
| 6     | 7, 8, 10 (member consumers), 11 |
| 7     | 10 (staff consumers)            |
| 9     | 12                              |
| 10    | 13                              |
| 11    | 14                              |
