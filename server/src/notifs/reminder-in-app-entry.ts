import { Logger } from "@nestjs/common";
import { tasksUrl } from "src/search/approutes";
import type { NotificationPlan } from "./dto/notification-plan.dto";
import {
  NotificationCategory,
  type Notification,
} from "./entities/notification.entity";
import type { NotifsService } from "./notifs.service";
import { buildReminderMessage } from "./reminder-message";

const logger = new Logger("ReminderInAppEntry");

/** Null, logged, when the push copy renders blank. */
export async function sendReminderInAppEntry(
  notifsService: NotifsService,
  params: {
    plan: NotificationPlan;
    cid: string;
    template: string;
    render: (template: string) => Promise<string>;
    tasks: { id: number; name: string }[];
  },
): Promise<Notification | null> {
  const { plan, cid, template, render, tasks } = params;
  const message = await buildReminderMessage({
    template,
    renderText: render,
    recipient: plan.user,
    action: plan.group.memberActionEvent.action,
    tasks,
  });
  if (!message.text.trim()) {
    logger.error(
      `reminder group ${plan.group.id} has blank push copy; skipped its in-app entry`,
    );
    return null;
  }
  return notifsService.sendNotif({
    user: plan.user,
    category: NotificationCategory.ActionEvent,
    message,
    destination: null,
    webAppLocation: tasksUrl(),
    mobileAppLocation: tasksUrl(),
    associatedUsers: [],
    shouldPush: false,
    cid,
  });
}
