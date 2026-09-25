import { sessionExpiredMessage } from "../lib/sessionExpired";
import { actionSaveErrorMessage } from "./ActionDashboard";

describe("action save errors", () => {
  it("explains how to recover from an expired session", () => {
    expect(
      actionSaveErrorMessage({ statusCode: 401, message: "Unauthorized" }),
    ).toBe(sessionExpiredMessage);
  });

  it("keeps the server's conflict message", () => {
    expect(
      actionSaveErrorMessage({
        statusCode: 409,
        message: "This form already belongs to another action.",
      }),
    ).toBe("This form already belongs to another action.");
  });

  it("keeps validation messages", () => {
    expect(
      actionSaveErrorMessage({
        statusCode: 400,
        message: ["name must be a string", "body must be a string"],
      }),
    ).toBe("name must be a string, body must be a string");
  });

  it.each([500, 503])("uses the save fallback for status %s", (statusCode) => {
    expect(
      actionSaveErrorMessage({ statusCode, message: "Internal server error" }),
    ).toBe("Failed to save action");
  });

  it.each([undefined, "401", 0, 200, 400.5, 600])(
    "uses the save fallback for invalid status %s",
    (statusCode) => {
      expect(
        actionSaveErrorMessage({ statusCode, message: "Unexpected error" }),
      ).toBe("Failed to save action");
    },
  );

  it.each([null, "Failed to fetch", new TypeError("Failed to fetch")])(
    "uses the save fallback for an unstructured error %s",
    (error) => {
      expect(actionSaveErrorMessage(error)).toBe("Failed to save action");
    },
  );

  it("uses a caller's fallback for an unstructured error", () => {
    expect(actionSaveErrorMessage(null, "Failed to duplicate action")).toBe(
      "Failed to duplicate action",
    );
  });
});
