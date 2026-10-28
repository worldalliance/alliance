import { describe, expect, it } from "bun:test";
import { participantsAvailable } from "./participant";

describe("participantsAvailable", () => {
  it("stays off in production and wherever the environment is unrecognized", () => {
    expect(participantsAvailable("production")).toBe(false);
    expect(participantsAvailable("prod")).toBe(false);
    expect(participantsAvailable(undefined)).toBe(false);
  });

  it("is on in staging", () => {
    expect(participantsAvailable("staging")).toBe(true);
  });
});
