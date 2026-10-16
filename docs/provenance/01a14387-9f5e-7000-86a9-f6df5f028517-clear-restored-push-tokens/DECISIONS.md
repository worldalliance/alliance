# Decisions

- The pruning lives in `scripts/restore_staging_data.sh` rather than `download_staging_data.sh` or a server-side guard: every path that puts staging data into a local database (`load_staging_data.sh`, and `new-worktree.sh` cloning the main checkout's database) goes through that restore, and the dump file itself never sends anything.
- Only `user_device."expoPushToken"` is cleared. The `push` table's tokens are a log of sends, not a target the server pushes to.
- `SEND_DEV_NOTIFS=1` in local `server/.env` stays as is; developers rely on it to test notifications against devices they register locally.
- The tokens are cleared even when `pg_restore` exits nonzero, since it does after ignoring any error while still loading rows (`RESET_LOCAL_DB=0` over an existing schema). The script then exits with `pg_restore`'s status and names it, so the incomplete restore still fails loudly, even when the clear also fails because `pg_restore` never created `user_device`.
