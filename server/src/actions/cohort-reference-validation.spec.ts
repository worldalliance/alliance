import { BadRequestException } from "@nestjs/common";
import { parseCohortExpressionOrThrow } from "./cohort-reference-validation";

describe("parseCohortExpressionOrThrow", () => {
  it("returns a valid expression", () => {
    expect(parseCohortExpressionOrThrow({ type: "AllMembers" })).toEqual({
      type: "AllMembers",
    });
  });

  it.each([null, "AllMembers", { type: "Nobody" }, { type: "AND" }])(
    "rejects %p as a bad request",
    (value) => {
      expect(() => parseCohortExpressionOrThrow(value)).toThrow(
        BadRequestException,
      );
      expect(() => parseCohortExpressionOrThrow(value)).toThrow(
        /^Invalid cohort expression: /,
      );
    },
  );
});
