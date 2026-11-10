import { describe, expect, it } from "bun:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCustomValidatorDto } from "./customvalidator.dto";

const errorsFor = (type: string) =>
  validate(
    plainToInstance(CreateCustomValidatorDto, { type, idArgument: null }),
  );

describe("CreateCustomValidatorDto type", () => {
  it("accepts a known type", async () => {
    expect(await errorsFor("HasPhoneNumber")).toEqual([]);
  });

  it("rejects the removed CustomExpression type", async () => {
    const errors = await errorsFor("CustomExpression");
    expect(errors.map((e) => e.property)).toEqual(["type"]);
  });
});
