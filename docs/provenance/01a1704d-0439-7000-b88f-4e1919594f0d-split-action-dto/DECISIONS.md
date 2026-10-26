## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split. Each group of DTOs moves verbatim to a sibling file in `server/src/actions/dto/`, and its importers import it from there:

- `reminder-group.dto.ts`: reminder-group create, preview, and response DTOs, and the timing-anchor candidate.
- `action-update.dto.ts`: `ActionUpdateDto` and its create and update DTOs.
- `action-event.dto.ts`: `ActionEventDto` and its create and update DTOs.
- `action-activity.dto.ts`: `ActionActivityDto`, its form-response output, the activity create, update, opt-out, and withdrawal DTOs, and the welcome queue.
- `action-feed.dto.ts`: the global, timeline, and home feed items.
- `action-suite.dto.ts`: `ActionSuiteDto` and `CreateActionSuiteDto`.
- `scheduled-plans.dto.ts`: suspension and forum-autocomplete plans and their overview.
- `user-action-status.dto.ts`: the viewer's status on an action.
- `action-reviewer.dto.ts`: the reviewer request and response DTOs.
- `admin-action.dto.ts`: `AdminActionDto` and `AdminActionListItemDto`.

`action.dto.ts` keeps `ActionDto`, its create and update DTOs, and the remaining action-level request and response DTOs. Moving the reviewer DTOs is what brings it under the limit; the admin-action move leaves room below it.

Every new file imports only from entities and files it does not depend back on, except that the feed, suite, and admin-action files import `ActionDto` from `action.dto.ts`, which does not import them, so no import cycle forms.

`action.dto.ts` keeps re-exporting `UserActionRelation`, which two files import from it.

## Verification

The server's `/openapi.yaml` is compared byte for byte with the one main serves, after each move.
