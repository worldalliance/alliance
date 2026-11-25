import type { PushDto } from "@alliance/shared/client/types.gen";
import { pushFailureReason } from "./testPushRules";

const push = (overrides: Partial<PushDto>): PushDto => ({
  id: 1,
  expoPushToken: "ExponentPushToken[x]",
  createdAt: "2026-11-25T20:00:00.000Z",
  updatedAt: "2026-11-25T20:00:00.000Z",
  body: "hi",
  screen: null,
  receiptId: null,
  ticketStatus: null,
  receiptStatus: null,
  errorCode: null,
  errorMessage: null,
  lastCheckedStatusAt: null,
  idempotencyKey: "key",
  openedAt: null,
  ...overrides,
});

it("has no failure when Expo accepted the push", () => {
  expect(
    pushFailureReason(push({ ticketStatus: "ok", receiptStatus: "pending" })),
  ).toBeNull();
});

it("says the request to Expo failed when the push has no ticket", () => {
  expect(pushFailureReason(push({}))).toBe(
    "The server's request to Expo failed; the server log has the reason.",
  );
});

it("says the device was removed when Expo no longer knows it", () => {
  expect(
    pushFailureReason(
      push({ ticketStatus: "error", errorCode: "DeviceNotRegistered" }),
    ),
  ).toMatch(/removed it from the member's devices/);
});

it("gives Expo's own words for any other refusal", () => {
  expect(
    pushFailureReason(
      push({
        ticketStatus: "error",
        errorCode: "MessageTooBig",
        errorMessage: "The message is too big.",
      }),
    ),
  ).toBe("Expo refused it. The message is too big.");
});
