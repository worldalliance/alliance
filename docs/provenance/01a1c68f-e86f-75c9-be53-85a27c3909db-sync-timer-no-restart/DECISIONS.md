# Decisions

Agent decisions unless labeled otherwise. Facts cited here are in `EVIDENCE.md`.

- **Supersedes "`restart` the timer on each deploy" in `01a1c193-c5d8-7000-8a5b-cc1cba80460c-sync-systemd-timer/DECISIONS.md`.** On the staging host's systemd, a restart computes the next run from the timer's previous start, so the first deploy after each 10:30 sync started another one (**Incident** and **systemd source**). `daemon-reload` reloads edited unit files and keeps the timer's last trigger across the reload, so the next run is computed from that trigger, and `enable --now` starts the timer only when it isn't running.
- **Accepted: changing `OnCalendar=` can still run the sync once, on the deploy that ships it,** if the new time falls between the last run and the deploy. This is upstream's catch-up on reload (systemd/systemd#16732), which has no off switch in the host's version. Schedule changes are rare, and the next one can be timed to avoid it, so a comment above `OnCalendar=` in the timer unit says how.
- **Accepted: a timer someone stopped by hand gets started by the next deploy, and the host's systemd may run the sync right then** if a scheduled time passed since its earlier start. Stopping it by hand is not a supported state. `disable` it as well to keep deploys from starting it.
