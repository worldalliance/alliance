# Decisions

1. **CI shellchecks the three scripts by name (requirement 4)** rather than switching to `scripts/*.sh`, which would also pull in the worktree scripts and their sourced libraries, each needing directives or `-x`. The sync's one finding, SC2016 on the bcrypt regex, gets a directive. Agent decision.
2. **The implement skill's shellcheck command now points at the CI step** instead of repeating its file list, which had already drifted (it lacked `scripts/with_db_env.sh`). Agent decision.
3. **ALL-2262 and ALL-2243 stay out of this PR**, to keep it to the sync's exposure and race fixes. Agent decision.
