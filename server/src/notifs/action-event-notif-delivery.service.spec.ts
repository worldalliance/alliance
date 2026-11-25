import { Test } from "@nestjs/testing";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { PushService } from "src/push/push.service";
import { User } from "src/user/entities/user.entity";
import { ActionEventNotifDeliveryService } from "./action-event-notif-delivery.service";
import { ActionEventNotif } from "./entities/action-event-notif.entity";
import { NotificationChannel } from "./notif-utils";

describe("ActionEventNotifDeliveryService.prepare", () => {
  it.each([
    {
      failure: "the text fails to render",
      lookup: () => Promise.resolve([]),
      failingTemplate: "text",
    },
    {
      failure: "the email fails to render",
      lookup: () => Promise.resolve([]),
      failingTemplate: "email",
    },
    {
      failure: "the push device lookup fails",
      lookup: () => Promise.reject(new Error("prepare failed")),
      failingTemplate: null,
    },
  ])(
    "rejects and sends nothing when $failure",
    async ({ lookup, failingTemplate }) => {
      const push = {
        getPushForAllUserDevices: jest.fn(lookup),
        sendMessages: jest.fn(async () => []),
      };
      const mms = { sendMms: jest.fn() };
      const mail = { sendActionEventNotificationEmail: jest.fn() };
      const module = await Test.createTestingModule({
        providers: [
          ActionEventNotifDeliveryService,
          { provide: PushService, useValue: push },
          { provide: MmsService, useValue: mms },
          { provide: MailService, useValue: mail },
        ],
      }).compile();
      const user = Object.assign(new User(), {
        id: 1,
        phoneNumber: "+15550100",
      });

      const prepared = module.get(ActionEventNotifDeliveryService).prepare({
        notif: new ActionEventNotif(),
        user,
        channels: [
          NotificationChannel.Push,
          NotificationChannel.Text,
          NotificationChannel.Email,
        ],
        tracking: {
          owner: { userId: user.id },
          source: MessageSource.ActionReminder,
          context: {},
          actionEventNotifId: null,
        },
        templates: {
          pushMessage: "push",
          textMessage: "text",
          emailSubject: "subject",
          emailMessage: "email",
        },
        render: async (template) => {
          if (template === failingTemplate) throw new Error("prepare failed");
          return template;
        },
        push: { screen: "/", idempotencyKey: "1" },
      });

      await expect(prepared).rejects.toThrow("prepare failed");
      expect(push.sendMessages).not.toHaveBeenCalled();
      expect(mms.sendMms).not.toHaveBeenCalled();
      expect(mail.sendActionEventNotificationEmail).not.toHaveBeenCalled();
    },
  );
});
