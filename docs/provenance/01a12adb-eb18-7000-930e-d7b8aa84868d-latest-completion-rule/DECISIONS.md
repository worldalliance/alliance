## Decisions

- The shared lookup is `PrerequisiteProgressService.loadCompletions`, beside `loadTerminalUserIds`: both cohort services and `ActionsService` already reach `ActionVisibilityModule`, which provides it.
- It loads the scope's terminal activities and keeps each (member, action) pair's latest with `findLatestCompletions` in `action-activity-status.ts`, built on `findLatestTerminalActivity`, the function behind the member's own status, rather than a second SQL rendering of the rule. Scopes are one action or one member, so the rows loaded stay small.
- Update recognition (`ActionUpdateRecognitionService.plan`) applied the same rule inline; it now calls `findLatestCompletions` too, keeping its own query for its transaction and `taskFormResponse` relation.
- `findIncompleteUsersForAction` stays unchanged: it subtracts completions from participants, and participants still re-add every member with any completion, so applying the rule there alone would list a member who completed then withdrew as not yet done. It moves with the participants follow-up.
- No backfill migration: the stored count corrects itself on the action's next completion or withdrawal. On staging, one action (160) is one too high.
