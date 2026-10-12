import { replyRefusalMessage } from "./replyRefusal";

it.each([
  [400, "Nothing to reply to", "Nothing to reply to"],
  [401, "Unauthorized", "Your session has expired. Sign in again to reply."],
  [500, "Internal server error", "Failed to submit reply"],
])("explains a %i refusal", (status, message, shown) => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(replyRefusalMessage({ status, error: { message } })).toBe(shown);
});
