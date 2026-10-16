import { hasTakenEffect } from "./actionEvent";

describe("hasTakenEffect", () => {
  const date = new Date("2026-02-01");

  it("is false before the event's date", () => {
    expect(hasTakenEffect(date, new Date(date.getTime() - 1))).toBe(false);
  });

  it("is true at the event's date", () => {
    expect(hasTakenEffect(date, date)).toBe(true);
  });

  it("accepts a serialized date", () => {
    expect(hasTakenEffect(date.toISOString(), date)).toBe(true);
  });
});
