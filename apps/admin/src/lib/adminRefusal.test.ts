import { describe, expect, it } from "bun:test";
import { rowRefusalMessage } from "./adminRefusal";
import { sessionExpiredMessage } from "./sessionExpired";

describe("rowRefusalMessage", () => {
  it("names the row, with the server's reason when it gives one", () => {
    const failed = "Couldn't delete video 36";
    expect(rowRefusalMessage(new Error("boom"), failed)).toBe(
      "Couldn't delete video 36.",
    );
    expect(rowRefusalMessage({ statusCode: 401 }, failed)).toBe(
      `Couldn't delete video 36: ${sessionExpiredMessage}`,
    );
  });
});
