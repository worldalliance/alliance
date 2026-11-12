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

## Staging crontab

Observed 2026-11-10 on the staging host by the user: `crontab -l` as `ec2-user` printed nothing.

## Guarding the sync against off-schedule runs

Checked 2026-11-10. Question: what do systemd, deploy tools and published operations practice offer against a destructive scheduled job starting at an unscheduled time?

- Google's SRE book favours skipping a launch over risking a double one ("we prefer to 'fail closed' to avoid systemically creating bad state"), leaves whether a missed launch is acceptable to the job's owner, and says owners should monitor their cron jobs. Research-backed vendor practice. https://sre.google/sre-book/distributed-periodic-scheduling/
- Kubernetes CronJobs can create two Jobs or none, so Jobs should be idempotent; `startingDeadlineSeconds` skips a run that starts too late. Vendor recommendation, wording read partly through a summary. https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/
- No authoritative source prescribes a job checking its own run window; it is common practice. systemd's `ExecCondition=` is a documented pre-run gate, with no time-window recipe. Vendor docs for the mechanism. https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
- Healthchecks.io alerts when a ping is late, after the period or cron schedule plus the grace time; its docs describe no alert on an extra ping, so it catches missed runs only. Vendor docs. https://healthchecks.io/docs/configuring_checks/
- systemd upstream offers no off switch for catch-up when a reload changes `OnCalendar=`: [#43659](https://github.com/systemd/systemd/pull/43659), adding `CatchUp=`, is open and unmerged, and [systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html) doesn't mention the behaviour. Vendor.
- [systemd-run(1)](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html): a transient service runs "in a clean and detached execution environment, with the service manager as its parent process", taking variables only from `--setenv=`; `--uid=` (version 211) runs it as that user, `--collect` (version 236) unloads it "after it completed, even if it failed", and the page's examples read its output with `journalctl -u <unit>`. Vendor.
- [systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html): `AccuracySec=` defaults to 1min and `RandomizedDelaySec=` to 0, so a timer elapses within a minute of its `OnCalendar=` time. Vendor.
- [systemctl(1)](https://www.freedesktop.org/software/systemd/man/latest/systemctl.html): `disable` doesn't stop the unit and `enable` undoes it; `mask` makes a unit impossible to start by any route, `enable` included. Vendor.
- [`src/shared/install.c` at v252](https://github.com/systemd/systemd/blob/v252/src/shared/install.c): `unit_file_mask` links the unit's path in `/etc/systemd/system` to `/dev/null` through `create_symlink`, which returns `-EEXIST` when a regular file already sits there, before it checks `--force`. The deploy installs the timer there as a regular file, so `systemctl mask` fails on the staging host. Primary source; not run on the host.
- Ansible (`state: started`), Puppet's `systemd::timer` (`active => true`), NixOS's switch-to-configuration and Debian's `dh_installsystemd` all start a timer an operator stopped, and none has logic specific to timers or works around a restarted timer firing; only RPM's `try-restart` leaves a stopped timer stopped. Vendor source and docs. https://github.com/ansible/ansible/blob/devel/lib/ansible/modules/systemd_service.py, https://github.com/voxpupuli/puppet-systemd/blob/master/manifests/unit_file.pp, https://github.com/NixOS/nixpkgs/blob/master/pkgs/by-name/sw/switch-to-configuration-ng/src/main.rs, https://salsa.debian.org/debian/debhelper/-/raw/main/dh_installsystemd, https://github.com/systemd/systemd/blob/main/src/rpm/macros.systemd.in
