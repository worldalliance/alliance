import { BadRequestException } from "@nestjs/common";
import { parseFeedPage } from "./feed-page";

describe("parseFeedPage", () => {
  it("defaults the limit and leaves the cursor open", () => {
    expect(parseFeedPage({})).toEqual({ limit: 20, before: undefined });
  });

  it("parses the limit and the before cursor", () => {
    expect(
      parseFeedPage({ limit: "5", before: "2026-01-02T03:04:05.000Z" }),
    ).toEqual({ limit: 5, before: new Date("2026-01-02T03:04:05.000Z") });
  });

  it("rejects a before cursor that is not a date", () => {
    expect(() => parseFeedPage({ before: "not-a-date" })).toThrow(
      BadRequestException,
    );
  });
});
