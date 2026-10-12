import { ActionEvent } from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import type { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import type { LiveRow } from "src/datasources/soft-delete";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";

export function reminderGroupParents(group: ReminderGroup): LiveRow[] {
  return [
    ...[
      group.memberActionEvent,
      group.deadlineEvent,
      group.timingAnchorEvent,
    ].flatMap((e) => (e ? [{ target: ActionEvent, id: e.id }] : [])),
    ...(group.actionSuite
      ? [{ target: ActionSuite, id: group.actionSuite.id }]
      : []),
    ...(group.userTag ? [{ target: Tag, id: group.userTag.id }] : []),
    ...(group.users ?? []).map(({ id }) => ({ target: User, id })),
  ];
}
