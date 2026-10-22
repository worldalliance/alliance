# Manual review

Run the review requested in `$OUTPUT_DIR/request.json`. You are headless in GitHub Actions; nobody can answer questions. Resolve the target to exact commits and state them in the summary. If the description is ambiguous or the target is unavailable, report the blocker and the clarification needed instead of choosing a different scope.

## Instructions

Read `$REVIEW_TOOLS_DIR/skills/$REVIEW_SKILL/SKILL.md` and follow it. When it references the review skill, engineering criteria, or findings schema, use the copies under `$REVIEW_TOOLS_DIR/skills/`. These belong to the workflow's revision; the source checkout can predate them. Read the source checkout's `AGENTS.md` and applicable nested instructions for repository conventions.

The current directory is the source checkout, with full history, initially at the requested checkout commit. Interpret `HEAD` in the request against that initial snapshot. The review target may differ from it. For `review-base`, resolve one commit and verify that snapshot against its parent, as the skill requires. For `review`, establish the requested diff before inspecting it and run checks at the snapshot whose behavior is being reviewed.

## Runner

Local git writes needed for checkout or isolated verification are authorized in this ephemeral runner. Review only; leave fixes as recommendations. Keep all GitHub and other external services read-only, and put temporary files in `.scratch/`. Fetch no pull request refs or other remotes: the runner holds a credential, so only commits on this repository's fetched branches and tags may run here. Report any other target as unavailable. `$REVIEW_TOOLS_DIR` is a separate tooling checkout, not the source being reviewed.

Dependencies are installed for the initial checkout. After switching commits, install dependencies for the snapshot being checked using its lockfiles. Bun, Node, and Postgres 17 on localhost:5432 are available; `PGHOST`, `PGUSER`, and `PGPASSWORD` authenticate to the disposable database service. Create synthetic databases or fixtures as needed. There is no staging data, app server, browser, or mobile emulator prepared; report checks requiring unavailable services as incomplete.

## Output

Return the Markdown review as your final message, following the review skill's output contract. Include the resolved scope, completed checks, and blockers in the summary. The workflow publishes that message in the run summary and `review.md` artifact.

For `review-base`, initialize and maintain `$OUTPUT_DIR/findings.json` instead of `.scratch/review/<base-sha>.json`, using the skill's schema. This location survives source checkouts and is collected by the workflow. Keep output files free of credentials and personal information; use synthetic values in reproductions.
