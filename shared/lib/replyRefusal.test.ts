import { ExceptionEvent } from "@alliance/common/analytics";
import { replyRefusalMessage } from "./replyRefusal";
import { recordExceptions } from "./testing/recordExceptions";

const reported = recordExceptions();

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

it.each([
  [400, "Nothing to reply to", "Nothing to reply to"],
  [401, "Unauthorized", "Your session has expired. Sign in again to reply."],
  [500, "Internal server error", "Failed to submit reply"],
])("explains a %i refusal", (status, message, shown) => {
  expect(replyRefusalMessage({ status, error: { message } })).toBe(shown);
});

it.each([500, 502])("reports a reply the server failed with a %i", (status) => {
  const error = { message: "Internal server error" };
  replyRefusalMessage({ status, error });

  expect(reported).toEqual([
    { event: ExceptionEvent.PostReplyError, error, properties: { status } },
  ]);
});

it("leaves a refusal below 500 unreported", () => {
  replyRefusalMessage({ status: 401, error: { message: "Unauthorized" } });
  replyRefusalMessage({ status: 404, error: { message: "Gone" } });

  expect(reported).toEqual([]);
});
