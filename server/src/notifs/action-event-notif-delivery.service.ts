import { Injectable } from "@nestjs/common";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { EmailStatus } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { PushService } from "src/push/push.service";
import type { User } from "src/user/entities/user.entity";
import type { ActionEventNotif } from "./entities/action-event-notif.entity";
import type { Notification } from "./entities/notification.entity";
import type { ChannelTemplates } from "./missed-suite-notice";
import { NotificationChannel } from "./notif-utils";

@Injectable()
export class ActionEventNotifDeliveryService {
  constructor(
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
  ) {}

  /** Sends on each of `channels`; true if any was attempted. */
  async deliver(params: {
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
  }): Promise<boolean> {
    const { notif, user, channels, tracking, templates, render, push } = params;
    if (channels.includes(NotificationChannel.Push)) {
      const pushes = await this.pushService.getPushForAllUserDevices(user.id, {
        userId: user.id,
        body: await render(templates.pushMessage),
        screen: push.screen,
        idempotencyKey: push.idempotencyKey,
        notification: push.notification,
      });

      const result = await this.pushService.sendMessages(pushes);
      notif.pushes = result;
      if (result.length > 0) {
        notif.sent = true;
      }
    }
    if (channels.includes(NotificationChannel.Text)) {
      const result = await this.mmsService.sendMms({
        to: user.phoneNumber!,
        userId: user.id,
        body: await render(templates.textMessage),
        mediaUrls: [],
        tracking,
      });

      if (result && !result.errorCode) {
        notif.sent = true;
      }
      notif.mms = result;
    }
    if (channels.includes(NotificationChannel.Email)) {
      const result = await this.mailService.sendActionEventNotificationEmail({
        subject: await render(templates.emailSubject),
        message: await render(templates.emailMessage),
        tracking,
        recipient: user.email,
      });
      notif.mail = result;
      if (result.status === EmailStatus.Sent) {
        notif.sent = true;
      }
    }
    return channels.length > 0;
  }
}
