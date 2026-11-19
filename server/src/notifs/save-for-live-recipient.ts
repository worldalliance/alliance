import { ActionEvent } from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import {
  loadedReminderGroupMemberActionEvent,
  ReminderGroup,
} from "src/actions/entities/reminder-group.entity";
import { lockUntilCommit } from "src/datasources/advisory-lock";
import { lockLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { DataSource, EntityManager } from "typeorm";
import type { NotificationPlan } from "./dto/notification-plan.dto";
import type { ActionEventNotif } from "./entities/action-event-notif.entity";

/** Runs `build` in a transaction after locking the suite, member event,
 * group and member, and saves its result with `actionSuite` as its suite.
 * Saves nothing and resolves to null when `build` does, or once any of
 * those rows is deleted, so a run planned before does not start sending
 * under it. */
export function saveForLiveRecipient(
  dataSource: DataSource,
  params: {
    plan: NotificationPlan;
    actionSuite: ActionSuite | null;
    build: (manager: EntityManager) => Promise<ActionEventNotif | null>;
  },
): Promise<ActionEventNotif | null> {
  const { plan, actionSuite, build } = params;
  return dataSource.transaction(async (manager) => {
    // An action's deletion locks its member event before the group.
    const live = await lockLive(manager, [
      ...(actionSuite ? [{ target: ActionSuite, id: actionSuite.id }] : []),
      {
        target: ActionEvent,
        id: loadedReminderGroupMemberActionEvent(plan.group).id,
      },
      { target: ReminderGroup, id: plan.group.id },
      { target: User, id: plan.user.id },
    ]);
    if (!live) return null;
    const notif = await build(manager);
    return (
      notif &&
      manager.save(
        Object.assign(notif, { actionSuite: actionSuite ?? undefined }),
      )
    );
  });
}

/** Serializes reserving coverage on a member's event with reading it, so an
 * overlapping run's catch-up sees the reservation. */
export async function lockReminderCoverage(
  manager: EntityManager,
  params: { userId: number; memberActionEventId: number },
) {
  await lockUntilCommit(
    manager,
    `reminder-coverage:${params.userId}:${params.memberActionEventId}`,
  );
}
