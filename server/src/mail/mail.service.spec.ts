import { MailerService, type ISendMailOptions } from "@nestjs-modules/mailer";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import { mailSendError, SendErrorKind } from "src/utils/send-error";
import { ContractReminderCopy } from "./contract-reminder-copy";
import { EmailStatus, EmailType, Mail } from "./mail.entity";
import {
  MailNotSentError,
  MailService,
  MailUnrecordedError,
} from "./mail.service";
import { harness, useMailSendingEnv } from "./mail.service.fixtures";

const buttonHref = (html: unknown) =>
  /bgcolor="#62a124"[^>]*><a href="([^"]*)"/.exec(String(html))?.[1];

describe("sendMail", () => {
  useMailSendingEnv();
  afterEach(() => jest.restoreAllMocks());

  const send = (service: MailService) =>
    service.sendMail({
      recipient: "member@privaterelay.appleid.com",
      emailType: EmailType.Welcome,
      subject: "Welcome to the Alliance",
      context: { name: "Jane", url: "https://example.org/verify" },
      tracking: null,
    });

  it("records a failed Mail row when the transport rejects", async () => {
    const rejection = new Error("550 sender domain not allowed");
    const { service, saves } = await harness(() => Promise.reject(rejection));

    await expect(send(service)).rejects.toThrow(rejection);

    expect(saves.at(-1)?.status).toBe(EmailStatus.Failed);
    expect(saves.at(-1)?.to).toBe("member@privaterelay.appleid.com");
  });

  it("records an anonymized address's mail without sending it", async () => {
    const sent: ISendMailOptions[] = [];
    const { service, saves } = await harness((options) => {
      sent.push(options);
      return Promise.resolve({ accepted: [], messageId: "" });
    });

    await service.sendMail({
      recipient: "User12@Example.com",
      emailType: EmailType.Welcome,
      subject: "Welcome to the Alliance",
      context: { name: "Jane", url: "https://example.org/verify" },
      tracking: null,
    });

    expect(sent).toEqual([]);
    expect(saves.at(-1)).toMatchObject({
      to: "User12@Example.com",
      status: EmailStatus.Pending,
    });
  });

  it("sends from MAIL_FROM and records the message id", async () => {
    const sent: ISendMailOptions[] = [];
    const { service, saves } = await harness((options) => {
      sent.push(options);
      return Promise.resolve({
        accepted: ["member@privaterelay.appleid.com"],
        messageId: "<abc@mg>",
      });
    });

    const mail = await send(service);

    expect(sent).toEqual([
      expect.objectContaining({
        to: "member@privaterelay.appleid.com",
        from: "Alliance <alliance@thealliance.org>",
        subject: "Welcome to the Alliance",
        headers: {
          "o:tag": EmailType.Welcome,
          "X-Mailgun-Tag": "production",
        },
      }),
    ]);
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

    expect(html).toContain(`<div>${message}</div></td>`);
  });

  const contractReminders: Record<
    ContractReminderCopy,
    { subject: string; paragraphs: string[]; button: string }
  > = {
    [ContractReminderCopy.Control]: {
      subject: "One last step to join the Alliance",
      paragraphs: [
        "Hi &lt;b&gt;Jo&amp;&lt;/b&gt;,",
        "You’re almost done! You’ve created an account on the Alliance platform, but did not complete the membership agreement. Please note that until you do, you will be unable to participate in our projects.",
        "You can complete the membership agreement here:",
        "The agreement matters because the Alliance is built on reliability. We plan precise actions based on the number of committed members; every commitment tells us who we can count on.",
        "By completing it, you’re telling other members that they can count on you. Because they’ve completed it, you can count on them too. The world needs you.",
        'If you’d like to learn more about the Alliance and why reliability matters before joining, you can watch <a href="https://www.youtube.com/watch?v=fR7Upo0DlYs&amp;t=125s">this video</a>.',
        "Thank you for your interest in the Alliance.",
        "Best,",
        "The Alliance Team",
      ],
      button:
        "https://app.example.org/onboarding?step=agreement&amp;cid=track-1",
    },
    [ContractReminderCopy.AgreementV1]: {
      subject: "One last step to join the Alliance",
      paragraphs: [
        "Hi &lt;b&gt;Jo&amp;&lt;/b&gt;,",
        "You created an Alliance account, but did not enter into our membership agreement. Our project planning relies upon accurate participation expectations. Until you enter into the agreement, we cannot assign you tasks.",
        "By entering into it, you are letting other members know they can count on you, just like you can count on them.",
        "You can enter into the agreement here:",
        'If you would like to learn more about the Alliance and why reliability matters before joining, you can watch this video: <a href="https://www.youtube.com/watch?v=fR7Upo0DlYs&amp;t=125s">https://www.youtube.com/watch?v=fR7Upo0DlYs&amp;t=125s</a>',
        "Best,",
        "The Alliance Team",
      ],
      button:
        "https://app.example.org/onboarding?step=agreement&amp;cid=track-1",
    },
  };

  it.each(Object.values(ContractReminderCopy))(
    "sends the %s contract reminder, attributed to its member",
    async (copy) => {
      const { subject, paragraphs, button } = contractReminders[copy];
      process.env.ALT_APP_URL = "https://app.example.org";
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
      expect(buttonHref(sent[0].html)).toBe(button);
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
    process.env.ALT_APP_URL = "https://app.example.org";
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
    ]);
    expect(buttonHref(sent[0].html)).toBe("https://app.example.org/tasks");
  });

  it("links the paused-agreement email to the onboarding agreement step", async () => {
    process.env.ALT_APP_URL = "https://app.example.org";
    const sent: ISendMailOptions[] = [];
    const { service } = await harness((options) => {
      sent.push(options);
      return Promise.resolve({
        accepted: ["member@example.org"],
        messageId: "",
      });
    });

    await service.sendContractSuspendedEmail("member@example.org", "Jo");

    expect(sent[0].subject).toBe("Alliance agreement paused");
    expect(buttonHref(sent[0].html)).toBe(
      "https://app.example.org/onboarding?step=agreement",
    );
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

  it("reports an outcome it couldn't save once the transport accepted the message as unrecorded", async () => {
    const other = { saveFails: false };
    const { service } = await harness(() => {
      other.saveFails = true;
      return Promise.resolve({
        accepted: ["member@example.org"],
        messageId: "",
      });
    }, other);

    const sending = send(service);
    await expect(sending).rejects.toBeInstanceOf(MailUnrecordedError);
    await expect(sending).rejects.toThrow("The mail server answered");
  });

  it("reads an unrecorded outcome as unknown even when the save failed to connect", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), {
      syscall: "connect",
    });
    expect(mailSendError(new MailUnrecordedError("", { cause }))).toBe(
      SendErrorKind.Unknown,
    );
  });

  it("rethrows the transport's error when it can't save a rejected send", async () => {
    const refused = Object.assign(new Error("login refused"), {
      code: "EAUTH",
    });
    const other = { saveFails: false };
    const { service } = await harness(() => {
      other.saveFails = true;
      return Promise.reject(refused);
    }, other);
    const logged = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await expect(send(service)).rejects.toBe(refused);
    expect(logged).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: "connection lost" }),
    );
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
