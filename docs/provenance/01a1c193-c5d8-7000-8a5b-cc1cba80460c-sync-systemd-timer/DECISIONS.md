# Decisions

Agent decisions unless labeled otherwise. Facts cited here are in `EVIDENCE.md`.

- **Keep the run time at 10:30 UTC, written with an explicit zone.** The host's cron fires at 10:30 in the host's zone, UTC. The timer names UTC so the time doesn't move if the host's zone does.
- **`Persistent=false`.** A catch-up after downtime could fire during the workday and drop staging's database for the swap (`scripts/sync_prod_to_staging.sh`). A missed night is reported by the dead man's switch. This matches cron, which doesn't catch up.
- **System unit with `User=ec2-user`,** so `~`, `db-sync.env` and the locks stay as they were under cron. `PATH` under systemd covers cron's `/usr/bin:/bin`.
- **No `RandomizedDelaySec`:** one job on one host. **No `TimeoutStartSec`:** a oneshot has no start timeout by default, and the script has its own locks.
- **Ship the units in `nest-build.zip`,** beside the script they run, so a backend deploy that fails or rolls back exits before installing them.
- **Keep the deploy's existing "never fails the deploy" contract for the install.** Staging's sync is not a reason to block a deploy; the failure posts a workflow warning and the dead man's switch reports a schedule that stops firing. Origin of the contract: reconstructed from `.github/workflows/deploy.yaml`.
- **`restart` the timer on each deploy,** so an edited schedule takes effect. A timer stopping doesn't stop the service it triggered, so this doesn't kill a running sync.
- **The deploy removes the old crontab line, after the timer is running.** Left in place, both would fire and `flock` would skip one with a Slack `:no_entry:` every night. If any install step fails, cron stays. A crontab that can't be read or written gets its own workflow warning, since the timer is running by then and both will fire; only a host with no cron or no crontab counts as nothing to remove. Marked `BACKCOMPAT(sync-timer)`, to delete once staging's crontab no longer lists the sync.
- **`~/sync_prod_to_staging.log` is left on the host.** It no longer grows, and deleting history isn't part of this change.
- **Assumption, not checked on the host: SELinux isn't enforcing.** AL2023's default is permissive; under enforcing, systemd could refuse to run a script from a home directory.
- **Rejected:** Terraform `user_data` (any edit replaces the host), GitHub Actions `schedule:` (62-minute `run-on-host` cap, `staging-hosts` role trusts only `deploy.yaml`), `crontab -` from the deploy (replaces the whole table, and AL2023 has no cron by default).
