# Evidence

Checked 2026-11-09 by a research subagent reading the linked pages. Status per the root `AGENTS.md` **Established practice**.

## Question

What is established practice for keeping a scheduled job on one long-lived EC2 host in version control? No formal standard or published research covers this case; choosing among host-level mechanisms is judgement.

## Findings

| Finding | Status | Source |
| --- | --- | --- |
| AL2023 doesn't include cron by default, and AWS recommends systemd timers over it | vendor recommendation | https://docs.aws.amazon.com/linux/al2023/ug/cron.html |
| `user_data_replace_on_change = true` destroys and recreates the instance on any user data change | vendor documentation | https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/instance.html.markdown |
| User data runs only at first launch by default | vendor documentation | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html |
| GitHub `schedule:` runs can be delayed or dropped under load | vendor documentation | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| State Manager associations run on creation and edits unless apply-only | vendor documentation | https://docs.aws.amazon.com/systems-manager/latest/userguide/state-manager-about.html |
| `Persistent=` catches up missed runs and defaults to false; an already-active unit isn't restarted | vendor documentation | https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html |
| A oneshot service has no start timeout by default | vendor documentation | https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html |
| Service output goes to the journal by default | vendor documentation | https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html |
| The journal is capped by default at 10% of the filesystem, 4G at most | vendor documentation | https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html |
| `crontab` from stdin replaces the whole table | formal standard (POSIX) | https://pubs.opengroup.org/onlinepubs/9799919799/utilities/crontab.html |
| Cron doesn't catch up runs missed while the host was down | common practice, no primary text checked | none |

## Measurements

Run by the user on the staging host, 2026-11-09:

- `crontab -l` lists one entry, the sync.
- `timedatectl`: UTC.
- `/etc/os-release`: Amazon Linux 2023 (2023.7.20250414).
