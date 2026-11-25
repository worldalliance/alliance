import { Injectable } from "@nestjs/common";
import { loadedActionEventAction } from "src/actions/entities/action-event.entity";
import { loadedReminderGroupMemberActionEvent } from "src/actions/entities/reminder-group.entity";
import {
  NOTIF_SOURCE,
  reminderContext,
} from "src/link-tracking/message-tracking.entity";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { EmailStatus } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { PushService } from "src/push/push.service";
import type { User } from "src/user/entities/user.entity";
import type { NotificationPlan } from "./dto/notification-plan.dto";
import type { ActionEventNotif } from "./entities/action-event-notif.entity";
import type { Notification } from "./entities/notification.entity";
import type { ChannelTemplates } from "./missed-suite-notice";
import { NotificationChannel } from "./notif-utils";

export const reminderTracking = (
  plan: NotificationPlan,
  notif: ActionEventNotif,
): TrackedMessage => ({
  owner: { userId: plan.user.id },
  source: NOTIF_SOURCE[notif.type],
  context: reminderContext({
    group: plan.group,
    action: loadedActionEventAction(
      loadedReminderGroupMemberActionEvent(plan.group),
    ),
    notifiedActionIds: notif.notifiedActionIds,
    actionSuiteId: notif.actionSuite?.id ?? null,
    missNumber: notif.missNumber,
    missedSuiteCopy: notif.missedSuiteCopy,
  }),
  actionEventNotifId: notif.id,
});

@Injectable()
export class ActionEventNotifDeliveryService {
  constructor(
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
  ) {}

  /** Renders each of `channels` and resolves to a function that sends them,
   * resolving true if any was attempted. Nothing reaches a provider before
   * that function runs. */
  async prepare(params: {
    notif: ActionEventNotif;
    user: User;
    channels: readonly NotificationChannel[];
    tracking: TrackedMessage;
    templates: ChannelTemplates;
    render: (template: string) => Promise<string>;
    push: {
      screen: string;
      idempotencyKey: string;
      notification?: Notification;
    };
  }): Promise<() => Promise<boolean>> {
    const { notif, user, channels, tracking, templates, render, push } = params;
    const pushes = channels.includes(NotificationChannel.Push)
      ? await this.pushService.getPushForAllUserDevices(user.id, {
          userId: user.id,
          body: await render(templates.pushMessage),
          screen: push.screen,
          idempotencyKey: push.idempotencyKey,
          notification: push.notification,
        })
      : null;
    const text = channels.includes(NotificationChannel.Text)
      ? await render(templates.textMessage)
      : null;
    const email = channels.includes(NotificationChannel.Email)
      ? {
          subject: await render(templates.emailSubject),
          message: await render(templates.emailMessage),
        }
      : null;

    return async () => {
      if (pushes) {
        const result = await this.pushService.sendMessages(pushes);
        notif.pushes = result;
        if (result.length > 0) {
          notif.sent = true;
        }
      }
      if (text !== null) {
        const result = await this.mmsService.sendMms({
          to: user.phoneNumber!,
          userId: user.id,
          body: text,
          mediaUrls: [],
          tracking,
        });

        if (result && !result.errorCode) {
          notif.sent = true;
        }
        notif.mms = result;
      }
      if (email) {
        const result = await this.mailService.sendActionEventNotificationEmail({
          ...email,
          tracking,
          recipient: user.email,
        });
        notif.mail = result;
        if (result.status === EmailStatus.Sent) {
          notif.sent = true;
        }
      }
      return channels.length > 0;
    };
  }
}
