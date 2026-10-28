import { MailerService, type ISendMailOptions } from "@nestjs-modules/mailer";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import {
  MessageTrackingService,
  type TrackedMessage,
} from "src/link-tracking/message-tracking.service";
import { ContractReminderCopy } from "./contract-reminder-copy";
import { EmailStatus, EmailType, Mail } from "./mail.entity";
import { MailNotSentError, MailService } from "./mail.service";

describe("sendMail", () => {
  const originalEnv = { ...process.env };

  async function harness(
    sendMail: (
      options: ISendMailOptions,
    ) => Promise<{ accepted: string[]; messageId: string }>,
    other: {
      saveFails?: boolean;
      trackFails?: boolean;
      verifyAllTransporters?: () => Promise<boolean>;
    } = {},
  ) {
    const saves: Mail[] = [];
    const tracked: TrackedMessage[] = [];
    const discarded: string[] = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: {
            sendMail,
            verifyAllTransporters: other.verifyAllTransporters,
          },
        },
        {
          provide: MessageTrackingService,
          useValue: {
            track: (input: { message: TrackedMessage }) => {
              if (other.trackFails) {
                return Promise.reject(new Error("insert failed"));
              }
              tracked.push(input.message);
              return Promise.resolve("track-1");
            },
            discard: (trackingId: string) => {
              discarded.push(trackingId);
              return Promise.resolve();
            },
          },
        },
        {
          provide: getRepositoryToken(Mail),
          useValue: {
            create: (mail: Partial<Mail>) => ({ ...mail }),
            save: (mail: Mail) => {
              if (other.saveFails) {
                return Promise.reject(new Error("connection lost"));
              }
              saves.push({ ...mail });
              return Promise.resolve(mail);
            },
          },
        },
      ],
    }).compile();

    return { service: moduleRef.get(MailService), saves, tracked, discarded };
  }

  const send = (service: MailService) =>
    service.sendMail({
      recipient: "member@privaterelay.appleid.com",
      emailType: EmailType.Welcome,
      subject: "Welcome to the Alliance",
      context: { name: "Jane", url: "https://example.org/verify" },
      tracking: null,
    });

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_FROM = "Alliance <alliance@thealliance.org>";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("records a failed Mail row when the transport rejects", async () => {
    const rejection = new Error("550 sender domain not allowed");
    const { service, saves } = await harness(() => Promise.reject(rejection));

    await expect(send(service)).rejects.toThrow(rejection);

    expect(saves.at(-1)?.status).toBe(EmailStatus.Failed);
    expect(saves.at(-1)?.to).toBe("member@privaterelay.appleid.com");
  });

  it("sends from MAIL_FROM and records the message id", async () => {
    const { service, saves } = await harness(() =>
      Promise.resolve({
        accepted: ["member@privaterelay.appleid.com"],
        messageId: "<abc@mg>",
      }),
    );

    const mail = await send(service);

    expect(mail.status).toBe(EmailStatus.Sent);
    expect(mail.sentMessageId).toBe("<abc@mg>");
    expect(saves[0].status).toBe(EmailStatus.Pending);
  });

  it("tags app links with the message's own tracking ID", async () => {
    process.env.APP_URL = "https://app.example.org";
    let html: unknown;
    const { service } = await harness((options) => {
      html = options.html;
      return Promise.resolve({
        accepted: ["member@example.org"],
        messageId: "",
      });
    });

    const mail = await service.sendActionEventNotificationEmail({
      subject: "Tasks",
      message: "See https://app.example.org/tasks",
      recipient: "member@example.org",
      tracking: {
        owner: { userId: 1 },
        source: MessageSource.ActionReminder,
        context: {},
        actionEventNotifId: null,
      },
    });

    expect(mail.cid).toBe("track-1");
    expect(html).toContain("https://app.example.org/tasks?cid=track-1");
  });

  it("places a custom email's block HTML in the body without a paragraph around it", async () => {
    const { service } = await harness(() =>
      Promise.reject(new Error("unused")),
    );
    const message = "<h2>Update</h2>\n<p>Body</p>\n";

    const html = await service.renderHtml(EmailType.CustomActionReminder, {
      customMessage: message,
    });

    expect(html).toContain(`<body><div>${message}</div></body>`);
  });

  const contractReminders: Record<
    ContractReminderCopy,
    { subject: string; paragraphs: string[] }
  > = {
    [ContractReminderCopy.Control]: {
      subject: "Sign your membership contract to participate in actions",
      paragraphs: [
        "Dear &lt;b&gt;Jo&amp;&lt;/b&gt;,",
        "You signed up for the Alliance platform, but did not sign the membership contract. Please note that until you do, you will be unable to participate in Alliance actions.",
        "The contract matters because the Alliance is built on reliability. We plan precise actions based on the number of committed members; every commitment tells us who we can count on.",
        "By signing, you’re telling other members that they can count on you. Because they’ve signed, you can count on them too.",
        "You can sign your contract in the tasks page: https://app.example.org/tasks?cid=track-1",
        'If you’d like to learn more about the Alliance and why reliability matters before signing, you can watch <a href="https://www.youtube.com/watch?v=fR7Upo0DlYs&amp;t=125s">this video</a>.',
        "Thank you for your interest in the Alliance.",
        "Best,",
        "The Alliance Team",
      ],
    },
    [ContractReminderCopy.AgreementV1]: {
      subject: "The last step is entering into the membership agreement.",
      paragraphs: [
        "Hi &lt;b&gt;Jo&amp;&lt;/b&gt;,",
        "You signed up for the Alliance, but did not enter into our membership agreement. Our project planning relies upon accurate participation expectations. Until you enter into the agreement, we cannot assign you tasks.",
        "By signing, you are letting other members know they can count on you, just like you can count on them.",
        'You can enter into the agreement here: <a href="https://app.example.org/membership?cid=track-1">https://app.example.org/membership</a>',
        'If you would like to learn more about the Alliance and why reliability matters before signing, you can watch this video: <a href="https://www.youtube.com/watch?v=fR7Upo0DlYs&amp;t=125s">https://www.youtube.com/watch?v=fR7Upo0DlYs&amp;t=125s</a>',
        "Best,",
        "The Alliance Team",
      ],
    },
  };

  it.each(Object.values(ContractReminderCopy))(
    "sends the %s contract reminder, attributed to its member",
    async (copy) => {
      const { subject, paragraphs } = contractReminders[copy];
      process.env.APP_URL = "https://app.example.org";
      const sent: ISendMailOptions[] = [];
      const { service, tracked } = await harness((options) => {
        sent.push(options);
        return Promise.resolve({
          accepted: ["member@example.org"],
          messageId: "",
        });
      });

      const mail = await service.sendContractReminderEmail({
        userId: 7,
        email: "member@example.org",
        name: "<b>Jo&</b>",
        copy,
      });

      expect(sent[0].subject).toBe(subject);
      expect(
        [...String(sent[0].html).matchAll(/<p>(.*?)<\/p>/g)].map((m) => m[1]),
      ).toEqual(paragraphs);
      expect(mail.cid).toBe("track-1");
      expect(tracked).toEqual([
        {
          owner: { userId: 7 },
          source: MessageSource.ContractReminder,
          context: { contractReminderCopy: copy, subject },
          actionEventNotifId: null,
        },
      ]);
    },
  );

  it("sends the reinstatement email to the member's first name", async () => {
    process.env.APP_URL = "https://app.example.org";
    const sent: ISendMailOptions[] = [];
    const { service } = await harness((options) => {
      sent.push(options);
      return Promise.resolve({
        accepted: ["member@example.org"],
        messageId: "",
      });
    });

    await service.sendContractReinstatedEmail({
      email: "member@example.org",
      name: "Jo Member",
    });

    expect(sent[0].subject).toBe("Your agreement has been reinstated.");
    expect(
      [...String(sent[0].html).matchAll(/<p>(.*?)<\/p>/g)].map((m) => m[1]),
    ).toEqual([
      "Hi Jo,",
      "Your agreement has been reinstated. Task assignment resumes with the next action, and your participation is counted in action planning from this point.",
      '<a href="https://app.example.org/tasks">https://app.example.org/tasks</a>',
    ]);
  });

  it("reports a failed tracking insert as unsent, without sending", async () => {
    const sendMail = jest.fn(() =>
      Promise.resolve({ accepted: ["member@example.org"], messageId: "" }),
    );
    const { service, saves } = await harness(sendMail, { trackFails: true });

    await expect(
      service.sendContractReminderEmail({
        userId: 7,
        email: "member@example.org",
        name: "Jane",
        copy: ContractReminderCopy.Control,
      }),
    ).rejects.toBeInstanceOf(MailNotSentError);

    expect(sendMail).not.toHaveBeenCalled();
    expect(saves).toEqual([]);
  });

  it("refuses to send when MAIL_FROM is unset", async () => {
    delete process.env.MAIL_FROM;
    let attempted = false;
    const { service } = await harness(() => {
      attempted = true;
      return Promise.resolve({ accepted: [], messageId: "" });
    });

    const sending = send(service);
    await expect(sending).rejects.toThrow("MAIL_FROM is unset");
    await expect(sending).rejects.toBeInstanceOf(MailNotSentError);
    expect(attempted).toBe(false);
  });

  it("tracks nothing when MAIL_FROM is unset", async () => {
    delete process.env.MAIL_FROM;
    const { service, tracked } = await harness(() =>
      Promise.resolve({ accepted: [], messageId: "" }),
    );

    await expect(
      service.sendContractReminderEmail({
        userId: 7,
        email: "member@example.org",
        name: "Jane",
        copy: ContractReminderCopy.Control,
      }),
    ).rejects.toBeInstanceOf(MailNotSentError);
    expect(tracked).toEqual([]);
  });

  it("discards the tracking of a Mail row it couldn't save", async () => {
    const { service, discarded } = await harness(
      () => Promise.resolve({ accepted: [], messageId: "" }),
      { saveFails: true },
    );

    await expect(
      service.sendContractReminderEmail({
        userId: 7,
        email: "member@example.org",
        name: "Jane",
        copy: ContractReminderCopy.Control,
      }),
    ).rejects.toBeInstanceOf(MailNotSentError);
    expect(discarded).toEqual(["track-1"]);
  });

  it("reports a Mail row it couldn't save as not sent, without sending", async () => {
    let attempted = false;
    const { service } = await harness(
      () => {
        attempted = true;
        return Promise.resolve({ accepted: [], messageId: "" });
      },
      { saveFails: true },
    );

    await expect(send(service)).rejects.toBeInstanceOf(MailNotSentError);
    expect(attempted).toBe(false);
  });

  it.each([
    { reachable: true, verify: () => Promise.resolve(true) },
    { reachable: false, verify: () => Promise.reject(new Error("refused")) },
  ])(
    "reports the mail server reachable: $reachable",
    async ({ reachable, verify }) => {
      const { service } = await harness(
        () => Promise.reject(new Error("unused")),
        { verifyAllTransporters: verify },
      );
      expect(await service.verifyTransport()).toBe(reachable);
    },
  );

  it("reports the mail server reachable while sending is off", async () => {
    process.env.NODE_ENV = "test";
    const { service } = await harness(
      () => Promise.reject(new Error("unused")),
      { verifyAllTransporters: () => Promise.resolve(false) },
    );
    expect(await service.verifyTransport()).toBe(true);
  });

  it.each([
    { hasPassword: true, verb: "reset" },
    { hasPassword: false, verb: "set" },
  ])(
    "offers to $verb the password when hasPassword is $hasPassword",
    async ({ hasPassword, verb }) => {
      const sent: ISendMailOptions[] = [];
      const { service, saves } = await harness((options) => {
        sent.push(options);
        return Promise.resolve({
          accepted: ["member@example.org"],
          messageId: "<abc@mg>",
        });
      });

      await service.sendPasswordResetEmail({
        email: "member@example.org",
        name: "Jane",
        resetToken: "token",
        hasPassword,
      });

      expect(sent[0].subject).toBe(`a link to ${verb} your password`);
      expect(saves.at(-1)?.renderedHtml).toContain(
        `Use this link to ${verb} your password`,
      );
    },
  );
});

describe("waitlist templates", () => {
  it.each([EmailType.WaitlistConfirmation, EmailType.WaitlistLink])(
    "links %s emails to unsubscribing",
    async (emailType) => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: MailerService, useValue: {} },
          { provide: getRepositoryToken(Mail), useValue: {} },
          { provide: MessageTrackingService, useValue: {} },
        ],
      }).compile();

      const html = await moduleRef.get(MailService).renderHtml(emailType, {
        url: "https://example.org/share",
        unsubscribeUrl: "https://example.org/waitlist/unsubscribe?token=t",
      });

      expect(html).toContain(
        '<a href="https://example.org/waitlist/unsubscribe?token=t">Unsubscribe from waitlist emails</a>',
      );
    },
  );
});
