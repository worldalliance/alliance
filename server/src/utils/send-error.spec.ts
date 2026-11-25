import { describe, expect, it } from "bun:test";
import { SendErrorKind, textSendError } from "./send-error";

const twilioError = (fields: Record<string, unknown>) =>
  Object.assign(new Error("twilio"), fields);

describe("textSendError", () => {
  it.each([
    ["a rate limit", twilioError({ status: 429, code: 20429 })],
    ["refused credentials", twilioError({ status: 401, code: 20003 })],
    ["a forbidden account", twilioError({ status: 403, code: 20403 })],
    [
      "a failed DNS lookup",
      twilioError({ cause: { code: "ENOTFOUND", syscall: "getaddrinfo" } }),
    ],
    [
      "a refused connection",
      twilioError({ cause: { code: "ECONNREFUSED", syscall: "connect" } }),
    ],
  ])("reads %s as never handed over", (_, error) => {
    expect(textSendError(error)).toBe(SendErrorKind.NotHandedOver);
  });

  it("reads a 4xx carrying Twilio's error code as refused", () => {
    expect(textSendError(twilioError({ status: 400, code: 21211 }))).toBe(
      SendErrorKind.Refused,
    );
  });

  it.each([
    ["a 4xx without Twilio's error code", twilioError({ status: 404 })],
    ["a 5xx", twilioError({ status: 503, code: 20500 })],
    [
      "a reset",
      twilioError({ cause: { code: "ECONNRESET", syscall: "read" } }),
    ],
    ["an axios timeout", twilioError({ code: "ECONNABORTED" })],
    ["a plain error", new Error("boom")],
    ["a thrown non-error", "boom"],
  ])("reads %s as unknown", (_, error) => {
    expect(textSendError(error)).toBe(SendErrorKind.Unknown);
  });
});
