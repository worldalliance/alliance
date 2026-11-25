---
user: Charles Lien
task: Make the changes for ALL-2239, "Make the daily stats, action stats and invite-goal crons safe to run twice at once", the next issue in the Linear project "Cron locks that hold no connection", on the `cron-jobs` branch, and open a pull request.
---

# Requirements

1. Open a pull request from the `cron-jobs` branch for the Linear issue ALL-2239. (User-originated.)
2. Ambassador invite-goal notifications: two overlapping runs send at most one notification per goal and kind (halfway, ended). The check for an existing notification and the save of the new one happen in one short transaction that holds a per-goal lock until it commits. A failed save sends nothing, and a later run retries. No migration or backfill. (Agent-proposed, user-approved.)
3. Per-action stats are fixed in this pull request, and a test seeds an existing stats row to show a newer run's computation number replacing the stored one. Each action's row is written with an upsert, and a write applies only when it comes from a newer computation than the one stored. A computation's number is issued by the database when the run starts, so a paused older run can't overwrite a newer result. (Agent-proposed, user-approved.)
4. Daily stats, if this pull request fixes that job, which the user left open: the first snapshot of a day is kept. A run inserts the day's row and silently skips when it already exists, as the 20:00 run does today after the 08:00 one. (Agent-proposed, user-approved.)
