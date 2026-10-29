import { describe, expect, it } from "bun:test";
import { koraAvailable } from "./kora";

describe("koraAvailable", () => {
  it("stays off in production and wherever the environment is unrecognized", () => {
    expect(koraAvailable("production")).toBe(false);
    expect(koraAvailable("prod")).toBe(false);
    expect(koraAvailable(undefined)).toBe(false);
  });

  it("is on in staging", () => {
    expect(koraAvailable("staging")).toBe(true);
  });
});
