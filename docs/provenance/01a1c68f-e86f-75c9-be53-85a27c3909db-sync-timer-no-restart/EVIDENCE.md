# Evidence

## Incident

Observed 2026-11-10 on the staging host (Amazon Linux 2023, SELinux permissive). Commands run on the host by the user, deploy logs read with `gh run view --log`.

- `journalctl -u alliance-prod-to-staging-sync.service --since "2026-11-09 19:00"` lists two runs: 10:30:23 UTC (the schedule) and 17:31:44 UTC.
- `systemctl list-timers` showed LAST `2026-11-10 17:31:43 UTC`, NEXT `2026-11-11 10:30:00 UTC`.
- Deploy run 42864047090 (`aa09ab4683`) printed `installed alliance-prod-to-staging-sync.timer` at 17:31:48 UTC. The SSH step's output arrives when the step ends, so the `systemctl restart` ran just before.
- The deploys at 19:10 UTC on 2026-11-09 (run 42679084451, first install) and 00:14 UTC on 2026-11-10 (run 42725145450) restarted the timer and started no run.

## systemd source

Checked 2026-11-10 against github.com/systemd/systemd. The host's systemd version wasn't queried. The incident matches the code from `6546045` and not the v252 tag's code.

- [`src/core/timer.c` at v252](https://github.com/systemd/systemd/blob/v252/src/core/timer.c): `timer_start` clears `last_trigger` unless `Persistent=true`. `timer_enter_waiting` computes an `OnCalendar=` timer's next elapse from `last_trigger` when set. Otherwise it uses the unit's `inactive_exit_timestamp` if the timer is active, and the current time if not. An elapse already in the past fires at once. Primary source, upstream code.
- [Commit `6546045`](https://github.com/systemd/systemd/commit/6546045fa0bf84737bd8b2e1e8bf7dd3941d8352) (2023-05-23, "core/timer: Always use inactive_exit_timestamp if it is set") drops the active check, so a timer being started computes from its *previous* activation. With that code: 19:10 had no previous activation; 00:14's next 10:30 after 19:10 was ahead; 17:31's next 10:30 after 00:14 had passed and fired. Primary source.
- [systemd/systemd#36143](https://github.com/systemd/systemd/pull/36143) proposed reverting `6546045` for this reason ("the timer would always trigger immediately when started if the target elapsed at any time since the timer was last activated"). It was closed unmerged on 2025-09-26, labelled `replaced-by-newer-pr`. [systemd/systemd#38868](https://github.com/systemd/systemd/pull/38868) ("don't run service immediately after restart of a timer") is the fix that shipped: it stops `timer_start` clearing `last_trigger`, fixing [#31231](https://github.com/systemd/systemd/issues/31231) "Restarting timer triggers service start off-schedule". It is first in v259 (merge commit 10b2d192 is in v259-rc1, not v258) and was backported to v258.1 (c058ff41 on v258-stable). Vendor (upstream PRs and tags).
- `6546045` was backported to systemd-stable's `v252-stable` as [48445d27](https://github.com/systemd/systemd-stable/commit/48445d27c7), first in v252.11, and no `v252-stable` change to `src/core/timer.c` after 2023-07 brings the fix. Amazon Linux 2023's core repository metadata (cdn.amazonlinux.com) lists `systemd-252.23-15.amzn2023` as its newest systemd, and its RPM changelog names no timer patch through 2026-10-13. So an up-to-date AL2023 host carries `6546045` and not #38868. Vendor (upstream tags, distro repository metadata); the SRPM itself wasn't unpacked.
- `last_trigger` is serialized across `daemon-reload` (`timer_serialize`/`timer_deserialize_item` in the v252 file above). After reload, `timer_coldplug` re-enters waiting from it, so a reload with unchanged units computes the next 10:30 after the last run. Primary source.
- [systemd/systemd#16732](https://github.com/systemd/systemd/issues/16732), open: after `daemon-reload` with an edited `OnCalendar=` whose next time after the last trigger has passed, the timer fires at once. [#43659](https://github.com/systemd/systemd/pull/43659), open, proposes `CatchUp=` to turn that off. Vendor issue tracker.
