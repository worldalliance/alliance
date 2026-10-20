# Member analytics action rule

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## The shared rule

- `countsTowardMemberAnalytics` in `server/src/analytics/member-analytics-action.ts` excludes public-only and onboarding actions. Every member metric has applied both exclusions since it was written: the completion curve's `showInChart` (`fa701bb8c`, onboarding added in `ed429bda4`), platform tenure (`8492b481f`), completion retention (`2fc1810aa`), and missed actions (`989bc291a`). A flag that once sat beside them, `everyoneShouldComplete`, had to be removed from two of the copies by hand (`ed429bda4`). A future flag of the same kind belongs in all of them.
- The `showInChart` API description names the rule rather than listing its flags, which it had left onboarding out of.
- It lives in the analytics module rather than beside `Action`, because the rule is about what the metrics measure, not about the action. No SQL form of the filter exists in the analytics services, so there is no SQL twin. The `onboarding = false` filters in `ActionsService` belong to the activity feed, which is a different rule.

## Per-metric choices kept at the call sites

- Optional actions: completion retention takes an `includeOptional` parameter (`2fc1810aa`); platform tenure always excludes them; missed actions excludes them through `canMissActionDeadline`, where the missed-action rule owns that decision (missed-action-rule provenance); the action stats chart keeps them and exposes `optional` so the admin page filters per chart.
- Whether the member-action phase has started, or merely exists, also differs per metric and stays where it is.

## Left as found

- `ActionStatsAnalyticsService.getActionCompletionCurves` re-checks `onboarding` on read, which `showInChart` already covers; the admin `StatsPage` re-checks `onboarding` alongside `showInChart` too.
