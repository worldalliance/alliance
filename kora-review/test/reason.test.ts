import { describe, expect, it } from "bun:test";
import { quotedReason } from "../src/engine/ranking.js";

describe("quotedReason", () => {
  it("quotes a short highlight whole, with its note", () => {
    expect(quotedReason("asks for the address", "unsafe")).toBe(
      "“asks for the address” unsafe",
    );
  });

  it("shortens a long highlight so the reason fits the export's 280 characters", () => {
    const reason = quotedReason("x".repeat(281), "Gives the answer");
    expect(reason).toHaveLength(280);
    expect(reason).toEndWith("…” Gives the answer");
  });
});
