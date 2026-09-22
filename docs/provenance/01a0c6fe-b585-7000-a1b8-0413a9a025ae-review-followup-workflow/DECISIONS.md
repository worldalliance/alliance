# Decisions

- Extend the existing review-base workflow in agentic-workflows with assessment and apply nodes. Preserve step-by-step execution so the user can inspect the assessment before applying.
- Run Codex non-interactively with JSON events and the requested permissions. Resume the assessment's exact session for fixes. Select Astra, matching the user's reviewer choice.
- Archive review records outside the checkout before clearing .scratch. Use ~/.local/state/alliance/agentic-review, respecting XDG_STATE_HOME. Start fresh reviewer and assessor sessions each round; keep archive paths out of their prompts.
- Separate finding validity from required human actions. Apply independent fixes, then mark the round needs-attention when human action, unresolved blockers, or unfinished verification remain. A structured final report supplies this status while preserving the skill's Markdown report.
- Keep review and fix policy in the skills; workflow prompts name the skill, review file, and requested phase.
- Test with fake agent executables so validation cannot rewrite real git history or file Linear issues.
- Resolve fake executables by absolute path in tests; changing process.env.PATH did not change Bun's executable lookup in the installed runtime.
- Add an explicit accepted-finding count to Codex's structured report. A zero count in assessment and apply, together with no required attention, gates the reviewed-commit push.
- Capture the selected remote tip and origin draft tip before the agents run. Use exact leases for both pushes. Require the reviewed commit's sole parent to be the captured selected tip, so publication advances it by only that commit.
- Back up the committed branch tip after apply and before reporting required attention. Use origin/draft/<local-branch>; dirty files are not committed by the backup step. A failed agent run does not trigger either push.
- Write raw process chunks to external archive files before parsing them, preserving invalid JSON, stderr, and partial output from canceled runs. Stop the process if writing its logs fails.
