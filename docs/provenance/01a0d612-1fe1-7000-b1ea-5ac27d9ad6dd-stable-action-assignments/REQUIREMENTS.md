---
user: Charles Lien
task: Specify stable action assignments with configurable prerequisites
---

# Scope and stability

- The user identified that changing city or time zone can switch an active action or manufacture a missed action after its deadline. The change must cover all action assignments, not only country conditions.
- The saved decision is the new source of truth for “is/was a user assigned an action?” The user accepted the agent's proposed scope covering member task lists and completion permissions, admin/leader history, reminders, dependent cohorts, participation statistics, welcome queues, and suspension accounting across the apps.
- Once a member receives an action and can see it on their home page, ordinary profile changes must leave that assignment fixed. Those changes affect following weeks. Exclusions must also be retained once decided.
- Use current information when prerequisites resolve. In the interview example, a member living in the US at launch who changes to Canada before resolving the prerequisite must receive the non-US version. The user rejected launch-time profile snapshots for pending assignments.
- The user prefers a simple implementation and avoiding storage of transient prerequisite states. They care about the resulting behavior more than the storage design.
- The user invoked the spec workflow.

# Prerequisites and outcome selection

- The user accepted the agent's proposal to distinguish audience conditions from prerequisites explicitly in admin configuration.
- Admins must be able to configure both completion and noncompletion of a previous action as conditions for a subsequent action. In either outcome branch, the previous action can be a prerequisite; this is not limited to successful completion.
- “The action is over” refers to the member-action deadline, not the office's resolution phase.
- A completion or “won't complete” activity resolves a prerequisite early. Waiting for the deadline is needed when the member has not supplied a terminal activity, such as an eventual missed action.
- The user accepted waiting for all explicitly configured prerequisites before making the assignment decision.
- Evaluate with the latest information at that decision. Once assigned and available on the home page, later completions or other changes must not switch the assignment. The user accepted retaining the first resolved selection, including exclusion from its alternative.
- For an existing member whose action is intentionally delayed by a prerequisite, the user accepted the agent's recommendation to preserve required status and the original deadline. This is distinct from late membership, which retains existing optionality.
- Determine the meaning of completion/noncompletion from the existing code and preserve it. The user believed noncompletion meant no completion activity but explicitly requested checking the code rather than treating that belief as authoritative.
- The user accepted treating finalized exclusion from a prerequisite as an early resolution if it does not substantially complicate implementation.
- After the agent verified positive `InProgressAction` uses in staging actions #81, #87, and #128, and negated uses in #83 and #142, the user chose: “try to keep the existing behavior.” The user later clarified that this meant no existing action's cohort may break or change.
- The agent showed that each of those five actions launches hours before its upstream action's deadline, so a prerequisite expresses the same wait. The user then asked to remove `InProgressAction` from the admin cohort builder for a nicer admin experience. The user noted that staging data matches production for these actions.

# Existing member behavior

The user selected preserving existing behavior in each area below. The summaries of that behavior were supplied by the agent during the interview; the source implementations and integration choices belong in DECISIONS.

- Country predicates keep their current Boolean meaning. The user explicitly specified: USMember means known US; NonUSMember means known non-US; NOT USMember includes unknown and known non-US. Unknown location does not acquire a new special pending state.
- Late membership: regular actions are optional for a member signing during their window; joining after closure does not assign the old action. An account created before launch but first signed afterward is also a late admission.
- Onboarding: preserve pre-signing eligibility, rolling enrollment, and the existing rule excluding members whose first contract predates the onboarding action's start.
- Away ranges: preserve existing end-user behavior, including the effects of edits and deletion. The user did not accept restricting retrospective changes to staff. They delegated storage design to the agent and requested that prescription be recorded in DECISIONS, not as a user requirement.
- Contract events: preserve the existing effects of suspension, resignation, and re-signing, including the distinction between interruptions inside an action's window and events after its closure.
- Reminders: preserve the distinction between individually optional late-signer tasks and actions marked optional for everyone, whose reminder settings currently govern inclusion.
- Completion permission: the user accepted preserving access to a previously assigned action after a location change. They also selected preserving existing voluntary completion of unassigned actions, including eligible people without active contracts and a newly eligible alternative after moving. Voluntary completion does not create a retrospective required assignment.
- Withdrawal continues to resolve prerequisites where the existing expressions permit it. Completion, withdrawal, and dismissal remain distinct from assignment.

# Staff changes

These policies were proposed by the agent and accepted by the user, who said these edits are not expected to happen in ordinary use.

- Cohort edits affect unresolved decisions and new enrollments. Changing an existing assignment or decided exclusion requires an explicit staff correction with a recorded reason. Include an admin view of the decision and its reason.
- Deadline extensions apply to existing assignments. Moving the start time does not rerun resolved enrollment or replace decisions.
- Shortening a deadline applies to existing assignments after an explicit warning and retains their original assignment decisions.
- Reopening preserves decided assignments and exclusions, resumes unresolved prerequisites, and admits new members under the usual late-joiner rules. It does not rerun resolved cohort selections.

# Migration and delegated decisions

- The user explicitly permits assuming that historical cohorts have not changed: “whatever the calculation is now (or at migration time), we can store that.” Backfill uses that calculation; reconstructing earlier profile history is not required.
- The user delegated the handling and presentation of pending assignments and processing failures to the agent, expressly requesting that the prescribed behavior be recorded in DECISIONS rather than REQUIREMENTS.
- The user accepted the agent's scope recommendation to leave public guest actions, follow-up-form targeting, and random form-variant selection outside this change, except for adjustments needed to consume saved action decisions correctly.
