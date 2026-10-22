# Decisions

- Use a separate manually dispatched workflow and Claude Code with the screenshot workflow's model and OAuth secret. Keep automatic push reviews unchanged.
- Offer an explicit review skill selector; pass the review target as text so descriptions and revision ranges reach the agent intact.
- Keep workflow tooling in the dispatch checkout and put the selected source snapshot in a sibling checkout with full history. This keeps current review instructions available for older commits and across agent checkouts. Nesting the source inside the tooling would make Claude Code also load the tooling's `CLAUDE.md`, so an older snapshot would be reviewed under two sets of repository rules.
- Name the helper directory `.github/manual-review/` after its workflow, as `.github/pr-screenshots/` is; the push-triggered workflow is already named `commit review`.
- Refuse a source commit on no branch or tag of this repository, and tell the agent not to fetch pull request refs. Installing, hooks, and tests run the source's code with the OAuth token in reach, and the repository is public, so a fork pull request could exfiltrate it.
- Install dependencies and provide ephemeral Postgres for verification. Let the reviewer select relevant checks and report unavailable services.
- Publish the final Markdown in the run summary, with the transcript and base-review JSON as artifacts. Redact the OAuth token before publishing files; no PR or Slack messages are needed.

# Verification

- `actionlint`, the repository's shellcheck command, formatting, and `bun run test .github` pass (28 tests).
- Eight local executions of the workflow's review, redaction, and summary shell steps pass with Claude stubbed: both review modes, agent errors, missing results, empty results, CLI failure, missing base findings, and absent credentials. These also check literal input handling and token redaction.
- `bun run dupcheck` reports no new duplication. `bun run covercheck` finds no changed files in its source scan; `.github` has no package typecheck script.
- All three jobs in [the live comparison run](https://github.com/worldalliance/alliance/actions/runs/37548376118) succeeded. The default-branch manual-dispatch entry point is not published; the experiment used the temporary trigger below.

# Comparison setup

- Compare three commits: `c31ba721b` (conversation membership), `b49b433b1` (ActionSuite relation), and `d1c8fac43` (group assignment errors). Both methods start at `03c514621`, retain full history, and use `claude-opus-5-5` with the same review skills.
- Run the unchanged review job through a temporary push-triggered matrix on `charles/review-comparison-20261006`, because a new manual-dispatch workflow is not registered on main. Disable the inherited automatic push-review job on that branch to avoid its Slack messages.
- Give local reviewers the old `/review-base` prompt with the commit stat, plus review-only boundaries. Each receives its own worktree and databases. Keep reviewer findings independent, then compare supported findings, completed checks, duration, and usage. One pair per commit is exploratory evidence, not a reliable estimate of review quality.

# Comparison results

- All six reviewers completed with findings JSON. Both methods found the same conversation-membership nit, no ActionSuite findings, and the same group-assignment refresh-error edge case and commit-splitting suggestion. The local group-assignment review also noted a pre-existing lack of pending-button guards and unstable callback dependencies.
- Independently reproduced the refresh-error case using the installed API client and query-core: one successful write, followed by a rejected refresh, produces an error mutation and one caller error callback. The split suggestions are commit-organization judgments, not behavioral defects.
- Actions ran broader test suites in these samples. Review-step times were 181/324/307 seconds for Actions and 192/334/209 seconds locally, ordered c31/b49/d1c; Actions added about a minute of runner setup per job. CLI model-cost estimates totaled $2.26 for Actions and $2.24 locally; these are list-price estimates, not subscription charges.
- The ActionSuite agent emitted two successful result events after background work continued. The original filter concatenated both reviews. Added failing regression tests, changed the filter to select the last result, and replayed the real transcript successfully. A failed continuation also prevents an earlier successful report from being published.
