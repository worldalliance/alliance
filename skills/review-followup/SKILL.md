---
name: review-followup
description: Verify a base commit review, then apply accepted findings when asked.
disable-model-invocation: true
---

# Review input

Read `(root)/skills/review-base/SKILL.md` and `(root)/skills/review/SKILL.md` for the review contract and commit ownership rules. Use the review JSON the user identifies, or the sole JSON directly under `.scratch/review/`. If there is no unambiguous review, ask which one to use. The JSON's `base` is the reviewed snapshot; evaluate it against its parent, not the branch tip.

Invocation alone assesses the findings. If the user asks to apply or fix them, assess any undecided findings and then apply the accepted ones. Assessment does not authorize code or git history changes.

# Assess every finding

Assess only this round's review against the code and requirements, without consulting earlier rounds. The review skill's fresh-context rule permits reading the input review for this task. Read provenance `DECISIONS.md` only when applying changes. Agreement between reviewers is not evidence.

Assign each original handle one disposition:

- **Accept:** supported correctness improvement or a concrete improvement with no identified downside, including more accurate text or comments, safe deduplication, and verified dead code removal. Accept justified nits as well as defects.
- **Defer:** supported improvement outside this change's scope.
- **Drop:** false, redundant, or only a preference. Name the counterevidence or missing benefit.
- **Unresolved:** an available check or missing fact still prevents judgment. Perform the available checks and name what remains unknown.

Track required human actions separately from disposition. A confirmed finding can be accepted while its fix needs an account, permission, credential, or external setting from the user. State the exact action, why it is needed, what it blocks, and how to verify it afterward. Keep secret values out of the record. Reserve Unresolved for uncertainty about the finding.

Decide severity separately from disposition. Preserve supported findings when their tier changes. A valid defect does not establish that the reviewer's proposed fix is correct; verify the fix's assumptions and choose the smallest change that resolves the cause.

Check the parent before classifying a finding as pre-existing. Later commits may establish that a fix already exists, but cannot make a broken base commit pass on its own.

# Save the assessment

Preserve the review JSON. Write `.scratch/review/<base-sha>.decisions.md` with the reviewed SHA and one entry per original handle: disposition, tier, evidence, reason, and accepted fix or remaining question. Preserve earlier decisions and their reasons when recording a changed judgment.

Present accepted findings in the review skill's usual sections, followed by Deferred, Unresolved, Needs your attention, and Dropped. Save human actions under the affected handles in the decisions file. Link the decisions file. Assessment is complete when every input finding has a disposition and every unresolved finding names the check or information needed.

# Apply accepted findings

Follow review-base's Applying fixes section, including its git authorization and commit boundaries. Keep REQUIREMENTS files unchanged. Apply accepted findings at every tier; retain deferred, dropped, and unresolved findings in the decisions file.

Before changing behavior, reproduce the defect where practical and verify the fix with the same check. Run the required checks for affected packages and verify the resulting base commit on its own. Record incidental discoveries for assessment rather than folding unrelated cleanup into a repair.

Update the decisions file with each fix, verification result, and the original-to-resulting commit SHA mapping, including splits. Preserve the original review and decisions files so later rounds can compare snapshots. If the branch has changed since assessment, revalidate affected decisions before applying them.

Complete independent fixes even when another fix requires human action. Finish when every accepted finding is fixed and verified or explicitly reported as blocked. Report required human actions, unresolved potential blockers, and incomplete checks; their absence of confirmation is not a clean result. A fresh independent review is a separate invocation, not an automatic repair loop.

# Out-of-scope findings

When applying fixes, file a pre-existing finding in Linear only if it is a confirmed must-fix defect that remains on the current branch. Read `(root)/skills/linear/SKILL.md`, search for an existing issue, and reuse it when present. Record the issue link in the decisions file; if filing fails, retain the finding and report the failure.

Keep smaller improvements and uncertain claims in the decisions file, with enough context to revisit them. They are local follow-ups, not Linear tickets. Preserve these records and link deferred items in the final response.
