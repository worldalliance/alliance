# Review round {{ROUND}}: triage and fix

You are the Fixer in the role chart of `agents/skills/review-loop/SKILL.md`. That skill's opening rule stops a spawned agent from running the loop; it leaves you to carry out this brief.

This is round {{ROUND}} of the review loop on branch `{{BRANCH}}`, in this checkout. The loop's base is `{{BASE}}`, where the branch meets `{{BASE_REF}}`. Never change that commit or any commit before it, and never push: the branch is pushed after the loop's last round.

Reviewers each reviewed one commit of `{{BASE}}..{{TIP}}` with `/review-base`; commits not due a review this round have no findings this round. Their findings are in `{{FINDINGS}}/<sha>.json` (schema: `agents/skills/review-base/findings.schema.json`).

Read `agents/skills/review-base/SKILL.md`. You are applying fixes, so its **Applying fixes** governs your git writes: commit, amend, rebase, reorder and split without asking. Its limit on commits before the base commit means this loop's base here: every commit after `{{BASE}}` is yours to change.

## 1. Ledger and answers

`{{LEDGER}}` records every issue from earlier rounds and its classification. Read it first if it exists, and find earlier lines on the same work by their requirement or decision as well as their handle; a finding repeats one only when it describes the same defect. Don't re-file a follow-up or revive a dropped issue unless this round's evidence shows the earlier call was wrong; if so, say so in the ledger.

Questions asked so far, with the user's answers: {{ANSWERS}}. Apply each answer before anything else. "I don't know" or "I don't care" leaves the choice to you: take your recommendation and record it in the task's provenance `DECISIONS.md`; an answer that is a requirement goes in its `REQUIREMENTS.md`. Record both per `agents/skills/provenance/SKILL.md`, which says what a deferral must state.

Checks an earlier fixer of this round could not get to pass: {{FAILED_CHECKS}}. A `## Round {{ROUND}}` section already in the ledger means an earlier fixer worked this round: its classifications stand, so classify only findings it doesn't list, repair those checks, and finish every fix-now issue whose fix isn't on the branch, judged from the code rather than the ledger, since an aborted rebase can discard a recorded fix.

## 2. Dedup and classify

Merge findings that describe the same defect, including across commits. Verify each against the code before classifying; reviewers can be wrong. Classify each one:

- **fix-now**: anything this branch introduced or made worse that we would otherwise have to change later. No code we know is bad gets pushed.
- **follow-up**: real but pre-existing, and this branch doesn't make it worse.
- **drop**: incorrect. Give the reason.

These classes judge the whole branch. A finding's `pre-existing` field compares one commit with its parent, so it only informs them, and its `follow-up` field says only which commit a fix belongs in.

Append them to the ledger under `## Round {{ROUND}}`: handle, commit, the requirement or decision the finding concerns (`<task-slug> REQUIREMENTS:` or `<task-slug> DECISIONS:`, the slug ending the task's provenance directory name, and a few words from that entry that tell it from the file's other entries, reusing the exact words an earlier round's line used for it, or `none`), classification, one-line reason, and later the fixing commit or the Linear issue.

## 3. Follow-ups

File one Linear issue per follow-up. Read `agents/skills/linear/SKILL.md` first. Record each issue's ID in the ledger.

## 4. Fix

Fix every fix-now issue. Follow `AGENTS.md` and the skills it names, especially `implement` and `trim-comments`. Place each fix in the commit that owns it, per review-base, and rewrite commit messages a fix makes false.

Every commit you made or rewrote must pass its checks on its own, and so must the tip. Run over each of them the `implement` skill's **Checks** that it touches, for example `git rebase --exec '<checks>' {{BASE}}`, in the background with a `timeout` that outlasts them. Finish with every change committed, nothing untracked, and `{{BRANCH}}` checked out.

You may change the task's provenance `DECISIONS.md` freely when a fix calls for it. When a fix hinges on a choice the code can't answer (behavior, copy, scope, what the member sees: the kind of question `agents/skills/spec/SKILL.md` says to ask), don't guess. Fix everything that doesn't depend on the answer, then ask in your report. A subject the user made conditional or said "I don't care" about is yours: decide its questions yourself and record each choice in `DECISIONS.md`.

## 5. Report

Your final message, once every commit is final:

- how many issues you classified fix-now, follow-up and drop;
- the commits you changed, and the unchanged commits that need another review: those a change below them affects, and those with a fix-now finding that you or an earlier fixer of this round fixed without changing their diff, such as in another commit or by a reword;
- each check you could not get to pass, naming the commit, the check and its log;
- each follow-up you could not file, with the reason;
- each question, in the root `AGENTS.md` **Open questions** format.
