import { describe, expect, it } from "bun:test";
import { thrownMessage, thrownStack } from "./errorMessage";

describe("thrownMessage", () => {
  it("reads an error's message", () => {
    expect(thrownMessage(new TypeError("boom"))).toBe("boom");
  });

  it("stringifies a thrown non-error", () => {
    expect(thrownMessage("boom")).toBe("boom");
  });
});

describe("thrownStack", () => {
  it("leads with the error's name and message", () => {
    expect(thrownStack(new TypeError("boom"))).toStartWith("TypeError: boom\n");
  });

  it("leaves out properties a failed query carries", () => {
    const error = Object.assign(new Error("duplicate key value"), {
      parameters: ["ada@example.com"],
      detail: "Key (email)=(ada@example.com) already exists.",
    });
    expect(thrownStack(error)).not.toContain("ada@example.com");
  });

  it("falls back to the message when the stack is missing", () => {
    const error = new Error("boom");
    error.stack = undefined;
    expect(thrownStack(error)).toBe("boom");
  });

  it("stringifies a thrown non-error", () => {
    expect(thrownStack("boom")).toBe("boom");
  });
});
