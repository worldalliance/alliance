import { type ISendMailOptions } from "@nestjs-modules/mailer";
import { Logger } from "@nestjs/common";
import { DeliveryFailure } from "src/utils/notif-delivery";
import { EmailType } from "./mail.entity";
import { MailService } from "./mail.service";
import { harness, useMailSendingEnv } from "./mail.service.fixtures";

describe("sendUnrecordedMail", () => {
  useMailSendingEnv();

  const RECIPIENT = "Participant@Example.ORG";
  const sendUnrecorded = (service: MailService, recipient = RECIPIENT) =>
    service.sendUnrecordedMail({
      recipient,
      emailType: EmailType.Welcome,
      subject: "Your code",
      context: { name: "Jane", url: "https://example.org/123456" },
    });

  let logged: unknown[][];
  beforeEach(() => {
    logged = [];
    jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation((...args: unknown[]) => void logged.push(args));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends from MAIL_FROM untracked and returns the message id without a Mail row", async () => {
    const sent: ISendMailOptions[] = [];
    const { service, saves } = await harness((options) => {
      sent.push(options);
      return Promise.resolve({
        accepted: [RECIPIENT],
        messageId: "<abc@mg>",
      });
    });

    expect(await sendUnrecorded(service)).toEqual({
      ok: true,
      value: { messageId: "<abc@mg>" },
    });
    expect(sent).toEqual([
      expect.objectContaining({
        to: RECIPIENT,
        from: "Alliance <alliance@thealliance.org>",
        subject: "Your code",
        headers: {
          "o:tag": EmailType.Welcome,
          "X-Mailgun-Tag": "production",
          "X-Mailgun-Track": "no",
        },
      }),
    ]);
    expect(saves).toEqual([]);
  });

  it.each([
    {
      unavailable: "while sending is off",
      configure: () => {
        process.env.NODE_ENV = "test";
      },
    },
    {
      unavailable: "when MAIL_FROM is unset",
      configure: () => {
        delete process.env.MAIL_FROM;
      },
    },
    {
      unavailable: "when the template fails to render",
      configure: (service: MailService) => {
        jest
          .spyOn(service, "renderHtml")
          .mockRejectedValue(new Error("ENOENT templates/.pug"));
      },
    },
  ])(
    "reports unavailable $unavailable, without sending",
    async ({ configure }) => {
      let attempted = false;
      const { service } = await harness(() => {
        attempted = true;
        return Promise.resolve({ accepted: [RECIPIENT], messageId: "" });
      });
      configure(service);

      expect(await sendUnrecorded(service)).toEqual({
        ok: false,
        error: DeliveryFailure.Unavailable,
      });
      expect(attempted).toBe(false);
    },
  );

  it.each([
    {
      outcome: "rejects",
      sendMail: () =>
        Promise.reject(
          new Error(
            "550 <Participant@example.org>: Recipient address rejected",
          ),
        ),
    },
    {
      outcome: "accepts no one",
      sendMail: () => Promise.resolve({ accepted: [], messageId: "<abc@mg>" }),
    },
  ])(
    "reports failed when the transport $outcome, without logging the address",
    async ({ sendMail }) => {
      const { service, saves } = await harness(sendMail);

      expect(await sendUnrecorded(service)).toEqual({
        ok: false,
        error: DeliveryFailure.Failed,
      });
      expect(logged.length).toBeGreaterThan(0);
      expect(
        logged.flat().filter((arg) => /participant@/i.test(String(arg))),
      ).toEqual([]);
      expect(saves).toEqual([]);
    },
  );

  it.each([
    { recipient: "O'Brien@Example.ORG", quoted: "O'Brien@example.org" },
    { recipient: "jane@exämple.org", quoted: "jane@exämple.org" },
    { recipient: "jane/otp@example.org", quoted: "jane/otp@example.org" },
    {
      recipient: '"Jane Doe"@Example.ORG',
      quoted: '"Jane Doe"@example.org',
    },
    { recipient: "jane@[192.0.2.1]", quoted: "jane@[192.0.2.1]" },
    { recipient: '"a\\"b"@example.org', quoted: '"a\\"b"@example.org' },
  ])(
    "redacts $quoted from a rejection that quotes it",
    async ({ recipient, quoted }) => {
      const { service } = await harness(() =>
        Promise.reject(new Error(`550 <${quoted}>: Recipient rejected`)),
      );

      await sendUnrecorded(service, recipient);

      expect(logged[0][0]).toBe(
        `Unrecorded ${EmailType.Welcome} email not sent: 550 <[redacted]>: Recipient rejected`,
      );
      expect(logged.flat().filter((arg) => String(arg).includes("@"))).toEqual(
        [],
      );
    },
  );

  it("reports a send the mail server never answers as failed", async () => {
    const { service, saves } = await harness(() => new Promise(() => {}));
    service["sendTimeoutMs"] = 5;

    expect(await sendUnrecorded(service)).toEqual({
      ok: false,
      error: DeliveryFailure.Failed,
    });
    expect(saves).toEqual([]);
  });
});
