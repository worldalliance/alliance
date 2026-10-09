import { ActionEvent } from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { lockLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { DataSource } from "typeorm";
import type { NotificationPlan } from "./dto/notification-plan.dto";
import type { ActionEventNotif } from "./entities/action-event-notif.entity";

/** Saves nothing and resolves to null once the suite, the member event, the
 * group or the member is deleted, so a run planned before does not start
 * sending under it. */
export function saveForLiveRecipient(
  dataSource: DataSource,
  params: { plan: NotificationPlan; notif: ActionEventNotif },
): Promise<ActionEventNotif | null> {
  const { plan, notif } = params;
  return dataSource.transaction(async (manager) =>
    // An action's deletion locks its member event before the group.
    (await lockLive(manager, [
      ...(notif.actionSuite
        ? [{ target: ActionSuite, id: notif.actionSuite.id }]
        : []),
      { target: ActionEvent, id: plan.group.memberActionEvent.id },
      { target: ReminderGroup, id: plan.group.id },
      { target: User, id: plan.user.id },
    ]))
      ? manager.save(notif)
      : null,
  );
}
