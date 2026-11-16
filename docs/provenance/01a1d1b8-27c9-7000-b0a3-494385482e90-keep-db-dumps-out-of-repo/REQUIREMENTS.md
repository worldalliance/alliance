---
user: Alex Dorey
task: Keep staging database dumps out of the repository after one was committed by mistake
---

- `.gitignore` ignores a `db_dumps/` directory at any depth, not only at the repository root, so a dump `scripts/download_staging_data.sh` writes from inside `scripts/` is ignored too. (agent-proposed, user-approved)
- The root `AGENTS.md` states that database dumps, staging's included, stay out of commits, kept in `.scratch/` or an ignored `db_dumps/`. (agent-proposed, user-approved)
- The dump committed by mistake on `alex/kora-review` is removed by amending that unpushed commit, so it never enters history; the file stays on disk. (agent-proposed, user-approved)
- These changes land as one commit on `alex/kora-review`. (agent-proposed, user-approved)
