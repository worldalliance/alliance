import { MailerService } from "@nestjs-modules/mailer";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { User } from "src/user/entities/user.entity";
import { EmailStatus, EmailType, Mail } from "./mail.entity";
import { MailService, processKeywordReplacements } from "./mail.service";

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
    cid: "test-cid",
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

    it("replaces #{link} and #{grouplink} with cid", () => {
      const result = processKeywordReplacements(
        "Link: #{link} Group: #{grouplink}",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toContain(
        "Link: https://app.example.org/tasks?cid=test-cid",
      );
      expect(result).toContain(
        "Group: https://app.example.org/groups?tab=members",
      );
      expect(result).toContain("cid=test-cid");
    });

    it("explains reliability when the member misses their first action", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}\n#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: true,
          consecutiveMissedSuiteCount: 1,
        },
      );

      expect(result).toContain("The Alliance counts on every member");
      expect(result).toContain("To learn more about our model");
      expect(result).toContain("if you miss several actions in a row");
      expect(result).not.toContain("contract will be suspended");
    });

    it("warns after a second consecutive missed action", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}\n#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: false,
          consecutiveMissedSuiteCount: 2,
        },
      );

      expect(result).toContain(
        "Remember that we plan each action around the number of members we expect to participate.",
      );
      expect(result).toContain(
        "If you miss all of your assigned non-optional actions again next week, your contract will be suspended automatically.",
      );
      expect(result).not.toContain("second week");
      expect(result).not.toContain("third week");
      expect(result).not.toContain("sign the contract again");
    });

    it("keeps an ordinary missed-action email brief for returning members", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: false,
          consecutiveMissedSuiteCount: 1,
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
    sendMail: () => Promise<{ accepted: string[]; messageId: string }>,
  ) {
    const saves: Mail[] = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: { sendMail } },
        {
          provide: getRepositoryToken(Mail),
          useValue: {
            create: (mail: Partial<Mail>) => ({ ...mail }),
            save: (mail: Mail) => {
              saves.push({ ...mail });
              return Promise.resolve(mail);
            },
          },
        },
      ],
    }).compile();

    return { service: moduleRef.get(MailService), saves };
  }

  const send = (service: MailService) =>
    service.sendMail({
      recipient: "member@privaterelay.appleid.com",
      emailType: EmailType.Welcome,
      subject: "Welcome to the Alliance",
      context: { name: "Jane", url: "https://example.org/verify" },
      cid: null,
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

  it("refuses to send when MAIL_FROM is unset", async () => {
    delete process.env.MAIL_FROM;
    let attempted = false;
    const { service } = await harness(() => {
      attempted = true;
      return Promise.resolve({ accepted: [], messageId: "" });
    });

    await expect(send(service)).rejects.toThrow("MAIL_FROM is unset");
    expect(attempted).toBe(false);
  });
});
