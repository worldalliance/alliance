import { MailNotSentError } from "src/mail/mail.service";

/** What a failed send shows about whether the message went out. */
export enum SendErrorKind {
  /** Nothing reached the provider, or it refused the session. */
  NotHandedOver = "not_handed_over",
  /** This message was refused, by the provider or before reaching it, and would be again. */
  Refused = "refused",
  /** The provider refused this message for now; the next one may meet the same. */
  RefusedForNow = "refused_for_now",
  /** It may have gone out. */
  Unknown = "unknown",
}

// A refusal of this recipient, or of this message, refuses the message. Any
// other 4xx or 5xx reply, such as to the greeting, login, or sender, or a 421
// closing the session wherever it comes, refuses the session, and the codes
// below, a failed connect, and nodemailer's connect and greeting timeouts,
// which only their messages tell apart from a timeout after sending, mean
// nothing reached the server. Any other error may have come after the server
// took the message, including ECONNECTION without a reply, which nodemailer
// also reports for a connection dropped after the message was sent.
const NOT_YET_SENT_CODES = new Set(["EAUTH", "EDNS"]);
const SESSION_CLOSING_CODE = 421;
const NOT_YET_SENT_TIMEOUTS = new Set([
  "Connection timeout",
  "Greeting never received",
]);
const MESSAGE_ERROR_CODES = new Set(["EENVELOPE", "EMESSAGE"]);

/** Sorts an error from `MailService.sendMail` or nodemailer. */
export function mailSendError(error: unknown): SendErrorKind {
  if (error instanceof MailNotSentError) return SendErrorKind.NotHandedOver;
  if (typeof error !== "object" || error === null) return SendErrorKind.Unknown;
  const field = (name: string): unknown =>
    name in error ? Reflect.get(error, name) : undefined;
  const code = field("code");
  const command = field("command");
  const responseCode = field("responseCode");
  if (typeof code === "string" && NOT_YET_SENT_CODES.has(code)) {
    return SendErrorKind.NotHandedOver;
  }
  if (field("syscall") === "connect") return SendErrorKind.NotHandedOver;
  if (
    code === "ETIMEDOUT" &&
    error instanceof Error &&
    NOT_YET_SENT_TIMEOUTS.has(error.message)
  ) {
    return SendErrorKind.NotHandedOver;
  }
  if (typeof responseCode === "number" && responseCode >= 400) {
    if (
      (command === "RCPT TO" || command === "DATA") &&
      responseCode !== SESSION_CLOSING_CODE
    ) {
      return responseCode < 500
        ? SendErrorKind.RefusedForNow
        : SendErrorKind.Refused;
    }
    return SendErrorKind.NotHandedOver;
  }
  // Raised before the server was asked, about this message's envelope or size.
  if (
    typeof code === "string" &&
    MESSAGE_ERROR_CODES.has(code) &&
    typeof responseCode !== "number"
  ) {
    return SendErrorKind.Refused;
  }
  return SendErrorKind.Unknown;
}

const TWILIO_NOT_PROCESSED = new Set([401, 403, 429]);
const BEFORE_REQUEST_SYSCALLS = new Set(["connect", "getaddrinfo"]);

/**
 * Sorts an error from Twilio's message create. A 429, or a 401 or 403 refusing
 * the account, processed nothing; another 4xx carrying Twilio's error code
 * refuses the message.
 * A failed DNS lookup or connect, which axios keeps as the cause, sent nothing.
 * A 5xx, a reset or a timeout may have come after Twilio created the message.
 */
export function textSendError(error: unknown): SendErrorKind {
  if (typeof error !== "object" || error === null) return SendErrorKind.Unknown;
  const status = Reflect.get(error, "status");
  const code = Reflect.get(error, "code");
  if (typeof status === "number" && TWILIO_NOT_PROCESSED.has(status)) {
    return SendErrorKind.NotHandedOver;
  }
  if (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    typeof code === "number" &&
    code > 0
  ) {
    return SendErrorKind.Refused;
  }
  const cause: unknown = Reflect.get(error, "cause");
  return typeof cause === "object" &&
    cause !== null &&
    BEFORE_REQUEST_SYSCALLS.has(String(Reflect.get(cause, "syscall")))
    ? SendErrorKind.NotHandedOver
    : SendErrorKind.Unknown;
}
