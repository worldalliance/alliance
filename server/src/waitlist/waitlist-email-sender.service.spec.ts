import { R } from "@alliance/common/result";
import { describe, expect, it } from "bun:test";
import { EmailStatus, Mail } from "src/mail/mail.entity";
import { MailNotSentError } from "src/mail/mail.service";
import { WaitlistEmailRecipientStatus } from "./entities/waitlist-email-recipient.entity";
import { sendOutcome, type SendOutcome } from "./waitlist-email-sender.service";

const sendErrorOutcome = (error: unknown) => sendOutcome(R.failure(error));
const mailOutcome = (status: EmailStatus) =>
  sendOutcome(R.success(Object.assign(new Mail(), { status })));

const withFields = (fields: Record<string, unknown>) =>
  Object.assign(new Error("send failed"), fields);

describe("sendOutcome of a thrown error", () => {
  it.each([
    [
      "a refused recipient",
      withFields({ code: "EENVELOPE", responseCode: 550, command: "RCPT TO" }),
    ],
    [
      "a refused message",
      withFields({ code: "EMESSAGE", responseCode: 554, command: "DATA" }),
    ],
    ["an invalid address", withFields({ code: "EENVELOPE", command: "API" })],
    [
      "a message too large",
      withFields({ code: "EMESSAGE", command: "MAIL FROM" }),
    ],
  ])("fails a recipient on %s and goes on to the next", (_, error) => {
    expect(sendErrorOutcome(error)).toEqual({
      status: WaitlistEmailRecipientStatus.Failed,
      error: "send failed",
      stopsRun: false,
    });
  });

  it.each([
    [
      "a recipient",
      withFields({ code: "EENVELOPE", responseCode: 450, command: "RCPT TO" }),
    ],
    [
      "a message",
      withFields({ code: "EMESSAGE", responseCode: 451, command: "DATA" }),
    ],
  ])("fails a recipient on %s refused for now, and stops", (_, error) => {
    expect(sendErrorOutcome(error)).toEqual({
      status: WaitlistEmailRecipientStatus.Failed,
      error: "send failed",
      stopsRun: true,
    });
  });

  it.each([
    [
      "a refused login",
      withFields({ code: "EAUTH", responseCode: 535, command: "AUTH PLAIN" }),
    ],
    [
      "a refused sender",
      withFields({
        code: "EENVELOPE",
        responseCode: 550,
        command: "MAIL FROM",
      }),
    ],
    [
      "a refusing greeting",
      withFields({ code: "EPROTOCOL", responseCode: 554, command: "CONN" }),
    ],
    ["a DNS error", withFields({ code: "EDNS" })],
    [
      "a session closed at an address",
      withFields({ code: "EENVELOPE", responseCode: 421, command: "RCPT TO" }),
    ],
    [
      "a session closed at a message",
      withFields({ code: "EMESSAGE", responseCode: 421, command: "DATA" }),
    ],
    [
      "a refused connection",
      withFields({ code: "ESOCKET", syscall: "connect", command: "CONN" }),
    ],
    ["an error before the mail server", new MailNotSentError("send failed")],
  ])(
    "keeps a recipient pending on %s, since a later run may send it",
    (_, error) => {
      expect(sendErrorOutcome(error)).toEqual({
        status: WaitlistEmailRecipientStatus.Pending,
        error: "send failed",
        stopsRun: true,
      });
    },
  );

  it.each(["Connection timeout", "Greeting never received"])(
    "keeps a recipient pending on nodemailer's %s",
    (message) => {
      const error = Object.assign(new Error(message), {
        code: "ETIMEDOUT",
        command: "CONN",
      });
      expect(sendErrorOutcome(error)).toMatchObject({
        status: WaitlistEmailRecipientStatus.Pending,
        stopsRun: true,
      });
    },
  );

  it.each([
    ["a timeout", withFields({ code: "ETIMEDOUT" })],
    ["a dropped socket", withFields({ code: "ESOCKET" })],
    ["a dropped connection", withFields({ code: "ECONNECTION" })],
    [
      "an unexpected success code",
      withFields({ code: "EPROTOCOL", responseCode: 250 }),
    ],
    ["a non-numeric response code", withFields({ responseCode: "550" })],
    ["a plain error", new Error("send failed")],
  ])("leaves a recipient uncertain on %s, and stops", (_, error) => {
    expect(sendErrorOutcome(error)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Uncertain,
      stopsRun: true,
    });
  });

  it("describes a thrown non-error", () => {
    expect(sendErrorOutcome("boom")).toEqual({
      status: WaitlistEmailRecipientStatus.Uncertain,
      error: "boom",
      stopsRun: true,
    });
  });
});

describe("sendOutcome of a mail", () => {
  const cases: [EmailStatus, SendOutcome][] = [
    [
      EmailStatus.Sent,
      {
        status: WaitlistEmailRecipientStatus.Sent,
        error: null,
        stopsRun: false,
      },
    ],
    [
      EmailStatus.Failed,
      {
        status: WaitlistEmailRecipientStatus.Failed,
        error: "The mail server accepted no recipient",
        stopsRun: false,
      },
    ],
    [
      EmailStatus.Pending,
      {
        status: WaitlistEmailRecipientStatus.Failed,
        error: "Mail delivery is off on this server",
        stopsRun: false,
      },
    ],
  ];

  it.each(cases)("maps a %s mail", (mailStatus, outcome) => {
    expect(mailOutcome(mailStatus)).toEqual(outcome);
  });
});
