import { MailerService, type ISendMailOptions } from "@nestjs-modules/mailer";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import {
  MessageTrackingService,
  type TrackedMessage,
} from "src/link-tracking/message-tracking.service";
import { User } from "src/user/entities/user.entity";
import { EmailStatus, EmailType, Mail } from "./mail.entity";
import {
  MailNotSentError,
  MailService,
  processKeywordReplacements,
} from "./mail.service";

describe("processKeywordReplacements", () => {
  let originalAppUrl: string | undefined;

  beforeAll(() => {
    originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = "https://app.example.org";
  });

  afterAll(() => {
    process.env.APP_URL = originalAppUrl;
  });

  const baseContext = {
    user: { id: 1, name: "Jane Doe" } as User,
    action: { id: 10, name: "Test Action" } as Action,
    uncompletedTasksTime: "90 minutes",
    uncompletedTasksNames: ["Task A", "Task B"],
  };

  describe("simple placeholders", () => {
    it("replaces #{firstname}, #{lastname}, #{fullname}, #{action}", () => {
      const result = processKeywordReplacements(
        "Hi #{firstname} #{lastname} (#{fullname}), #{action}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
        },
      );
      expect(result).toBe("Hi Jane Doe (Jane Doe), Test Action");
    });

    it("replaces #{n}, #{s}, #{tasknames}, #{tasktime}", () => {
      const result = processKeywordReplacements(
        "#{n} task#{s}: #{tasknames} (#{tasktime})",
        {
          ...baseContext,
          uncompletedTasksCount: 2,
        },
      );
      expect(result).toBe("2 tasks: Task A, Task B (90 minutes)");
    });

    it("replaces #{link} and #{grouplink}", () => {
      const result = processKeywordReplacements(
        "Link: #{link} Group: #{grouplink}",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toBe(
        "Link: https://app.example.org/tasks Group: https://app.example.org/groups?tab=members",
      );
    });

    it("links #{link} and #{grouplink} to ALT_APP_URL when set", () => {
      const originalAltAppUrl = process.env.ALT_APP_URL;
      process.env.ALT_APP_URL = "https://alt.example.org";
      try {
        const result = processKeywordReplacements(
          "Link: #{link} Group: #{grouplink}",
          { ...baseContext, uncompletedTasksCount: 1 },
        );
        expect(result).toBe(
          "Link: https://alt.example.org/tasks Group: https://alt.example.org/groups?tab=members",
        );
      } finally {
        process.env.ALT_APP_URL = originalAltAppUrl;
      }
    });

    it("explains reliability when the member misses their first action", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}\n#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: true,
        },
      );

      expect(result).toContain("The Alliance counts on every member");
      expect(result).toContain("To learn more about our model");
      expect(result).toContain("if you miss several actions in a row");
      expect(result).not.toContain("contract will be suspended");
    });

    it("renders #{secondmisswarning} as nothing", () => {
      expect(
        processKeywordReplacements("a#{secondmisswarning}b", {
          ...baseContext,
          uncompletedTasksCount: 1,
        }),
      ).toBe("ab");
    });

    it("keeps an ordinary missed-action email brief for returning members", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: false,
        },
      );

      expect(result).toBe(
        "Remember that we plan each action around the number of members we expect to participate.",
      );
    });
  });

  describe("#{x|y} singular/plural", () => {
    it("uses left part when uncompletedTasksCount === 1", () => {
      const result = processKeywordReplacements(
        "You have #{1 task|2 tasks} left.",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toBe("You have 1 task left.");
    });

    it("uses right part when uncompletedTasksCount !== 1", () => {
      const result = processKeywordReplacements(
        "You have #{1 task|2 tasks} left.",
        { ...baseContext, uncompletedTasksCount: 3 },
      );
      expect(result).toBe("You have 2 tasks left.");
    });
  });

  describe("#{\\n|\\n\\n} and escape sequences", () => {
    it("replaces #{\\n|\\n\\n} with one newline when n === 1", () => {
      const result = processKeywordReplacements("Line1#{\\n|\\n\\n}Line2", {
        ...baseContext,
        uncompletedTasksCount: 1,
      });
      expect(result).toBe("Line1\nLine2");
      expect(result).toEqual(`Line1${"\n"}Line2`);
    });

    it("replaces #{\\n|\\n\\n} with two newlines when n !== 1", () => {
      const result = processKeywordReplacements("Line1#{\\n|\\n\\n}Line2", {
        ...baseContext,
        uncompletedTasksCount: 2,
      });
      expect(result).toBe("Line1\n\nLine2");
      expect(result).toEqual(`Line1${"\n"}${"\n"}Line2`);
    });

    it("interprets \\t in #{x|y} as tab", () => {
      const result = processKeywordReplacements("A#{\\t|\\t\\t}B", {
        ...baseContext,
        uncompletedTasksCount: 1,
      });
      expect(result).toBe("A\tB");
    });

    it("interprets \\t in #{x|y} as double tab when plural", () => {
      const result = processKeywordReplacements("A#{\\t|\\t\\t}B", {
        ...baseContext,
        uncompletedTasksCount: 2,
      });
      expect(result).toBe("A\t\tB");
    });

    it("interprets \\\\ as single backslash in replacement", () => {
      const result = processKeywordReplacements("Path: #{a\\\\b|a\\\\b\\\\c}", {
        ...baseContext,
        uncompletedTasksCount: 1,
      });
      expect(result).toBe("Path: a\\b");
    });

    it("combines escaped newlines with other placeholders", () => {
      const result = processKeywordReplacements(
        "Hi #{firstname},#{\\n|\\n\\n}#{n} task#{s}",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toBe(`Hi Jane,\n1 task`);
    });
  });
});

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

  it("attributes a contract reminder to its member", async () => {
    const { service, tracked } = await harness(() =>
      Promise.resolve({ accepted: ["member@example.org"], messageId: "" }),
    );

    const mail = await service.sendContractReminderEmail({
      userId: 7,
      email: "member@example.org",
      name: "Jane",
    });

    expect(mail.cid).toBe("track-1");
    expect(tracked).toEqual([
      {
        owner: { userId: 7 },
        source: MessageSource.ContractReminder,
        context: {},
        actionEventNotifId: null,
      },
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
