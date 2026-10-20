import { SHARE_URL_LABEL_MAX_LENGTH } from "@alliance/common/shareUrlLabel";
import { describe, expect, it } from "bun:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateShareLinkLabelDto } from "./share-url.dto";

const errorsFor = (label: string) =>
  validate(plainToInstance(UpdateShareLinkLabelDto, { label }));

describe("UpdateShareLinkLabelDto", () => {
  it("accepts a label at the max length", async () => {
    expect(await errorsFor("a".repeat(SHARE_URL_LABEL_MAX_LENGTH))).toEqual([]);
  });

  it("rejects a label over the max length", async () => {
    const errors = await errorsFor("a".repeat(SHARE_URL_LABEL_MAX_LENGTH + 1));
    expect(errors.map((e) => e.property)).toEqual(["label"]);
  });
});
