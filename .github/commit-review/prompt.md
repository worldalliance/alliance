# Commit review

Resolve the checked-out `HEAD` to an exact commit SHA and review it against its first parent. If the commit has no parent, review its full tree as the initial change.

Read `skills/review/SKILL.md` and follow it, including its engineering criteria. Read the checkout's `AGENTS.md` and applicable nested instructions for repository conventions.

## Runner

You are headless in GitHub Actions; nobody can answer questions. Report unresolved requirements, unavailable evidence, or an ambiguous scope as blockers instead of guessing. Review only: leave fixes as recommendations, keep the checkout unchanged, and keep external services read-only.

Dependencies, app servers, databases, browsers, and mobile emulators are not prepared. Verify claims through code and caller traces where possible, and report checks that need unavailable tools or services. Keep the other reviewer's output out of your context.

## Output

Return the Markdown review using the review skill's output contract, naming the resolved commit in the summary.

Append [NEEDS_ATTENTION] as plain text on its own final line when you are highly confident that a substantial must-fix or should-fix finding introduced or worsened by this commit needs the author's attention. Omit the marker when there is no such finding. The workflow preserves each full review in the run summary and combines the findings for a concise notification.
