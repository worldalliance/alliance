# Split ActionEventReminderService under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file. The split follows the first of the cohesive splits `codex exec -s read-only` proposed for the file, as `AGENTS.md` directs:
  - `ReminderGroupService` (`reminder-group.service.ts`): reminder group create, update, delete and listing, building group fields from the DTO, attaching the deadline event, timing anchor candidates and their validation, and `assertExcludePreviouslyNotifiedAllowed`.
  - `ReminderPreviewService` (`reminder-preview.service.ts`): keyword context and the email and text message previews.
  - `ActionEventReminderService` keeps notification planning: due groups, per-group plans, already-notified coverage, the notification schedule, sent notifs for a group, community members for group-leads nudges, and the pure plan helpers the worker uses.
- Callers inject the service that now owns the method they call. No route, DTO, or behavior changes.
- `ActionsService.findReminderAnchorCandidates` only forwarded to the reminder service. The controller and tests call `ReminderGroupService.findReminderAnchorCandidates` directly instead, so the already oversized `actions.service.ts` does not grow from the extra injection.
- One commit per extracted service, each with its callers, so each typechecks alone. The last one removes the waiver.

## Left as found

- `MissedDeadlineCandidate` and `ActionEventReminderService.getPersonalizedSendTime` have no callers. That predates this change.
