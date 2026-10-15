import { Injectable } from "@nestjs/common";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { EmailStatus } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { PushService } from "src/push/push.service";
import type { User } from "src/user/entities/user.entity";
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
import type { ActionEventNotif } from "./entities/action-event-notif.entity";
import type { Notification } from "./entities/notification.entity";
import type { ChannelTemplates } from "./missed-suite-notice";

@Injectable()
export class ActionEventNotifDeliveryService {
  constructor(
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
  ) {}

  /** Sends on each channel the member enabled; true if any was attempted. */
  async deliver(params: {
    notif: ActionEventNotif;
    user: User;
    tracking: TrackedMessage;
    templates: ChannelTemplates;
    render: (template: string) => Promise<string>;
    push: {
      screen: string;
      idempotencyKey: string;
      notification?: Notification;
    };
  }): Promise<boolean> {
    const { notif, user, tracking, templates, render, push } = params;
    let sendingAnyNotif = false;
    if (userActionNotifsEnabled_push(user)) {
      sendingAnyNotif = true;
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
    if (userActionNotifsEnabled_text(user)) {
      sendingAnyNotif = true;
      const result = await this.mmsService.sendMms({
        to: user.phoneNumber!,
        body: await render(templates.textMessage),
        mediaUrls: [],
        tracking,
      });

      if (result && !result.errorCode) {
        notif.sent = true;
      }
      notif.mms = result;
    }
    if (userActionNotifsEnabled_email(user)) {
      sendingAnyNotif = true;
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
    return sendingAnyNotif;
  }
}
